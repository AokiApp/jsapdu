import pcsclite from "pcsclite";
import {
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
  SmartCardPlatformManager,
} from "@aokiapp/interface";
import { PCSCLite, CardReader } from "@aokiapp/pcsc/typesPcsclite";

export class PcscPlatformManager extends SmartCardPlatformManager {
  public getPlatform(): PcscPlatform {
    return new PcscPlatform(pcsclite());
  }
}

export class PcscPlatform extends SmartCardPlatform {
  private readers: CardReader[] = [];

  constructor(private pcsc: PCSCLite) {
    super();
  }

  public async init(timeoutMs = 10000): Promise<void> {
    this.assertNotInitialized();

    return new Promise<void>((resolve, reject) => {
      // タイムアウト処理
      const timeoutId = setTimeout(() => {
        reject(new Error("PC/SC initialization timed out: No reader found"));
      }, timeoutMs);

      const readerHandler = (reader: CardReader) => {
        this.readers.push(reader);
        clearTimeout(timeoutId);
        this.initialized = true; // 成功時のみフラグを設定
        resolve();
      };

      this.pcsc.on("reader", readerHandler);

      this.pcsc.on("error", (err: unknown) => {
        console.error(
          "PCSC error:",
          err instanceof Error ? err.message : String(err),
        );
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }

  public async release(): Promise<void> {
    this.assertInitialized();
    this.pcsc.close();
    this.initialized = false;
  }

  public async getDevices(): Promise<PcscDeviceInfo[]> {
    this.assertInitialized();
    return this.readers.map((reader) => new PcscDeviceInfo(this, reader));
  }
}

export class PcscDeviceInfo extends SmartCardDeviceInfo {
  constructor(
    private platform: PcscPlatform,
    private reader: CardReader,
  ) {
    super();
  }

  public get id(): string {
    return this.reader.name;
  }

  public get devicePath(): string | undefined {
    return undefined;
  }

  public get friendlyName(): string | undefined {
    return this.reader.name;
  }

  public get description(): string | undefined {
    return "PC/SC Smart Card Reader";
  }

  public get supportsApdu(): boolean {
    return true;
  }

  public get supportsHce(): boolean {
    return false;
  }

  public get isIntegratedDevice(): boolean {
    return false;
  }

  public get isRemovableDevice(): boolean {
    return true;
  }

  public get d2cProtocol(): "iso7816" | "nfc" | "other" | "unknown" {
    return "iso7816";
  }

  public get p2dProtocol(): "usb" | "ble" | "nfc" | "other" | "unknown" {
    return "usb";
  }

  public get apduApi(): string[] {
    return ["pcsc"];
  }

  public async acquireDevice(): Promise<PcscDevice> {
    return new PcscDevice(this.platform, this.reader);
  }
}

export class PcscDevice extends SmartCardDevice {
  constructor(
    private platform: PcscPlatform,
    public reader: CardReader,
  ) {
    super(platform, new PcscDeviceInfo(platform, reader));
  }

  public getDeviceInfo(): SmartCardDeviceInfo {
    return new PcscDeviceInfo(this.platform, this.reader);
  }

  public isActive(): boolean {
    return this.reader.connected;
  }

  public async isCardPresent(): Promise<boolean> {
    return new Promise((resolve) => {
      this.reader.get_status((err, state) => {
        if (err) {
          resolve(false);
        } else {
          resolve((state & this.reader.SCARD_STATE_PRESENT) !== 0);
        }
      });
    });
  }

  public async startSession(): Promise<Pcsc> {
    const pcsc = new Pcsc(this);
    await pcsc.connect();
    return pcsc;
  }

  public async release(): Promise<void> {
    this.reader.close();
  }
}

export class Pcsc extends SmartCard {
  private protocol!: number;
  private connected = false;

  constructor(private device: PcscDevice) {
    super(device);
  }

  public async connect(): Promise<void> {
    const protocol = await new Promise<number>((resolve, reject) => {
      this.device.reader.connect(
        { share_mode: this.device.reader.SCARD_SHARE_SHARED },
        (err, protocol) => {
          if (err) {
            reject(err);
          } else {
            resolve(protocol);
          }
        },
      );
    });
    this.protocol = protocol;
    this.connected = true;
  }

  /**
   * Returns the ATR (Answer To Reset) of the card.
   * ATR contains information about the card's capabilities and communication parameters.
   * @returns Promise resolving to Uint8Array containing the ATR
   * @throws Error if the operation fails or ATR is undefined
   */
  public async getAtr(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      this.device.reader.get_status((err, state, atr) => {
        if (err) {
          reject(err);
        } else {
          if (atr) {
            resolve(atr);
          } else {
            reject(new Error("ATR is undefined"));
          }
        }
      });
    });
  }

  /**
   * Transmits APDU commands to the card and returns the response.
   * @param data APDU command as Uint8Array to be sent to the card
   * @returns Promise resolving to Uint8Array containing the card's response
   * @throws Error if card is not connected or transmission fails
   */
  public async transmit(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    if (!this.connected) {
      throw new Error("A card not connected");
    }

    return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      this.device.reader.transmit(
        Buffer.from(data),
        65536,
        this.protocol,
        (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(Uint8Array.from(res));
          }
        },
      );
    });
  }

  /**
   * Resets the card by disconnecting with the RESET flag.
   * This performs a warm reset of the card which reinitializes it.
   * @returns Promise resolving when reset completes
   * @throws Error if reset operation fails
   */
  public async reset(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.device.reader.disconnect(
        this.device.reader.SCARD_RESET_CARD,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }

  public async release(): Promise<void> {
    this.connected = false;
    await new Promise<void>((resolve, reject) => {
      this.device.reader.disconnect(
        this.device.reader.SCARD_LEAVE_CARD,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }
}

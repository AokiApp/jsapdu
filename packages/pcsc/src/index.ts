import { Buffer } from "node:buffer";
import pcsclite from "pcsclite";

import {
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
  SmartCardPlatformManager,
  SmartCardError,
  TimeoutError,
  fromUnknownError,
} from "@aokiapp/interface";
import { CommandApdu, ResponseApdu } from "@aokiapp/interface";

import { CardReader, PCSCLite } from "./typesPcsclite";

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
    try {
      this.assertNotInitialized();
      await this.initWithTimeout(timeoutMs);
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  private async initWithTimeout(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(
          "PC/SC initialization timed out: No reader found",
          "platform_init",
          timeoutMs
        ));
      }, timeoutMs);

      const readerHandler = (reader: CardReader) => {
        this.readers.push(reader);
        clearTimeout(timeoutId);
        this.initialized = true; // 成功時のみフラグを設定
        resolve();
        this.pcsc.removeListener("reader", readerHandler);
      };

      this.pcsc.on("reader", readerHandler);

      this.pcsc.on("error", (err: unknown) => {
        clearTimeout(timeoutId);
        reject(fromUnknownError(err, "PLATFORM_ERROR"));
      });
    });
  }

  public async release(): Promise<void> {
    try {
      this.assertInitialized();
      await Promise.resolve(this.pcsc.close());
      this.initialized = false;
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  public async getDevices(): Promise<PcscDeviceInfo[]> {
    try {
      this.assertInitialized();
      if (this.readers.length === 0) {
        throw new SmartCardError("NO_READERS", "No card readers found");
      }
      await Promise.resolve(); // Ensure async context
      return this.readers.map((reader) => new PcscDeviceInfo(this, reader));
    } catch (error) {
      throw fromUnknownError(error);
    }
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
    try {
      return await new Promise((resolve, reject) => {
        this.reader.get_status((err, state) => {
          if (err) {
            reject(fromUnknownError(err, "READER_ERROR"));
          } else {
            resolve((state & this.reader.SCARD_STATE_PRESENT) !== 0);
          }
        });
      });
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  public async startSession(): Promise<Pcsc> {
    try {
      const pcsc = new Pcsc(this);
      await pcsc.connect();
      return pcsc;
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  public async release(): Promise<void> {
    try {
      await Promise.resolve(this.reader.close());
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
}

export class Pcsc extends SmartCard {
  private protocol!: number;
  private connected = false;

  constructor(private device: PcscDevice) {
    super(device);
  }

  public async connect(): Promise<void> {
    try {
      if (this.connected) {
        throw new SmartCardError(
          "ALREADY_CONNECTED",
          "Card already connected"
        );
      }

      const protocol = await new Promise<number>((resolve, reject) => {
        this.device.reader.connect(
          { share_mode: this.device.reader.SCARD_SHARE_SHARED },
          (err, protocol) => {
            if (err) {
              reject(fromUnknownError(err, "READER_ERROR"));
            } else {
              resolve(protocol);
            }
          },
        );
      });

      this.protocol = protocol;
      this.connected = true;
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  /**
   * Returns the ATR (Answer To Reset) of the card.
   * ATR contains information about the card's capabilities and communication parameters.
   * @returns Promise resolving to Uint8Array containing the ATR
   * @throws Error if the operation fails or ATR is undefined
   */
  public async getAtr(): Promise<Uint8Array> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card not connected"
        );
      }

      return await new Promise((resolve, reject) => {
        this.device.reader.get_status((err, state, atr) => {
          if (err) {
            reject(fromUnknownError(err, "READER_ERROR"));
          } else {
            if (atr) {
              resolve(atr);
            } else {
              reject(new SmartCardError(
                "READER_ERROR",
                "ATR is undefined"
              ));
            }
          }
        });
      });
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  /**
   * Transmits APDU commands to the card and returns the response.
   * @param data APDU command as Uint8Array to be sent to the card
   * @returns Promise resolving to Uint8Array containing the card's response
   * @throws Error if card is not connected or transmission fails
   */
  public async transmit(data: CommandApdu): Promise<ResponseApdu> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card not connected"
        );
      }

      return await new Promise<ResponseApdu>((resolve, reject) => {
        this.device.reader.transmit(
          Buffer.from(data.toUint8Array()),
          65536,
          this.protocol,
          (err, res) => {
            if (err) {
              reject(fromUnknownError(err, "TRANSMISSION_ERROR"));
            } else {
              resolve(ResponseApdu.fromUint8Array(new Uint8Array(res)));
            }
          },
        );
      });
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  /**
   * Resets the card by disconnecting with the RESET flag.
   * This performs a warm reset of the card which reinitializes it.
   * @returns Promise resolving when reset completes
   * @throws Error if reset operation fails
   */
  public async reset(): Promise<void> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card not connected"
        );
      }

      await new Promise<void>((resolve, reject) => {
        this.device.reader.disconnect(
          this.device.reader.SCARD_RESET_CARD,
          (err) => {
            if (err) {
              reject(fromUnknownError(err, "READER_ERROR"));
            } else {
              resolve();
            }
          },
        );
      });
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  public async release(): Promise<void> {
    try {
      if (!this.connected) {
        return;
      }

      this.connected = false;
      await new Promise<void>((resolve, reject) => {
        this.device.reader.disconnect(
          this.device.reader.SCARD_LEAVE_CARD,
          (err) => {
            if (err) {
              reject(fromUnknownError(err, "READER_ERROR"));
            } else {
              resolve();
            }
          },
        );
      });
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
}

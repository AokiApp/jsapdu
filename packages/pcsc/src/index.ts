import { Buffer } from "node:buffer";
import { once } from "node:events";
import pcsclite from "pcsclite";

import {
  EmulatedCard,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardError,
  SmartCardPlatform,
  SmartCardPlatformManager,
  TimeoutError,
  fromUnknownError,
} from "@aokiapp/interface";
import { CommandApdu, ResponseApdu } from "@aokiapp/interface";

import { CardReader, PCSCLite } from "./typesPcsclite";

export class PcscPlatformManager extends SmartCardPlatformManager {
  public getPlatform(): PcscPlatform {
    return new PcscPlatform();
  }
}

export class PcscPlatform extends SmartCardPlatform {
  private readers: CardReader[] = [];
  private pcsc!: PCSCLite;

  constructor() {
    super();
  }

  private errorHandler = (error: unknown) => {
    // Handle error
    console.error("PC/SC Error:", error);
  };
  private setErrorHandler(enable: boolean): void {
    if (enable) {
      this.pcsc.on("error", this.errorHandler);
    } else {
      this.pcsc.removeListener("error", this.errorHandler);
    }
  }

  private readerWatcherHandler = () => {
    this.readers = Object.values(this.pcsc.readers); // pcsc.readers is updated in behind, so just use it
  };

  private setReaderWatcher(enable: boolean): void {
    if (enable) {
      this.pcsc.on("reader", this.readerWatcherHandler);
    } else {
      this.pcsc.removeListener("reader", this.readerWatcherHandler);
    }
  }

  public async init(timeoutMs = 10000): Promise<void> {
    this.assertNotInitialized();

    // Initialization starts in background
    this.pcsc = pcsclite() as PCSCLite; // override type, which is not maintained and bad in quality
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      try {
        await once(this.pcsc, "reader", { signal: controller.signal }).catch(
          (err: unknown) => {
            throw fromUnknownError(err, "PLATFORM_ERROR");
          },
        );
      } finally {
        clearTimeout(timeoutId);
      }
      // reader is found, so we can set the error handler in the next step
      // but for first time, we need to set current readers, since `reader` event is already emitted
      this.readers = Object.values(this.pcsc.readers);

      // then set the real reader watcher handler
      this.setReaderWatcher(true);
      // and set the error handler
      this.setErrorHandler(true);
      this.initialized = true;
    } catch (error: unknown) {
      // initialization & first time reader detection did not succeed in time
      // falls here when timeout or error event is emitted
      await this.release();
      if (error instanceof DOMException && error.name === "AbortError") {
        // タイムアウトエラーの場合、AbortControllerのabort()で設定したエラーを投げる
        throw new TimeoutError(
          "PC/SC initialization timed out: No reader found",
          "platform_init",
          timeoutMs,
        );
      }
      throw error;
    }
  }

  public async release(): Promise<void> {
    try {
      this.assertInitialized();
      // Remove error handler
      this.setErrorHandler(false);
      // Remove reader watcher
      this.setReaderWatcher(false);

      this.readers.forEach((reader) => {
        reader.close(); // need this, otherwise it seems hidden handler remains (outside node) and prevents graceful exit
      });

      const noopHandler = () => {
        // expect Context Cancelled, do nothing
        // since node:events has special handling for `error` event
        // and we don't want to throw an error when closing
        // the PC/SC context
        // ref: https://nodejs.org/api/events.html#error-events

        this.pcsc.removeListener("error", noopHandler);
      };
      this.pcsc.on("error", noopHandler);
      // Close PCSC
      await Promise.resolve(this.pcsc.close());
      this.initialized = false;
      setTimeout(() => {
        // remove noop handler
        this.pcsc.removeListener("error", noopHandler);
      }, 1000);
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  public async getDevices(): Promise<PcscDeviceInfo[]> {
    try {
      this.assertInitialized();
      if (this.readers.length === 0) {
        return [];
      }

      await Promise.resolve(); // consume async context
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
    const device = new PcscDevice(this.platform, this.reader);
    await Promise.resolve(); // Ensure async context
    return device;
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
    return new Promise((resolve, reject) => {
      this.reader.get_status((err, state) => {
        if (err) {
          reject(fromUnknownError(err, "READER_ERROR"));
        } else {
          resolve((state & this.reader.SCARD_STATE_PRESENT) !== 0);
        }
      });
    });
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
      // this.removeEventHandlers();
      if (this.reader.connected) {
        await Promise.resolve(this.reader.close());
      }
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
  public startHceSession(): Promise<EmulatedCard> {
    throw new Error("This platform does not support HCE");
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
            reject(fromUnknownError(err, "READER_ERROR"));
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
          reject(fromUnknownError(err, "READER_ERROR"));
        } else {
          if (atr) {
            resolve(atr);
          } else {
            reject(new SmartCardError("READER_ERROR", "ATR is undefined"));
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
  public async transmit(data: CommandApdu): Promise<ResponseApdu> {
    try {
      if (!this.connected) {
        throw new SmartCardError("NOT_CONNECTED", "Card not connected");
      }

      if (!this.device.reader.connected) {
        throw new SmartCardError("READER_ERROR", "Reader is closed");
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

  public async reset(): Promise<void> {
    try {
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

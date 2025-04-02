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
  private errorHandler?: (err: unknown) => void;
  private readerHandler?: (reader: CardReader) => void;

  constructor(private pcsc: PCSCLite) {
    super();
  }

  public async init(timeoutMs = 10000): Promise<void> {
    try {
      this.assertNotInitialized();
      await this.initWithTimeout(timeoutMs);
    } catch (error) {
      // Cleanup in case of error
      this.removeEventListeners();
      throw fromUnknownError(error);
    }
  }

  private removeEventListeners(): void {
    if (this.errorHandler) {
      this.pcsc.removeListener("error", this.errorHandler);
      this.errorHandler = undefined;
    }
    if (this.readerHandler) {
      this.pcsc.removeListener("reader", this.readerHandler);
      this.readerHandler = undefined;
    }
  }

  private async initWithTimeout(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeoutId);
        this.removeEventListeners();
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new TimeoutError(
          "PC/SC initialization timed out: No reader found",
          "platform_init",
          timeoutMs
        ));
      }, timeoutMs);

      this.readerHandler = (reader: CardReader) => {
        reader.on("end", () => {
          const index = this.readers.indexOf(reader);
          if (index !== -1) {
            this.readers.splice(index, 1);
          }
        });

        this.readers.push(reader);
        cleanup();
        this.initialized = true;
        resolve();
      };

      this.errorHandler = (err: unknown) => {
        cleanup();
        reject(fromUnknownError(err, "PLATFORM_ERROR"));
      };

      this.pcsc.on("reader", this.readerHandler);
      this.pcsc.on("error", this.errorHandler);
    });
  }

  public async release(): Promise<void> {
    try {
      this.assertInitialized();

      // Release all readers first
      await Promise.all(
        this.readers.map(async (reader) => {
          try {
            await Promise.resolve(reader.close());
          } catch (error) {
            console.warn("Error closing reader:", error);
          }
        })
      );

      // Clear readers array
      this.readers = [];

      // Remove event listeners
      this.removeEventListeners();

      // Close PCSC
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
      
      // Filter out closed readers
      const activeReaders = this.readers.filter(reader => !reader.closed);
      if (activeReaders.length === 0) {
        throw new SmartCardError("NO_READERS", "No active readers found");
      }
      await Promise.resolve(); // consume async context
      return activeReaders.map(reader => new PcscDeviceInfo(this, reader));
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
    if (this.reader.closed) {
      throw new SmartCardError(
        "READER_ERROR",
        "Reader is closed"
      );
    }
    const device = new PcscDevice(this.platform, this.reader);
    await Promise.resolve(); // Ensure async context
    return device;
  }
}

export class PcscDevice extends SmartCardDevice {
  private endHandler?: () => void;

  constructor(
    private platform: PcscPlatform,
    public reader: CardReader,
  ) {
    super(platform, new PcscDeviceInfo(platform, reader));
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.endHandler = () => {
      if (this.isActive()) {
        this.release().catch(console.error);
      }
    };
    this.reader.on("end", this.endHandler);
  }

  private removeEventHandlers(): void {
    if (this.endHandler) {
      this.reader.removeListener("end", this.endHandler);
      this.endHandler = undefined;
    }
  }

  public getDeviceInfo(): SmartCardDeviceInfo {
    return new PcscDeviceInfo(this.platform, this.reader);
  }

  public isActive(): boolean {
    return this.reader.connected && !this.reader.closed;
  }

  public async isCardPresent(): Promise<boolean> {
    try {
      if (this.reader.closed) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is closed"
        );
      }

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
      if (this.reader.closed) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is closed"
        );
      }

      const pcsc = new Pcsc(this);
      await pcsc.connect();
      return pcsc;
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  public async release(): Promise<void> {
    try {
      this.removeEventHandlers();
      if (!this.reader.closed) {
        await Promise.resolve(this.reader.close());
      }
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
}

export class Pcsc extends SmartCard {
  private protocol!: number;
  private connected = false;
  private statusHandler?: () => void;

  constructor(private device: PcscDevice) {
    super(device);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.statusHandler = () => {
      if (this.connected) {
        this.release().catch(console.error);
      }
    };
    this.device.reader.on("status", this.statusHandler);
  }

  private removeEventHandlers(): void {
    if (this.statusHandler) {
      this.device.reader.removeListener("status", this.statusHandler);
      this.statusHandler = undefined;
    }
  }

  public async connect(): Promise<void> {
    try {
      if (this.connected) {
        throw new SmartCardError(
          "ALREADY_CONNECTED",
          "Card already connected"
        );
      }

      if (this.device.reader.closed) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is closed"
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
      this.removeEventHandlers();
      throw fromUnknownError(error);
    }
  }

  public async getAtr(): Promise<Uint8Array> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card not connected"
        );
      }

      if (this.device.reader.closed) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is closed"
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

  public async transmit(data: CommandApdu): Promise<ResponseApdu> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card not connected"
        );
      }

      if (this.device.reader.closed) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is closed"
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

  public async reset(): Promise<void> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card not connected"
        );
      }

      if (this.device.reader.closed) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is closed"
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

      this.removeEventHandlers();
      this.connected = false;

      if (!this.device.reader.closed) {
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
      }
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
}

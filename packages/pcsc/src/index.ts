import { Buffer } from "node:buffer";
import pcsclite from "pcsclite";

import {
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
  SmartCardPlatformManager,
  SmartCardError,
  ValidationError,
  TimeoutError,
  fromUnknownError,
} from "@aokiapp/interface";
import { CommandApdu, ResponseApdu } from "@aokiapp/interface";

import { CardReader, PCSCLite } from "./typesPcsclite";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  /** Default timeout for platform initialization (ms) */
  INIT_TIMEOUT: 10000,
  /** Default timeout for card operations (ms) */
  OPERATION_TIMEOUT: 5000,
  /** Maximum response length for transmit operations */
  MAX_RESPONSE_LENGTH: 65536,
  /** Maximum number of concurrent readers */
  MAX_READERS: 10,
} as const;

/**
 * Security capabilities supported by the platform/device
 */
interface SecurityCapabilities {
  /** Supports secure channel communication */
  secureChannel: boolean;
  /** Supports hardware-level encryption */
  hardwareEncryption: boolean;
  /** Supports secure PIN entry */
  securePinEntry: boolean;
  /** Maximum secure messaging buffer size */
  maxSecureBufferSize: number;
  /** Supported secure messaging protocols */
  secureProtocols: string[];
  /** Supports tamper detection */
  tamperDetection: boolean;
}

/**
 * Error codes that can be automatically retried
 * These represent transient errors that may succeed on retry
 */
type RetryableErrorCode = "TRANSMISSION_ERROR" | "PROTOCOL_ERROR" | "TIMEOUT";

/**
 * Retry configuration for transient errors
 */
const RETRY_CONFIG = {
  /** Maximum number of retries for transient errors */
  MAX_RETRIES: 3,
  /** Delay between retries (ms) */
  RETRY_DELAY: 1000,
  /** Error codes that can be retried */
  RETRYABLE_ERRORS: [
    "TRANSMISSION_ERROR",
    "PROTOCOL_ERROR",
    "TIMEOUT"
  ] as readonly RetryableErrorCode[]
} as const;

/**
 * Helper function to handle retryable operations with automatic retry logic
 * 
 * Automatically retries operations that fail with specific error codes:
 * - TRANSMISSION_ERROR: Communication errors that may be transient
 * - PROTOCOL_ERROR: Protocol-level errors that may succeed on retry
 * - TIMEOUT: Timeout errors that may succeed with another attempt
 * 
 * @param operation The operation to execute with retry logic
 * @returns The result of the operation if successful
 * @throws The last error encountered if all retries fail
 * @throws The original error immediately if it's not a retryable error
 * 
 * @example
 * ```typescript
 * const response = await withRetry(() => card.transmit(command));
 * ```
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < RETRY_CONFIG.MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof SmartCardError) {
        if (RETRY_CONFIG.RETRYABLE_ERRORS.includes(error.code as RetryableErrorCode)) {
          lastError = error;
          if (i < RETRY_CONFIG.MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.RETRY_DELAY));
            continue;
          }
        }
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < RETRY_CONFIG.MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.RETRY_DELAY));
      }
    }
  }
  throw lastError || new Error("Operation failed after retries");
}

/**
 * Platform manager for PC/SC smart card readers
 * Provides access to PC/SC compatible smart card readers through the pcsclite library
 * 
 * @example
 * ```typescript
 * const manager = new PcscPlatformManager();
 * const platform = manager.getPlatform();
 * await platform.init();
 * const devices = await platform.getDevices();
 * ```
 */
export class PcscPlatformManager extends SmartCardPlatformManager {
  public getPlatform(): PcscPlatform {
    return new PcscPlatform(pcsclite());
  }
}

/**
 * PC/SC platform implementation
 * Manages PC/SC reader resources and provides access to connected readers
 * 
 * @example
 * ```typescript
 * const platform = new PcscPlatform(pcsclite());
 * await platform.init({ timeout: 5000 });
 * const devices = await platform.getDevices();
 * for (const device of devices) {
 *   console.log(`Found reader: ${device.friendlyName}`);
 * }
 * await platform.release();
 * ```
 */
export class PcscPlatform extends SmartCardPlatform {
  private readers: CardReader[] = [];
  private closedReaders = new Set<string>();
  private errorHandler?: (err: unknown) => void;
  private readerHandler?: (reader: CardReader) => void;
  private operationTimeout: number;
  private securityCapabilities: Map<string, SecurityCapabilities> = new Map();

  constructor(private pcsc: PCSCLite) {
    super();
    this.operationTimeout = DEFAULT_CONFIG.OPERATION_TIMEOUT;
  }

  /**
   * Initialize a reader and detect its capabilities
   * @param reader The reader to initialize
   */
  private async initializeReader(reader: CardReader): Promise<void> {
    const capabilities: SecurityCapabilities = {
      secureChannel: false,
      hardwareEncryption: false,
      securePinEntry: false,
      maxSecureBufferSize: 0,
      secureProtocols: [],
      tamperDetection: false
    };

    try {
      // Check for secure channel support (CCID Verify/Modify PIN)
      const verifyPinCode = reader.SCARD_CTL_CODE(0x01);
      await new Promise<void>(resolve => {
        reader.control(Buffer.alloc(0), verifyPinCode, 0, (err) => {
          if (!err) {
            capabilities.secureChannel = true;
            capabilities.securePinEntry = true;
          }
          resolve();
        });
      });

      // Get reader features
      const getFeatureCode = reader.SCARD_CTL_CODE(0x0D48);
      await new Promise<void>(resolve => {
        reader.control(Buffer.alloc(0), getFeatureCode, 256, (err, response) => {
          if (!err && response) {
            // Parse features from response
            capabilities.hardwareEncryption = (response[0] & 0x01) !== 0;
            capabilities.tamperDetection = (response[0] & 0x02) !== 0;
            capabilities.maxSecureBufferSize = response[1] << 8 | response[2];
            
            // Check supported protocols
            if (response[3] & 0x01) capabilities.secureProtocols.push('scp02');
            if (response[3] & 0x02) capabilities.secureProtocols.push('scp03');
          }
          resolve();
        });
      });

      this.securityCapabilities.set(reader.name, capabilities);
    } catch (error) {
      // Log but don't fail initialization if capability detection fails
      console.debug('Error detecting security capabilities:', error);
    }
  }

  /**
   * Set the timeout for card operations
   * @param timeoutMs Timeout in milliseconds
   * @throws {ValidationError} If timeout is invalid
   */
  public setOperationTimeout(timeoutMs: number): void {
    if (timeoutMs <= 0) {
      throw new ValidationError(
        "Operation timeout must be greater than 0",
        "timeoutMs",
        timeoutMs);
    }
    this.operationTimeout = timeoutMs;
  }

  /**
   * Initialize the PC/SC platform
   * @param options Configuration options
   * @param options.timeout Timeout in milliseconds (default: 10000)
   * @throws {ValidationError} If timeout is invalid
   * @throws {TimeoutError} If initialization times out
   * @throws {SmartCardError} If initialization fails
   */
  public async init(options?: { timeout?: number }): Promise<void> {
    try {
      const timeoutMs = options?.timeout ?? DEFAULT_CONFIG.INIT_TIMEOUT;

      // Validate timeout
      if (timeoutMs <= 0) {
        throw new ValidationError(
          "Timeout must be greater than 0",
          "timeoutMs",
          timeoutMs
        );
      }

      this.assertNotInitialized();
      await this.initWithTimeout(timeoutMs);
    } catch (error) {
      // Cleanup in case of error
      this.removeEventListeners();
      throw error instanceof Error ? error : fromUnknownError(error);
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
        reject((new TimeoutError(
          "PC/SC initialization timed out: No reader found",
          "platform_init",
          timeoutMs
        )) as Error);
      }, timeoutMs);

      this.readerHandler = (reader: CardReader) => {
        reader.on("end", () => {
          const index = this.readers.indexOf(reader);
          this.closedReaders.add(reader.name);
          if (index !== -1) {
            this.readers.splice(index, 1);
          }
        });

        this.readers.push(reader);

        // Initialize reader and detect capabilities
        this.initializeReader(reader)
          .catch(error => {
            // Log but don't fail initialization if capability detection fails
            console.warn(
              "Error detecting reader capabilities:",
              error instanceof Error ? error.message : String(error)
            );
          })
          .finally(() => {
            if (!this.initialized) {
              cleanup();
              this.initialized = true;
              resolve();
            }
          });
      };

      this.errorHandler = (err: unknown) => {
        cleanup();
        reject((err instanceof Error ? err : fromUnknownError(err, "PLATFORM_ERROR")) as Error);
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
            this.closedReaders.add(reader.name);
            await Promise.resolve(reader.close());
          } catch (error) {
            console.warn(
              "Non-critical error closing reader:",
              error instanceof Error ? error.message : String(error)
            );
          }
        })
      );

      // Clear readers array
      this.readers = [];
      this.closedReaders.clear();
      this.securityCapabilities.clear();

      // Remove event listeners
      this.removeEventListeners();

      // Close PCSC
      await Promise.resolve(this.pcsc.close());
      
      this.initialized = false;
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }

  /**
   * Get security capabilities for a specific reader
   * @param readerId The ID of the reader to check
   * @returns Security capabilities of the reader, or undefined if not found
   */
  public getSecurityCapabilities(readerId: string): SecurityCapabilities | undefined {
    return this.securityCapabilities.get(readerId);
  }

  public async getDevices(): Promise<PcscDeviceInfo[]> {
    try {
      this.assertInitialized();
      if (this.readers.length === 0) {
        throw new SmartCardError(
          "NO_READERS",
          "No card readers found. Please connect a smart card reader and try again"
        );
      }

      // Check reader limit
      if (this.readers.length > DEFAULT_CONFIG.MAX_READERS) {
        throw new SmartCardError(
          "RESOURCE_LIMIT",
          `Maximum number of readers (${DEFAULT_CONFIG.MAX_READERS}) exceeded. Please remove some readers and try again`
        );
      }
      
      // Filter out closed readers
      const activeReaders = this.readers.filter(reader => !this.closedReaders.has(reader.name));
      if (activeReaders.length === 0) {
        throw new SmartCardError(
          "READER_UNAVAILABLE",
          "No active readers found. Check if readers are properly connected and powered on"
        );
      }
      await Promise.resolve(); // consume async context
      return activeReaders.map(reader => new PcscDeviceInfo(this, reader));
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }
}

/**
 * Information about a PC/SC smart card reader device
 */
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

  /**
   * Get security capabilities of this device
   * @returns Security capabilities supported by this device
   */
  public getSecurityCapabilities(): SecurityCapabilities | undefined {
    return this.platform instanceof PcscPlatform 
      ? this.platform.getSecurityCapabilities(this.reader.name)
      : undefined;
  }

  public async acquireDevice(): Promise<PcscDevice> {
    if (!this.reader.connected) {
      throw new SmartCardError(
        "READER_ERROR",
        "Reader is not connected. Try reconnecting the reader or checking its power status"
      );
    }
    const device = new PcscDevice(this.platform, this.reader);
    await Promise.resolve(); // Ensure async context
    return device;
  }
}

/**
 * PC/SC smart card reader device implementation
 */
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
        this.release().catch(error => {
          console.error(
            "Error during device cleanup:",
            error instanceof Error ? error.message : String(error)
          );
        });
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
    return this.reader.connected;
  }

  public async isCardPresent(): Promise<boolean> {
    try {
      if (!this.reader.connected) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is not connected. Try reconnecting the reader or checking its power status"
        );
      }

      return await new Promise<boolean>((resolve, reject) => {
        this.reader.get_status((err, state) => {
          if (err) {
            reject((err instanceof Error ? err : fromUnknownError(err, "READER_ERROR")) as Error);
          } else if (typeof state === 'number') {
            resolve((state & this.reader.SCARD_STATE_PRESENT) !== 0);
          } else {
            reject((new SmartCardError("READER_ERROR", "Invalid state returned from reader")) as Error);
          }
        });
      });
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }

  public async startSession(): Promise<Pcsc> {
    try {
      if (!this.reader.connected) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is not connected. Try reconnecting the reader or checking its power status"
        );
      }

      const pcsc = new Pcsc(this);
      await pcsc.connect();
      return pcsc;
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }

  public async release(): Promise<void> {
    try {
      this.removeEventHandlers();
      if (this.reader.connected) {
        await Promise.resolve(this.reader.close());
      }
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }
}

/**
 * PC/SC smart card implementation
 * Provides direct communication with a smart card through PC/SC protocol
 */
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
        this.release().catch(error => {
          console.error(
            "Error during card cleanup:",
            error instanceof Error ? error.message : String(error)
          );
        });
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
          "Card is already connected. Disconnect first before attempting to reconnect"
        );
      }

      if (!this.device.reader.connected) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is not connected. Try reconnecting the reader or checking its power status"
        );
      }

      const protocol = await new Promise<number>((resolve, reject) => {
        this.device.reader.connect(
          { share_mode: this.device.reader.SCARD_SHARE_SHARED },
          (err, protocol) => {
            if (err) {
              reject((err instanceof Error ? err : fromUnknownError(err, "READER_ERROR")) as Error);
            } else if (typeof protocol === 'number') {
              resolve(protocol);
            } else {
              reject((new SmartCardError("READER_ERROR", "Invalid protocol returned from reader")) as Error);
            } 
          },
        );
      });

      this.protocol = protocol;
      this.connected = true;
    } catch (error) {
      this.removeEventHandlers();
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }

  public async getAtr(): Promise<Uint8Array> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card is not connected. Please connect to the card first"
        );
      }

      if (!this.device.reader.connected) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is not connected. Try reconnecting the reader or checking its power status"
        );
      }

      return await new Promise<Uint8Array>((resolve, reject) => {
        this.device.reader.get_status((err, state, atr) => {
          if (err) {
            reject((err instanceof Error ? err : fromUnknownError(err, "READER_ERROR")) as Error);
          } else if (atr) {
            resolve(new Uint8Array(atr));
          } else {
            reject((new SmartCardError(
              "READER_ERROR", 
              "Failed to read card ATR. The card may be malfunctioning or improperly inserted"
            )) as Error);
          }
        });
      });
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }

  public async transmit(apdu: CommandApdu): Promise<ResponseApdu> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card is not connected. Please connect to the card first"
        );
      }

      if (!this.device.reader.connected) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is not connected. Try reconnecting the reader or checking its power status"
        );
      }

      // Validate APDU command
      if (!apdu || !(apdu instanceof CommandApdu)) {
        throw new ValidationError(
          "Invalid APDU command",
          "apdu",
          apdu
        );
      }

      const apduData = apdu.toUint8Array();
      if (apduData.length === 0) {
        throw new ValidationError(
          "APDU command cannot be empty",
          "apdu",
          apdu
        );
      }

      return await withRetry(async () => new Promise<ResponseApdu>((resolve, reject) => {
        this.device.reader.transmit(
          Buffer.from(apduData),
          DEFAULT_CONFIG.MAX_RESPONSE_LENGTH,
          this.protocol,
          (err, res) => {
            if (err) {
              reject((err instanceof Error ? err : fromUnknownError(err, "TRANSMISSION_ERROR")) as Error);
            } else if (res) {
              resolve(ResponseApdu.fromUint8Array(new Uint8Array(res)));
            } else {
              reject((new SmartCardError("TRANSMISSION_ERROR", "No response received from card")) as Error);
            }
          },
        );
      }));
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }

  public async reset(): Promise<void> {
    try {
      if (!this.connected) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "Card is not connected. Please connect to the card first"
        );
      }

      if (!this.device.reader.connected) {
        throw new SmartCardError(
          "READER_ERROR",
          "Reader is not connected. Try reconnecting the reader or checking its power status"
        );
      }

      await withRetry(async () => new Promise<void>((resolve, reject) => {
        this.device.reader.disconnect(
          this.device.reader.SCARD_RESET_CARD,
          (err) => {
            if (err) {
              reject((err instanceof Error ? err : fromUnknownError(err, "READER_ERROR")) as Error);
            } else {
              resolve();
            }
          },
        );
      }));
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }

  public async release(): Promise<void> {
    try {
      if (!this.connected) {
        return;
      }

      this.removeEventHandlers();
      this.connected = false;

      if (this.device.reader.connected) {
        await withRetry(async () => new Promise<void>((resolve, reject) => {
          this.device.reader.disconnect(
            this.device.reader.SCARD_LEAVE_CARD,
            (err) => {
              if (err) {
                reject((err instanceof Error ? err : fromUnknownError(err, "READER_ERROR")) as Error);
              } else {
                resolve();
              }
            },
          );
        }));
      }
    } catch (error) {
      throw error instanceof Error ? error : fromUnknownError(error);
    }
  }
}

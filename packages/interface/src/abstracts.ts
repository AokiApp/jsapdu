import { CommandApdu, ResponseApdu } from "./apdu/index.js";
import {
  SmartCardError,
  fromUnknownError,
} from "./errors.js";

/**
 * Platform manager for SmartCard R/W
 */
export abstract class SmartCardPlatformManager {
  abstract getPlatform(): SmartCardPlatform;
}

/**
 * Abstracted SmartCard R/W platform such as WinSCard, PC/SC, Core NFC, Android NFC Support, Bluetooth LE Reader, WebUSB, WebNFC, etc
 * @abstract
 * @class
 * @name Context
 */
export abstract class SmartCardPlatform {
  /**
   * Indicates if the platform is initialized
   * @readonly
   */
  protected initialized: boolean = false;

  /**
   * @constructor
   */
  protected constructor() {}

  /**
   * Initialize the platform
   * @throws {SmartCardError} If initialization fails or platform is already initialized
   */
  public abstract init(): Promise<void>;

  /**
   * Release the platform
   * @throws {SmartCardError} If release fails or platform is not initialized
   */
  public abstract release(): Promise<void>;

  /**
   * Get whether the platform is initialized or not
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Asserts if the platform is initialized
   * @throws {SmartCardError} If the platform is not initialized
   * @protected
   */
  protected assertInitialized() {
    if (!this.initialized) {
      throw new SmartCardError(
        "NOT_INITIALIZED",
        "Platform not initialized"
      );
    }
  }

  /**
   * Asserts if the platform is not initialized
   * @throws {SmartCardError} If the platform is initialized
   * @protected
   */
  protected assertNotInitialized() {
    if (this.initialized) {
      throw new SmartCardError(
        "ALREADY_INITIALIZED",
        "Platform already initialized"
      );
    }
  }

  /**
   * asyncDispose, use in conjunction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    try {
      this.assertInitialized();
      await this.release();
    } catch (error) {
      throw fromUnknownError(error);
    }
  }

  /**
   * Get devices
   * @throws {SmartCardError} If platform is not initialized or operation fails
   */
  public abstract getDevices(): Promise<SmartCardDeviceInfo[]>;
}

export abstract class SmartCardDeviceInfo {
  protected constructor() {}

  /**
   * Identifier of the device
   * Unique within the platform
   * Used to identify the device when connecting
   */
  public abstract readonly id: string;

  /**
   * Hardware path of the device if available
   * use for reference, not for display or identification
   */
  public abstract readonly devicePath?: string;

  /**
   * Friendly name of the device
   * Used for display purposes
   */
  public abstract readonly friendlyName?: string;

  /**
   * Device description
   * Used for display purposes
   */
  public abstract readonly description?: string;

  /**
   * Supports APDU R/W operations
   */
  public abstract readonly supportsApdu: boolean;

  /**
   * Supports Host Card Emulation
   */
  public abstract readonly supportsHce: boolean;

  /**
   * The device is an integrated reader (phone inside)
   */
  public abstract readonly isIntegratedDevice: boolean;

  /**
   * The device is a removable reader (usb, bluetooth, etc)
   */
  public abstract readonly isRemovableDevice: boolean;

  /**
   * D2C (Device to Card) communication
   */
  public abstract readonly d2cProtocol:
    | "iso7816" // ISO 7816 (Contact)
    | "nfc" // NFC (Contactless)
    | "other" // Other
    | "unknown"; // Unknown

  /**
   * P2D (Platform to Device) communication
   */
  public abstract readonly p2dProtocol:
    | "usb" // USB CCID
    | "ble" // Bluetooth LE
    | "nfc" // NFC
    | "other" // Other
    | "unknown"; // Unknown

  /**
   * API type of APDU communication
   * provided by the specific platform implementation
   * Supports nested protocol (e.g. BLE over WebUSB)
   */
  public abstract readonly apduApi: ApduApi[];

  /**
   * Acquire the device
   * @throws {SmartCardError} If device acquisition fails
   */
  public abstract acquireDevice(): Promise<SmartCardDevice>;
}

/**
 * APDU Platform API type
 */
type ApduApi = string;

/**
 * SmartCard Device
 */
export abstract class SmartCardDevice {
  /**
   * @constructor
   */
  protected constructor(
    protected parentPlatform: SmartCardPlatform,
    protected deviceInfo: SmartCardDeviceInfo,
  ) {}

  /**
   * Get the device information of itself
   */
  public abstract getDeviceInfo(): SmartCardDeviceInfo;

  /**
   * Whether acquired device session is active or not
   */
  public abstract isActive(): boolean;

  /**
   * Check if the card is present
   * @throws {SmartCardError} If check fails
   */
  public abstract isCardPresent(): Promise<boolean>;

  /**
   * Start communication session with the card
   * @throws {SmartCardError} If session start fails
   */
  public abstract startSession(): Promise<SmartCard>;

  /**
   * Release the device
   * @throws {SmartCardError} If release fails
   */
  public abstract release(): Promise<void>;

  /**
   * asyncDispose, use in conjunction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    try {
      await this.release();
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
}

export abstract class SmartCard {
  /**
   * @constructor
   */
  protected constructor(protected parentDevice: SmartCardDevice) {}

  /**
   * Get ATR (Answer To Reset) or equivalent such as ATS (Answer To Select)
   * @throws {SmartCardError} If operation fails
   */
  public abstract getAtr(): Promise<Atr>;

  /**
   * Transmit APDU command to the card
   * @throws {SmartCardError} If transmission fails
   * @throws {ValidationError} If command is invalid
   */
  public abstract transmit(apdu: CommandApdu): Promise<ResponseApdu>;

  /**
   * Reset the card
   * @throws {SmartCardError} If reset fails
   */
  public abstract reset(): Promise<void>;

  /**
   * Release the session
   * @throws {SmartCardError} If release fails
   */
  public abstract release(): Promise<void>;

  /**
   * asyncDispose, use in conjunction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    try {
      await this.release();
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
}

type Atr = Uint8Array;

export abstract class EmulatedCard {
  /**
   * @constructor
   */
  protected constructor(private parentDevice: SmartCardDevice) {}

  /**
   * Whether acquired device session is active or not
   */
  public abstract isActive(): boolean;

  /**
   * Set APDU handler
   * @throws {SmartCardError} If setting handler fails
   */
  public abstract setApduHandler(
    handler: (command: Uint8Array) => Promise<Uint8Array>,
  ): Promise<void>;

  /**
   * Set state change handler
   * @throws {SmartCardError} If setting handler fails
   */
  public abstract setStateChangeHandler(
    handler: (state: EmulatedCardState) => void,
  ): Promise<void>; // todo: consider using event emitter

  /**
   * Release the session
   * @throws {SmartCardError} If release fails
   */
  public abstract release(): Promise<void>;

  /**
   * asyncDispose, use in conjunction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    try {
      await this.release();
    } catch (error) {
      throw fromUnknownError(error);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type EmulatedCardState = "disconnected" | string; // todo: def

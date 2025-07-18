import { CommandApdu, ResponseApdu } from "./apdu/index.js";
import { SmartCardError, fromUnknownError } from "./errors.js";

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
   * Release the platform and all acquired devices
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
   */
  public assertInitialized() {
    if (!this.initialized) {
      throw new SmartCardError("NOT_INITIALIZED", "Platform not initialized");
    }
  }

  /**
   * Asserts if the platform is not initialized
   * @throws {SmartCardError} If the platform is initialized
   */
  public assertNotInitialized() {
    if (this.initialized) {
      throw new SmartCardError(
        "ALREADY_INITIALIZED",
        "Platform already initialized",
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
  public abstract getDeviceInfo(): Promise<SmartCardDeviceInfo[]>;

  /**
   * Acquire a device by its ID
   * Even if the device has not inserted the card, it is considered acquirable
   * Note: Don't forget to add the device to the platform's devices list after acquiring it
   * @returns {Promise<SmartCardDevice>} Acquired device instance
   * @param id - Device ID to acquire
   * @throws {SmartCardError} If the following:
   * - Platform is not initialized
   * - Device with the given ID does not exist
   * - Device is already acquired
   * - Device is not available
   * - Device is not supported by the platform
   * - Any other error occurs during acquisition
   */
  public abstract acquireDevice(id: string): Promise<SmartCardDevice>;
}

/**
 * A data class representing SmartCard device information
 * The information is informational only and does not provide any methods
 * It is used to display device information in the UI or for identification purposes
 */
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
}

/**
 * APDU Platform API type
 * provided by the specific platform implementation
 * @example "pcsc" (PC/SC)
 * @example "winscard" (WinSCard)
 * @example "corenfc" (Core NFC)
 * @example "androidnfc" (Android NFC Support)
 * @example "ble" (Bluetooth LE Reader)
 * @example "custom-driver" (Custom driver)
 * @example "webusb" (WebUSB)
 */
type ApduApi = string;

/**
 * SmartCard Device
 */
export abstract class SmartCardDevice {
  /**
   * @constructor
   */
  protected constructor(protected parentPlatform: SmartCardPlatform) {
    this.parentPlatform.assertInitialized();
  }

  /**
   * Card acquired by the device
   */
  protected card: SmartCard | EmulatedCard | null = null;

  /**
   * Get the device information of itself
   */
  public abstract getDeviceInfo(): SmartCardDeviceInfo;

  /**
   * Whether acquired device has already started a session or not
   */
  public abstract isSessionActive(): boolean;

  /**
   * Whether acquired device is available or not
   * It must be callable regardless of any of: card presense, existing card session, any other prerequisites
   * It returns true if the device is available, false otherwise
   * It also returns true if the device is already in a session, since it is available
   */
  public abstract isDeviceAvailable(): Promise<boolean>;

  /**
   * Check if the card is present
   * It must be callable regardless of any of: card presense, existing card session, any other prerequisites
   * Do check card presense without locking any resources
   * It doesn't need to be TOCTTOU-resistant
   * @throws {SmartCardError} If check fails
   */
  public abstract isCardPresent(): Promise<boolean>;

  /**
   * Start communication session with the card
   * This method works in non-blocking manner
   * If the card is not present, it will throw an error immediately
   * Don't be blocking -- wait while the card is present, since this function is non-blocking
   * @throws {SmartCardError} If session start fails
   */
  public abstract startSession(): Promise<SmartCard>;

  /**
   * Wait for the card to be present
   * This method is blocking and will wait until the card is present.
   * After the card is present, it will return immediately. You are expected to call `startSession` after this method.
   * If platform supports card presence detection except for polling, it should be implemented in this method.
   * @param timeout - Timeout in milliseconds. It is required to prevent infinite waiting
   * @throws {SmartCardError} If timeout is reached or card is not present
   */
  public abstract waitForCardPresence(timeout: number): Promise<void>;

  /**
   * Start HCE session
   */
  public abstract startHceSession(): Promise<EmulatedCard>;
  /**
   * Release the device and its card session
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
  protected constructor(protected parentDevice: SmartCardDevice) {}

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

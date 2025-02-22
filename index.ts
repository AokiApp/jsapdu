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
  private constructor() {}

  /**
   * Initialize the platform
   */
  public abstract init(): Promise<void>;

  /**
   * Release the platform
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
   * @throws {Error} If the platform is not initialized
   * @protected
   */
  protected assertInitialized() {
    if (!this.initialized) {
      throw new Error("Platform not initialized");
    }
  }

  /**
   * Asserts if the platform is not initialized
   * @throws {Error} If the platform is initialized
   * @protected
   */
  protected assertNotInitialized() {
    if (this.initialized) {
      throw new Error("Platform already initialized");
    }
  }

  /**
   * asyncDispose, use in conjuction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    this.assertInitialized();
    await this.release();
  }

  /**
   * Get devices
   */
  public abstract getDevices(): Promise<SmartCardDeviceInfo[]>;
}

export abstract class SmartCardDeviceInfo {
  private constructor() {}

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
   */
  public abstract acquireDevice(): Promise<SmartCardDevice>;
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
  private constructor(
    private parentPlatform: SmartCardPlatform,
    private deviceInfo: SmartCardDeviceInfo
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
   */
  public abstract isCardPresent(): Promise<boolean>;

  /**
   * Start communication session with the card
   */
  public abstract startSession(): Promise<SmartCard>;

  /**
   * Start HCE session
   */
  public abstract startHceSession(): Promise<EmulatedCard>;

  /**
   * Release the device
   */
  public abstract release(): Promise<void>;

  /**
   * asyncDispose, use in conjuction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    await this.release();
  }
}

export abstract class SmartCard {
  /**
   * @constructor
   */
  private constructor(private parentDevice: SmartCardDevice) {}

  /**
   * Get ATR (Answer To Reset) or equivalent such as ATS (Answer To Select)
   */
  public abstract getAtr(): Promise<Atr>;

  /**
   * Transmit APDU command to the card
   */
  public abstract transmit(apdu: CommandApdu): Promise<ResponseApdu>;

  /**
   * Reset the card
   */
  public abstract reset(): Promise<void>;

  /**
   * Release the session
   */
  public abstract release(): Promise<void>;

  /**
   * asyncDispose, use in conjuction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    await this.release();
  }
}

type Atr = Uint8Array;

export class CommandApdu {
  constructor(
    public readonly cla: Byte,
    public readonly ins: Byte,
    public readonly p1p2: Short,
    public readonly data?: Uint8Array,
    public readonly le?: number
  ) {
    if (!isByte(cla) || !isByte(ins) || !isShort(p1p2)) {
      throw new Error("Invalid APDU");
    }
  }

  /**
   * From Hex String
   * Hex string can contain spaces
   */
  public static fromHexString(hex: string): CommandApdu {
    const hexStr = hex.replace(/\s/g, "");
    const bytes = new Uint8Array(hexStr.length / 2);
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
    }
    return this.fromBytes(bytes);
  }

  /**
   * From Bytes
   */
  public static fromBytes(bytes: Uint8Array): CommandApdu {
    if (bytes.length < 4) {
      throw new Error("Invalid APDU length");
    }
    const cla = bytes[0];
    const ins = bytes[1];
    const p1 = bytes[2];
    const p2 = bytes[3];
    const data = bytes.length > 4 ? bytes.subarray(4) : undefined;
    const le = data ? data[data.length - 1] : undefined;
    return new CommandApdu(cla, ins, (p1 << 8) | p2, data, le);
  }

  /**
   * To Bytes
   */
  public toBytes(): Uint8Array {
    throw new Error("Not implemented");
  }

  // impl other necessary methods
}

export class ResponseApdu {
  constructor(
    public readonly data: Uint8Array, // Data field. If empty, set []
    public readonly sw1: Byte,
    public readonly sw2: Byte
  ) {
    if (!isByte(sw1) || !isByte(sw2)) {
      throw new Error("Invalid APDU");
    }
  }

  /**
   * To Bytes
   */
  public toBytes(): Uint8Array {
    throw new Error("Not implemented");
  }

  public isSuccess() {
    return this.sw1 === 0x90 && this.sw2 === 0x00;
  }
  // impl other necessary methods
}

type Byte = number;
function isByte(value: unknown): value is Byte {
  return (
    typeof value === "number" && value % 1 === 0 && value >= 0 && value <= 255
  );
}

type Short = number;
function isShort(value: unknown): value is Short {
  // check it is not a floating point number
  // and it is within 0 to 65535
  return (
    typeof value === "number" && value % 1 === 0 && value >= 0 && value <= 65535
  );
}

export abstract class EmulatedCard {
  /**
   * @constructor
   */
  private constructor(private parentDevice: SmartCardDevice) {}

  /**
   * Whether acquired device session is active or not
   */
  public abstract isActive(): boolean;

  /**
   * Set APDU handler
   */
  public abstract setApduHandler(
    handler: (command: CommandApdu) => Promise<ResponseApdu>
  ): Promise<void>;

  public abstract setStateChangeHandler(
    handler: (state: EmulatedCardState) => void
  ): Promise<void>;

  /**
   * Release the session
   */
  public abstract release(): Promise<void>;

  /**
   * asyncDispose, use in conjuction with `await using`
   */
  public async [Symbol.asyncDispose]() {
    await this.release();
  }
}

type EmulatedCardState = "disconnected";

import { SmartCardDeviceInfo } from "@aokiapp/jsapdu-interface";

/**
 * Implementation of SmartCardDeviceInfo for PC/SC
 * Provides information about a PC/SC smart card reader
 */
export class PcscDeviceInfo extends SmartCardDeviceInfo {
  /**
   * Creates a new PcscDeviceInfo instance
   * @param readerName - The name of the reader as returned by PC/SC
   */
  constructor(private readerName: string) {
    super();
  }

  /**
   * Identifier of the device
   * For PC/SC, this is the reader name
   */
  public get id(): string {
    return this.readerName;
  }

  /**
   * Hardware path of the device if available
   * PC/SC doesn't provide a hardware path, so this is undefined
   */
  public get devicePath(): string | undefined {
    return undefined;
  }

  /**
   * Friendly name of the device
   * For PC/SC, this is the reader name
   */
  public get friendlyName(): string | undefined {
    return this.readerName;
  }

  /**
   * Device description
   * For PC/SC, this is the reader name
   */
  public get description(): string | undefined {
    return this.readerName;
  }

  /**
   * Supports APDU R/W operations
   * PC/SC readers always support APDU operations
   */
  public get supportsApdu(): boolean {
    return true;
  }

  /**
   * Supports Host Card Emulation
   * PC/SC readers typically don't support HCE
   */
  public get supportsHce(): boolean {
    return false;
  }

  /**
   * The device is an integrated reader (phone inside)
   * PC/SC readers are typically external devices
   */
  public get isIntegratedDevice(): boolean {
    return false;
  }

  /**
   * The device is a removable reader (usb, bluetooth, etc)
   * PC/SC readers are typically removable devices
   */
  public get isRemovableDevice(): boolean {
    return true;
  }

  /**
   * D2C (Device to Card) communication
   * PC/SC readers typically use ISO 7816 (Contact) or NFC (Contactless)
   * We determine this based on the reader name
   */
  public get d2cProtocol(): "iso7816" | "nfc" | "other" | "unknown" {
    const readerNameLower = this.readerName.toLowerCase();

    if (
      readerNameLower.includes("contactless") ||
      readerNameLower.includes("nfc") ||
      readerNameLower.includes("acr122")
    ) {
      return "nfc";
    } else if (
      readerNameLower.includes("contact") ||
      readerNameLower.includes("smart card") ||
      readerNameLower.includes("smartcard")
    ) {
      return "iso7816";
    } else {
      return "unknown";
    }
  }

  /**
   * P2D (Platform to Device) communication
   * PC/SC readers typically use USB
   */
  public get p2dProtocol(): "usb" | "ble" | "nfc" | "other" | "unknown" {
    return "usb";
  }

  /**
   * API type of APDU communication
   * For PC/SC, this is "pcsc"
   */
  public get apduApi(): string[] {
    return ["pcsc"];
  }
}

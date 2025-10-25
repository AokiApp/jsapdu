import { SmartCardDeviceInfo } from '@aokiapp/jsapdu-interface';
import type { DeviceInfo } from '../JsapduRn.nitro';

/**
 * React Native NFC device information implementation
 *
 * @remarks
 * This class wraps device information from the native layer
 * and provides a type-safe interface for device capabilities.
 *
 * For Android NFC implementation:
 * - id: "integrated-nfc-0" (example, not fixed)
 * - apduApi: ["nfc", "androidnfc"] (both included)
 * - supportsHce: false (initial version)
 * - isIntegratedDevice: true
 * - isRemovableDevice: false
 * - d2cProtocol: "nfc"
 * - p2dProtocol: "nfc"
 *
 * @example
 * ```typescript
 * const devices = await platform.getDeviceInfo();
 * const device = devices[0];
 *
 * console.log('Device ID:', device.id);
 * console.log('Supports APDU:', device.supportsApdu);
 * console.log('API:', device.apduApi.join(', '));
 * ```
 */
export class RnDeviceInfo extends SmartCardDeviceInfo {
  /**
   * Unique device identifier
   * Example: "integrated-nfc-0"
   */
  public readonly id: string;

  /**
   * Hardware path of the device (optional)
   * For NFC, this is typically undefined
   */
  public readonly devicePath?: string;

  /**
   * Human-readable device name (optional)
   * Example: "Integrated NFC Reader"
   */
  public readonly friendlyName?: string;

  /**
   * Device description (optional)
   * Example: "Built-in NFC reader for contactless cards"
   */
  public readonly description?: string;

  /**
   * Whether device supports APDU read/write operations
   * Always true for NFC devices
   */
  public readonly supportsApdu: boolean;

  /**
   * Whether device supports Host Card Emulation
   * false in initial version
   */
  public readonly supportsHce: boolean;

  /**
   * Whether device is integrated into the phone
   * true for built-in NFC reader
   */
  public readonly isIntegratedDevice: boolean;

  /**
   * Whether device is removable (USB, Bluetooth, etc.)
   * false for built-in NFC reader
   */
  public readonly isRemovableDevice: boolean;

  /**
   * Device-to-Card communication protocol
   * "nfc" for contactless NFC communication
   */
  public readonly d2cProtocol: 'iso7816' | 'nfc' | 'other' | 'unknown';

  /**
   * Platform-to-Device communication protocol
   * "nfc" for integrated NFC reader
   */
  public readonly p2dProtocol: 'usb' | 'ble' | 'nfc' | 'other' | 'unknown';

  /**
   * APDU API identifiers
   * Android returns: ["nfc", "androidnfc"]
   * Both values are included for FFI neutrality
   */
  public readonly apduApi: string[];

  /**
   * Construct device info from native layer data
   * @param info - Device information from native layer
   */
  constructor(info: DeviceInfo) {
    super();
    this.id = info.id;
    this.devicePath = info.devicePath;
    this.friendlyName = info.friendlyName;
    this.description = info.description;
    this.supportsApdu = info.supportsApdu;
    this.supportsHce = info.supportsHce;
    this.isIntegratedDevice = info.isIntegratedDevice;
    this.isRemovableDevice = info.isRemovableDevice;
    this.d2cProtocol = info.d2cProtocol;
    this.p2dProtocol = info.p2dProtocol;
    this.apduApi = info.apduApi;
  }
}

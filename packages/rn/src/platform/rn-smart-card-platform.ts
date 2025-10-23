import {
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
  SmartCardError,
} from '@aokiapp/jsapdu-interface';
import { NitroModules } from 'react-native-nitro-modules';
import type { JsapduRn } from '../JsapduRn.nitro';
import { mapNitroError } from '../errors/error-mapper';
import { RnDeviceInfo } from '../device/rn-device-info';
import { RnSmartCardDevice } from '../device/rn-smart-card-device';
import { PlatformState } from './platform-state';

/**
 * React Native NFC SmartCard platform implementation
 * This is the only class that holds the Nitro HybridObject instance
 *
 * @remarks
 * This implementation follows the FFI-neutral design principles:
 * - No OS-specific terminology in public APIs
 * - ReaderMode is abstracted as "RF activation" (internal)
 * - IsoDep is abstracted as "ISO-DEP session" (internal)
 *
 * @example
 * ```typescript
 * const platform = new RnSmartCardPlatform();
 * await platform.init();
 *
 * const devices = await platform.getDeviceInfo();
 * if (devices.length > 0) {
 *   const device = await platform.acquireDevice(devices[0].id);
 *   // Use device...
 *   await device.release();
 * }
 *
 * await platform.release();
 * ```
 */
export class RnSmartCardPlatform extends SmartCardPlatform {
  private hybridObject: JsapduRn;
  private acquiredDevices: Map<string, RnSmartCardDevice> = new Map();
  private state: PlatformState = new PlatformState();

  constructor() {
    super();
    this.hybridObject = NitroModules.createHybridObject<JsapduRn>('JsapduRn');
  }

  /**
   * Get the Nitro HybridObject instance
   * Used by child objects (Device, Card) to access native methods
   *
   * @internal
   * @returns The underlying Nitro HybridObject instance
   */
  public getHybridObject(): JsapduRn {
    return this.hybridObject;
  }

  /**
   * Initialize the NFC platform
   *
   * @throws {SmartCardError} with code "ALREADY_INITIALIZED" if already initialized
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if NFC is not supported or initialization fails
   *
   * @remarks
   * Preconditions:
   * - Platform must not be initialized
   * - NFC permission must be granted
   * - Host manifest must declare NFC permission and feature
   *
   * Postconditions:
   * - Platform initialized
   * - Ready for device acquisition (RF activation preparation complete)
   *
   * @see {@link https://developer.android.com/reference/android/nfc/NfcAdapter#enableReaderMode | Android ReaderMode}
   */
  public async init(): Promise<void> {
    this.assertNotInitialized();

    try {
      await this.hybridObject.initPlatform();
      this.initialized = true;
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  /**
   * Release the NFC platform and all acquired devices
   *
   * @throws {SmartCardError} with code "NOT_INITIALIZED" if not initialized
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if release fails
   *
   * @remarks
   * Preconditions:
   * - Platform must be initialized
   *
   * Postconditions:
   * - All acquired devices are released
   * - ReaderMode preparation is cleared
   * - Platform is uninitialized
   *
   * This method is idempotent for device release errors.
   * Device release failures are suppressed to ensure platform cleanup.
   */
  public async release(): Promise<void> {
    this.assertInitialized();

    // Prevent concurrent release calls
    if (this.state.isReleasing) {
      return;
    }

    this.state.setReleasing(true);

    try {
      // Release all acquired devices in parallel
      const releasePromises = Array.from(this.acquiredDevices.values()).map(
        (device) =>
          device.release().catch((error) => {
            // Log but don't throw to ensure platform cleanup continues
            console.warn(
              `Failed to release device ${device.getDeviceInfo().id}:`,
              error
            );
          })
      );

      await Promise.all(releasePromises);
      this.acquiredDevices.clear();

      // Release platform
      await this.hybridObject.releasePlatform();
      this.initialized = false;
    } catch (error) {
      throw mapNitroError(error);
    } finally {
      this.state.setReleasing(false);
    }
  }

  /**
   * Get available NFC device information
   *
   * @returns Array of device information (0 or 1 for integrated NFC, 0 for non-NFC devices)
   * @throws {SmartCardError} with code "NOT_INITIALIZED" if not initialized
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if enumeration fails
   *
   * @remarks
   * Current acceptance criteria:
   * - Returns 0 or 1 device (integrated NFC reader only)
   * - Non-NFC devices return 0 devices
   * - Future: May support multiple devices (e.g., BLE readers)
   *
   * Device ID example: "integrated-nfc-0" (not fixed)
   * Public schema matches interface definition, no additional fields
   *
   * Android implementation returns:
   * - apduApi: ["nfc", "androidnfc"] (both included)
   * - supportsHce: false (initial version)
   */
  public async getDeviceInfo(): Promise<SmartCardDeviceInfo[]> {
    this.assertInitialized();

    try {
      const deviceInfos = await this.hybridObject.getDeviceInfo();
      return deviceInfos.map((info) => new RnDeviceInfo(info));
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  /**
   * Acquire a device by its ID and activate RF
   *
   * @param id - Device identifier from getDeviceInfo()
   * @returns SmartCardDevice instance
   * @throws {SmartCardError} with code "NOT_INITIALIZED" if not initialized
   * @throws {SmartCardError} with code "ALREADY_CONNECTED" if device is already acquired
   * @throws {SmartCardError} with code "READER_ERROR" if device ID is invalid
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if acquisition fails
   *
   * @remarks
   * Preconditions:
   * - Platform must be initialized
   * - Device ID must exist in getDeviceInfo() results
   * - Device must not be already acquired
   *
   * Postconditions:
   * - ReaderMode is enabled (RF activated)
   * - Device is in acquired state
   *
   * Non-NFC devices (when required=false):
   * - Returns "PLATFORM_ERROR" at acquisition
   *
   * Extended APDU unsupported devices:
   * - Returns "PLATFORM_ERROR" at acquisition (cutoff policy)
   */
  public async acquireDevice(id: string): Promise<SmartCardDevice> {
    this.assertInitialized();

    if (this.acquiredDevices.has(id)) {
      throw new SmartCardError(
        'ALREADY_CONNECTED',
        `Device ${id} is already acquired`
      );
    }

    try {
      // Acquire device handle from native side
      const deviceHandle = await this.hybridObject.acquireDevice(id);

      // Fetch device info to construct RnDeviceInfo
      const deviceInfos = await this.hybridObject.getDeviceInfo();
      const deviceInfo = deviceInfos.find((info) => info.id === id);

      if (!deviceInfo) {
        throw new SmartCardError(
          'READER_ERROR',
          `Device ${id} not found in device list`
        );
      }

      // Create device instance
      const device = new RnSmartCardDevice(
        this,
        deviceHandle,
        new RnDeviceInfo(deviceInfo)
      );

      // Track acquired device
      this.acquiredDevices.set(id, device);
      return device;
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  /**
   * Remove device from acquired devices tracking
   * Called internally by RnSmartCardDevice.release()
   *
   * @internal
   * @param deviceId - Device ID to untrack
   */
  public untrackDevice(deviceId: string): void {
    this.acquiredDevices.delete(deviceId);
  }
}

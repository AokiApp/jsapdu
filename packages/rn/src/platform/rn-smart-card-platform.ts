import {
  SmartCardDevice,
  SmartCardPlatform,
  SmartCardError,
} from '@aokiapp/jsapdu-interface';
import { NitroModules } from 'react-native-nitro-modules';
import type { JsapduRn } from '../JsapduRn.nitro';
import { mapNitroError } from '../errors/error-mapper';
import { RnDeviceInfo } from '../device/rn-device-info';
import { RnSmartCardDevice } from '../device/rn-smart-card-device';
import { PlatformState } from './platform-state';
import type { EventPayload } from '../JsapduRn.nitro';
import type { DeviceEventType } from '../device/rn-smart-card-device';
import type { CardEventType } from '../card/rn-smart-card';
import type { Deferred } from '../utils/deferred';

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
export type PlatformEventType =
  | 'PLATFORM_INITIALIZED'
  | 'DEVICE_ACQUIRED'
  | 'DEVICE_RELEASED'
  | 'CARD_FOUND'
  | 'CARD_LOST'
  | 'CARD_SESSION_STARTED'
  | 'CARD_SESSION_RESET'
  | 'WAIT_TIMEOUT'
  | 'APDU_SENT'
  | 'APDU_FAILED'
  | 'READER_MODE_ENABLED'
  | 'READER_MODE_DISABLED'
  | 'DEBUG_INFO'
  | 'PLATFORM_RELEASED';

export type PlatformEventPayload = EventPayload;

export class RnSmartCardPlatform extends SmartCardPlatform<{
  [key in PlatformEventType]: (payload: PlatformEventPayload) => void;
}> {
  private hybridObject: JsapduRn;
  private acquiredDevices: Map<string, RnSmartCardDevice> = new Map();
  private state: PlatformState = new PlatformState();
  private platformReleaseDeferred: Deferred<void> | null = null;

  constructor() {
    super();
    this.hybridObject = NitroModules.createHybridObject<JsapduRn>('JsapduRn');
    const ee = this.getEventEmitter();
    ee.on('PLATFORM_RELEASED', (payload: PlatformEventPayload) => {
      this.onNativePlatformReleased(payload);
    });

    ee.on('PLATFORM_INITIALIZED', (_payload: PlatformEventPayload) => {
      this.initialized = true;
    });
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
   * Internal EventEmitter accessor
   * @internal
   */
  public getEventEmitter() {
    return this.eventEmitter;
  }

  /**
   * Two-hop device lookup by deviceHandle
   * @internal
   */
  public getTarget(deviceHandle: string): RnSmartCardDevice | undefined {
    for (const device of this.acquiredDevices.values()) {
      if (device.getDeviceHandle() === deviceHandle) {
        return device;
      }
    }
    return undefined;
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
  public async init(force: boolean = false): Promise<void> {
    if (!force) {
      this.assertNotInitialized();
    }
    try {
      // Register status callback before initialization to capture early events
      this.hybridObject.onStatusUpdate(this.statusUpdateHandler.bind(this));
      if (force) {
        await this.hybridObject.initPlatform(true);
      } else {
        await this.hybridObject.initPlatform();
      }
      this.initialized = true;
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  private statusUpdateHandler(eventType: string, payload: EventPayload): void {
    const evt = eventType as PlatformEventType;

    // Define event routing policy:
    // - Platform-only: Emit only on platform
    // - Device-level: Emit only on the target device
    // - Card-level: Emit only on the target card
    const platformOnly = new Set<PlatformEventType>([
      'PLATFORM_INITIALIZED',
      'PLATFORM_RELEASED',
      'DEVICE_ACQUIRED',
    ]);

    const sharedPlatformEvents = new Set<PlatformEventType>([
      'READER_MODE_ENABLED',
      'READER_MODE_DISABLED',
    ]);

    // Include DEVICE_ACQUIRED so device can observe acquisition lifecycle
    const deviceEvents = new Set<PlatformEventType>([
      'DEVICE_RELEASED',
      'CARD_FOUND',
      'CARD_LOST',
      'CARD_SESSION_STARTED',
      'CARD_SESSION_RESET',
      'WAIT_TIMEOUT',
      'READER_MODE_ENABLED',
      'READER_MODE_DISABLED',
      'DEBUG_INFO',
    ]);

    // Card-specific events (do not bubble to device/platform)
    const cardEvents = new Set<PlatformEventType>([
      'CARD_SESSION_RESET',
      'CARD_LOST',
      'APDU_SENT',
      'APDU_FAILED',
      'DEBUG_INFO',
    ]);

    // Platform-only events
    if (platformOnly.has(evt)) {
      this.eventEmitter.emit(evt, payload);
      return;
    }

    if (sharedPlatformEvents.has(evt)) {
      this.eventEmitter.emit(evt, payload);
    }

    const { deviceHandle, cardHandle } = payload;

    // Card-level events take precedence when both handles are present
    if (cardEvents.has(evt)) {
      if (deviceHandle && cardHandle) {
        const device = this.getTarget(deviceHandle);
        const card = device?.getTarget(cardHandle);
        if (card) {
          card.getEventEmitter().emit(evt as unknown as CardEventType, payload);
          return;
        } else {
          console.warn(
            `[RnSmartCardPlatform] Card target not found for ${eventType}. device=${deviceHandle}, card=${cardHandle}, details=${payload.details}`
          );
          // fall through to device-level handling if possible
        }
      } else {
        console.warn(
          `[RnSmartCardPlatform] Missing handles for card event ${eventType}. device=${deviceHandle}, card=${cardHandle}`
        );
        // fall through to device-level handling if possible
      }
    }

    // Device-level events
    if (deviceEvents.has(evt)) {
      if (deviceHandle) {
        const device = this.getTarget(deviceHandle);
        if (device) {
          device
            .getEventEmitter()
            .emit(evt as unknown as DeviceEventType, payload);
          return;
        } else {
          console.warn(
            `[RnSmartCardPlatform] Device target not found for ${eventType}. device=${deviceHandle}, details=${payload.details}`
          );
          return;
        }
      } else {
        console.warn(
          `[RnSmartCardPlatform] Missing deviceHandle for device event ${eventType}.`
        );
        return;
      }
    }

    // Unknown or future events: keep non-fatal
    console.debug(
      `[RnSmartCardPlatform] Unhandled event ${eventType}. payload=${JSON.stringify(payload)}`
    );
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
  public async release(force: boolean = false): Promise<void> {
    if (!force) {
      this.assertInitialized();
    }

    // Prevent concurrent release calls
    if (this.state.isReleasing) {
      return;
    }

    this.state.setReleasing(true);

    try {
      // Release all acquired devices in parallel
      const releasePromises = Array.from(this.acquiredDevices.values()).map(
        (device) => device.release()
      );

      await Promise.allSettled(releasePromises);
      this.acquiredDevices.clear();

      // Release platform
      if (force) {
        await this.hybridObject.releasePlatform(true);
      } else {
        await this.hybridObject.releasePlatform();
      }
      this.hybridObject.onStatusUpdate(void 0);
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
  public async getDeviceInfo(): Promise<RnDeviceInfo[]> {
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

      // Derive device info on demand (no persistent cache)
      const infos = await this.getDeviceInfo();
      const deviceInfoObj = infos.find((info) => info.id === id);

      if (!deviceInfoObj) {
        throw new SmartCardError(
          'READER_ERROR',
          `Device ${id} not found in device list`
        );
      }

      // Create device instance
      const device = new RnSmartCardDevice(
        this,
        deviceHandle,
        deviceInfoObj as RnDeviceInfo
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

  private onNativePlatformReleased(_payload: PlatformEventPayload): void {
    if (!this.initialized) {
      this.resolvePlatformReleaseDeferred();
      return;
    }

    this.hybridObject.onStatusUpdate(void 0);
    this.initialized = false;

    try {
      this.acquiredDevices.clear();
    } catch {
      // ignore cleanup errors
    }

    this.resolvePlatformReleaseDeferred();
  }

  private resolvePlatformReleaseDeferred(): void {
    if (this.platformReleaseDeferred) {
      this.platformReleaseDeferred.resolve();
      this.platformReleaseDeferred = null;
    }
  }
}

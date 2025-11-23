import {
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  EmulatedCard,
  SmartCardError,
} from '@aokiapp/jsapdu-interface';
import { mapNitroError } from '../errors/error-mapper';
import { RnSmartCard } from '../card/rn-smart-card';
import { RnDeviceInfo } from './rn-device-info';
import { DeviceState, DEFAULT_CARD_PRESENCE_TIMEOUT } from './device-state';
import type { RnSmartCardPlatform } from '../platform/rn-smart-card-platform';
import type { EventPayload } from '../JsapduRn.nitro';
import { createDeferred } from '../utils/deferred';
import type { Deferred } from '../utils/deferred';

/**
 * Device-level event types (aligned with native StatusEventType subset)
 */
export type DeviceEventType =
  | 'DEVICE_ACQUIRED'
  | 'DEVICE_RELEASED'
  | 'CARD_FOUND'
  | 'CARD_LOST'
  | 'CARD_SESSION_STARTED'
  | 'CARD_SESSION_RESET'
  | 'WAIT_TIMEOUT'
  | 'READER_MODE_ENABLED'
  | 'READER_MODE_DISABLED'
  | 'DEBUG_INFO';

export type DeviceEventPayload = EventPayload;

/**
 * React Native NFC SmartCard device implementation
 *
 * @remarks
 * This implementation manages:
 * - ReaderMode lifecycle (RF activation/deactivation)
 * - Card presence detection (event-driven)
 * - Session management (active/inactive state)
 *
 * FFI-neutral terminology:
 * - "RF activation" instead of "ReaderMode enabled"
 * - "Card presence event" instead of "Tag detection"
 * - "ISO-DEP session" instead of "IsoDep connection"
 *
 * @example
 * ```typescript
 * const device = await platform.acquireDevice(deviceId);
 *
 * // Wait for card (blocking, event-driven)
 * await device.waitForCardPresence(15000);
 *
 * // Start session
 * const card = await device.startSession();
 * const atr = await card.getAtr();
 *
 * // Cleanup
 * await card.release();
 * await device.release();
 * ```
 */
export class RnSmartCardDevice extends SmartCardDevice<{
  [K in DeviceEventType]: (payload: DeviceEventPayload) => void;
}> {
  private deviceHandle: string;
  private deviceInfo: RnDeviceInfo;
  private activeCard: RnSmartCard | null = null;
  private state: DeviceState = new DeviceState();
  private releaseDeferred: Deferred<void> | null = null;
  private startSessionPromise: Promise<RnSmartCard> | null = null;

  constructor(
    parentPlatform: RnSmartCardPlatform,
    deviceHandle: string,
    deviceInfo: RnDeviceInfo
  ) {
    super(parentPlatform);
    this.deviceHandle = deviceHandle;
    this.deviceInfo = deviceInfo;

    const ee = this.getEventEmitter();
    ee.on('DEVICE_RELEASED', (_payload: DeviceEventPayload) => {
      this.handleNativeDeviceReleased();
    });
  }

  /**
   * Get the underlying Nitro HybridObject instance
   * @internal
   */
  private getHybrid() {
    return (this.parentPlatform as RnSmartCardPlatform).getHybridObject();
  }

  /**
   * Get the parent platform instance
   * @internal
   */
  public getPlatform(): RnSmartCardPlatform {
    return this.parentPlatform as RnSmartCardPlatform;
  }

  /**
   * Internal EventEmitter accessor
   * @internal
   */
  public getEventEmitter() {
    return this.eventEmitter;
  }

  /**
   * Internal: device handle accessor for two-hop platform lookups
   * @internal
   */
  public getDeviceHandle(): string {
    return this.deviceHandle;
  }

  /**
   * Internal: resolve active card by cardHandle (no caches)
   * @internal
   */
  public getTarget(cardHandle: string): RnSmartCard | undefined {
    const c = this.activeCard;
    // Delegate release state checking to card methods; return if handle matches
    if (c && c.getCardHandle() === cardHandle) {
      return c;
    }
    return undefined;
  }

  /**
   * Internal: notification from card when card.release() completes.
   * Detach references if it matches the active card.
   * @internal
   */
  public onCardReleased(cardHandle: string): void {
    const c = this.activeCard;
    if (c && c.getCardHandle() === cardHandle) {
      this.deleteActiveCard();
    }
  }

  /**
   * Internal: fully remove active card reference from this device instance.
   * Ensures GC eligibility by clearing and deleting properties.
   * @internal
   */
  private deleteActiveCard(): void {
    // Clear strong references
    this.activeCard = null;
    this.card = null;

    // No additional action; strong references cleared above.
  }

  /**
   * Internal: JS-side cleanup when native releases the device.
   * Does not call back into native; only mirrors state and detaches references.
   * @internal
   */
  private onNativeReleased(): void {
    if (this.state.isReleased) {
      return;
    }
    // Drop any active card reference; native already closed sessions
    this.deleteActiveCard();
    this.startSessionPromise = null;

    // Mark released and perform JS-side cleanup with a single try/catch
    this.state.markReleased();

    const platform = this.getPlatform();
    const id = this.deviceInfo?.id;

    try {
      // Remove listeners and sever strong refs to become inert
      // No-op: emitter listeners will be GC'ed with this instance

      // Sever own references
      this.deviceHandle = '';
      // keep deviceInfo; no need to delete strongly-typed property
      // avoid mutating parentPlatform typed reference; object is inert after markReleased()

      // Untrack from platform (use captured references)
      if (platform && id) {
        platform.untrackDevice(id);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  /**
   * Get device information
   * @returns Device information object
   */
  public getDeviceInfo(): SmartCardDeviceInfo {
    return this.deviceInfo;
  }

  /**
   * Check if a session is currently active
   * @returns true if session is active, false otherwise
   */
  public isSessionActive(): boolean {
    return this.activeCard !== null && !this.state.isReleased;
  }

  /**
   * Check if device is available (non-blocking)
   *
   * @returns true if device is available, false otherwise
   *
   * @remarks
   * This method:
   * - Can be called regardless of card presence or session state
   * - Returns true if device is acquired (even if session is active)
   * - Returns false on check failure (graceful degradation)
   * - Does not lock any resources
   */
  public async isDeviceAvailable(): Promise<boolean> {
    if (this.state.isReleased) {
      return false;
    }

    try {
      return await this.getHybrid().isDeviceAvailable(this.deviceHandle);
    } catch {
      // Graceful degradation: return false on error
      return false;
    }
  }

  /**
   * Check if card is present (non-blocking, lightweight)
   *
   * @returns true if card is present, false otherwise
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if check fails
   *
   * @remarks
   * This method:
   * - Can be called regardless of session state
   * - Based on last detected tag presence
   * - Does not lock any resources
   * - Not TOCTTOU-resistant (race condition possible)
   */
  public async isCardPresent(): Promise<boolean> {
    this.state.assertNotReleased();

    try {
      return await this.getHybrid().isCardPresent(this.deviceHandle);
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  /**
   * Wait for card presence (blocking, event-driven)
   *
   * @param timeout - Timeout in milliseconds (default: 30000ms = 30 seconds)
   * @throws {SmartCardError} with code "TIMEOUT" if timeout is reached
   * @throws {SmartCardError} with code "INVALID_PARAMETER" if timeout is negative
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if wait fails
   *
   * @remarks
   * Preconditions:
   * - Device must be acquired
   * - ReaderMode must be enabled (RF active)
   *
   * Postconditions:
   * - ISO-DEP tag detected OR timeout occurred
   *
   * Behavior:
   * - Blocks until card is detected or timeout
   * - FeliCa/NDEF tags are internally suppressed (only ISO-DEP detection succeeds)
   * - timeout=0 returns immediate TIMEOUT
   * - timeout<0 returns INVALID_PARAMETER
   * - Screen-off/Doze cancellation returns TIMEOUT (with device release)
   *
   * After screen-off/Doze cancellation, host must:
   * 1. Re-acquire device: `await platform.acquireDevice(deviceId)`
   * 2. Re-wait for card: `await device.waitForCardPresence(timeout)`
   */
  public async waitForCardPresence(
    timeout: number = DEFAULT_CARD_PRESENCE_TIMEOUT
  ): Promise<void> {
    this.state.assertNotReleased();
    this.state.validateTimeout(timeout);
    // timeout==0 is handled by DeviceState.validateTimeout()

    this.state.setWaiting(true);

    try {
      // Native expects seconds (Double). Convert milliseconds to seconds for all values.
      const seconds = timeout / 1000;
      await this.getHybrid().waitForCardPresence(this.deviceHandle, seconds);
    } catch (error) {
      throw mapNitroError(error);
    } finally {
      this.state.setWaiting(false);
    }
  }

  /**
   * Start communication session with detected card
   *
   * @returns SmartCard instance
   * @throws {SmartCardError} with code "CARD_NOT_PRESENT" if card is not present
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if session start fails
   *
   * @remarks
   * Preconditions:
   * - Card must be present (waitForCardPresence must have succeeded)
   *
   * Postconditions:
   * - ISO-DEP session established
   * - Card is in active state
   *
   * If session already exists:
   * - Returns existing card reference (idempotent)
   *
   * Session establishment:
   * - Uses IsoDep.connect() internally (Android)
   * - Concurrent calls are serialized by mutual exclusion
   */
  public async startSession(): Promise<SmartCard> {
    this.state.assertNotReleased();

    if (this.activeCard) {
      return this.activeCard;
    }

    if (this.startSessionPromise) {
      return this.startSessionPromise;
    }

    const startPromise = (async () => {
      try {
        const cardHandle = await this.getHybrid().startSession(
          this.deviceHandle
        );
        const card = new RnSmartCard(this, this.deviceHandle, cardHandle);
        this.card = card;
        this.activeCard = card;
        return card;
      } catch (error) {
        throw mapNitroError(error);
      } finally {
        this.startSessionPromise = null;
      }
    })();

    this.startSessionPromise = startPromise;
    return startPromise;
  }

  /**
   * Start HCE (Host Card Emulation) session
   *
   * @throws {SmartCardError} with code "UNSUPPORTED_OPERATION" - HCE not supported in initial version
   *
   * @remarks
   * HCE is planned for future implementation.
   * This method will be implemented when HCE support is added.
   */
  public startHceSession(): Promise<EmulatedCard> {
    throw new SmartCardError(
      'UNSUPPORTED_OPERATION',
      'HCE (Host Card Emulation) is not supported in the initial version'
    );
  }

  /**
   * Release device and deactivate RF
   *
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if release fails
   *
   * @remarks
   * Postconditions:
   * - Active card session is released (if exists)
   * - Device is released
   * - ReaderMode is stopped (RF deactivated)
   * - Device is removed from platform tracking
   *
   * This method is idempotent:
   * - Multiple calls are safe
   * - Card release failures are suppressed to ensure device cleanup
   */
  public async release(): Promise<void> {
    if (this.state.isReleased) {
      return;
    }

    if (this.releaseDeferred) {
      await this.releaseDeferred.promise;
      return;
    }

    const pendingStart = this.startSessionPromise;
    if (pendingStart) {
      try {
        await pendingStart;
      } catch {
        // Ignore start failures during release; continue cleanup.
      }
    }

    if (this.activeCard) {
      try {
        await this.activeCard.release();
      } catch (error) {
        const mappedError =
          error instanceof SmartCardError ? error : mapNitroError(error);
        console.warn(
          `[RnSmartCardDevice] Failed to release active card cleanly (code=${mappedError.code}). Continuing device release. details=${mappedError.message}`
        );
      }
    }

    const deferred = createDeferred<void>();
    this.releaseDeferred = deferred;

    try {
      await this.getHybrid().releaseDevice(this.deviceHandle);
    } catch (error) {
      const mappedError = mapNitroError(error);
      this.releaseDeferred = null;
      deferred.reject(mappedError);
      throw mappedError;
    }

    await deferred.promise;
  }

  private handleNativeDeviceReleased(): void {
    this.onNativeReleased();
    this.resolveDeviceReleaseDeferred();
  }

  private resolveDeviceReleaseDeferred(): void {
    if (this.releaseDeferred) {
      this.releaseDeferred.resolve();
      this.releaseDeferred = null;
    }
  }
}

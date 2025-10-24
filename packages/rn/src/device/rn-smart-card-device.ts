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
export class RnSmartCardDevice extends SmartCardDevice {
  private deviceHandle: string;
  private deviceInfo: RnDeviceInfo;
  private activeCard: RnSmartCard | null = null;
  private state: DeviceState = new DeviceState();

  constructor(
    parentPlatform: RnSmartCardPlatform,
    deviceHandle: string,
    deviceInfo: RnDeviceInfo
  ) {
    super(parentPlatform);
    this.deviceHandle = deviceHandle;
    this.deviceInfo = deviceInfo;
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
    } catch (error) {
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
      await this.getHybrid().waitForCardPresence(this.deviceHandle, timeout);
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

    // Return existing session if already active
    if (this.activeCard) {
      return this.activeCard;
    }

    try {
      const cardHandle = await this.getHybrid().startSession(this.deviceHandle);
      const card = new RnSmartCard(this, cardHandle);
      this.card = card;
      this.activeCard = card;
      return card;
    } catch (error) {
      throw mapNitroError(error);
    }
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
  public async startHceSession(): Promise<EmulatedCard> {
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
      return; // Idempotent: already released
    }

    try {
      // Release active card session first
      if (this.activeCard) {
        try {
          await this.activeCard.release();
        } catch (error) {
          throw mapNitroError(error);
        }
        this.activeCard = null;
        this.card = null;
      }

      // Release device (deactivates ReaderMode / RF)
      await this.getHybrid().releaseDevice(this.deviceHandle);

      // Mark as released
      this.state.markReleased();

      // Untrack from platform
      this.getPlatform().untrackDevice(this.deviceInfo.id);
    } catch (error) {
      throw mapNitroError(error);
    }
  }
}

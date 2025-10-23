import { SmartCardError } from '@aokiapp/jsapdu-interface';

/**
 * Default timeout for card presence waiting (30 seconds)
 */
export const DEFAULT_CARD_PRESENCE_TIMEOUT = 30000;

/**
 * Device state management for RnSmartCardDevice
 *
 * @internal
 */
export class DeviceState {
  private _isReleased = false;
  private _isWaiting = false;

  get isReleased(): boolean {
    return this._isReleased;
  }

  get isWaiting(): boolean {
    return this._isWaiting;
  }

  /**
   * Mark device as released
   */
  public markReleased(): void {
    this._isReleased = true;
  }

  /**
   * Mark waiting state
   */
  public setWaiting(waiting: boolean): void {
    this._isWaiting = waiting;
  }

  /**
   * Assert that the device has not been released
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if device is released
   */
  public assertNotReleased(): void {
    if (this._isReleased) {
      throw new SmartCardError(
        'PLATFORM_ERROR',
        'Device has been released and cannot be used'
      );
    }
  }

  /**
   * Validate timeout parameter
   * @param timeout - Timeout value to validate
   * @throws {SmartCardError} if timeout is invalid
   */
  public validateTimeout(timeout: number): void {
    if (timeout < 0) {
      throw new SmartCardError(
        'INVALID_PARAMETER',
        `Timeout must be non-negative, got ${timeout}`
      );
    }

    if (timeout === 0) {
      throw new SmartCardError(
        'TIMEOUT',
        'Timeout is zero, returning immediately'
      );
    }

    if (this._isWaiting) {
      throw new SmartCardError(
        'PLATFORM_ERROR',
        'Card presence wait is already in progress'
      );
    }
  }
}

/**
 * Platform state management for RnSmartCardPlatform
 *
 * @internal
 */
export class PlatformState {
  private _isReleasing = false;

  get isReleasing(): boolean {
    return this._isReleasing;
  }

  /**
   * Set releasing state
   */
  public setReleasing(releasing: boolean): void {
    this._isReleasing = releasing;
  }
}

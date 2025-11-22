import {
  SmartCard,
  CommandApdu,
  ResponseApdu,
  SmartCardError,
} from '@aokiapp/jsapdu-interface';
import { mapNitroError } from '../errors/error-mapper';
import type { RnSmartCardDevice } from '../device/rn-smart-card-device';
import type { EventPayload } from '../JsapduRn.nitro';

/**
 * Card-level event types (aligned with native StatusEventType subset)
 */
export type CardEventType =
  | 'CARD_SESSION_RESET'
  | 'CARD_LOST'
  | 'APDU_SENT'
  | 'APDU_FAILED'
  | 'DEBUG_INFO';

export type CardEventPayload = EventPayload;

/**
 * React Native NFC SmartCard implementation
 *
 * @remarks
 * This implementation handles:
 * - APDU command/response transmission
 * - ATR (Answer To Reset) / ATS (Answer To Select) retrieval
 * - Card session reset
 * - Extended APDU support (Lc/Le two-byte encoding)
 *
 * FFI-neutral terminology:
 * - "ISO-DEP session" instead of "IsoDep connection"
 * - "ATR/ATS" instead of Android-specific retrieval methods
 *
 * ATR retrieval order (Android):
 * 1. Historical Bytes (if available)
 * 2. HiLayerResponse (ATS) as fallback
 * 3. PROTOCOL_ERROR if both unavailable
 *
 * @example
 * ```typescript
 * const card = await device.startSession();
 *
 * // Get ATR
 * const atr = await card.getAtr();
 * console.log('ATR:', Array.from(atr).map(b => b.toString(16)).join(' '));
 *
 * // Send SELECT command
 * const select = new CommandApdu(0x00, 0xA4, 0x04, 0x00, aid);
 * const response = await card.transmit(select);
 *
 * if (response.isSuccess()) {
 *   console.log('SELECT successful');
 * }
 *
 * await card.release();
 * ```
 */
export class RnSmartCard extends SmartCard<{
  [K in CardEventType]: (payload: CardEventPayload) => void;
}> {
  private cardHandle: string;
  private deviceHandle: string;
  private nativeDisposeInProgress: Promise<void> | null = null;

  constructor(
    parentDevice: RnSmartCardDevice,
    deviceHandle: string,
    cardHandle: string
  ) {
    super(parentDevice);
    this.deviceHandle = deviceHandle;
    this.cardHandle = cardHandle;

    // Event-driven mirroring: native CARD_LOST / CARD_SESSION_RESET -> call this.release() with reentrancy guard
    const ee = this.getEventEmitter();
    const onDisposed = (_payload: CardEventPayload) => {
      if (this.nativeDisposeInProgress) return;
      this.nativeDisposeInProgress = this.release()
        .catch(() => {
          // Fallback to local cleanup when native already released or handle invalid
          this.onNativeDisposed();
        })
        .finally(() => {
          this.nativeDisposeInProgress = null;
        });
    };
    ee.on('CARD_LOST', onDisposed);
    ee.on('CARD_SESSION_RESET', onDisposed);
  }

  /**
   * Get the underlying Nitro HybridObject instance
   * @internal
   */
  private getHybrid() {
    const device = this.parentDevice as RnSmartCardDevice;
    return device.getPlatform().getHybridObject();
  }

  /**
   * Internal EventEmitter accessor
   * @internal
   */
  public getEventEmitter() {
    return this.eventEmitter;
  }

  /**
   * Internal: card handle accessor for two-hop device lookups
   * @internal
   */
  public getCardHandle(): string {
    return this.cardHandle;
  }

  /**
   * Assert that the card session has not been released
   * @internal
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if card is released
   */
  private assertNotReleased(): void {
    // Treat missing/empty handles as disposed object
    if (!this.cardHandle || !this.deviceHandle) {
      throw new SmartCardError(
        'PLATFORM_ERROR',
        'Card session has been released and cannot be used'
      );
    }
  }

  /**
   * Internal: mirror native-driven card disposal without calling native again.
   * Triggered by CARD_LOST or CARD_SESSION_RESET events routed to this card.
   * @internal
   */
  private onNativeDisposed(): void {
    // If already disposed, ignore
    if (!this.cardHandle || !this.deviceHandle) {
      return;
    }

    // Capture references/values before severing
    const device = this.parentDevice as RnSmartCardDevice | null;
    const h = this.cardHandle;

    try {
      // Inform parent device to drop its active card reference
      if (device && h) {
        device.onCardReleased(h);
      }

      // Remove listeners and sever strong refs
      // No-op: emitter listeners will be GC'ed with this instance

      // Sever internal references so this object becomes inert
      this.cardHandle = '';
      this.deviceHandle = '';
      // avoid mutating parentDevice typed reference; object becomes inert after handles invalidated
    } catch {
      // ignore cleanup errors
    }
  }
  /**
   * No explicit isReleased()/isCardReleased() accessors.
   * Disposed state is derived from cleared handles (see release()).
   */

  /**
   * Get ATR (Answer To Reset) or ATS (Answer To Select)
   *
   * @returns ATR/ATS bytes
   * @throws {SmartCardError} with code "PROTOCOL_ERROR" if ATR/ATS cannot be retrieved
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if retrieval fails
   *
   * @remarks
   * Retrieval order (Android):
   * 1. Historical Bytes (preferred)
   * 2. HiLayerResponse (ATS) as fallback
   * 3. PROTOCOL_ERROR if both are null or length 0
   *
   * For Type A cards:
   * - Historical Bytes returned if available
   * - Otherwise ATS is returned
   *
   * For Type B cards:
   * - ATS only (no Historical Bytes)
   *
   * The returned value is raw bytes without additional processing.
   */
  public async getAtr(): Promise<Uint8Array> {
    this.assertNotReleased();

    try {
      const atrBuffer = await this.getHybrid().getAtr(
        this.deviceHandle,
        this.cardHandle
      );
      const atr = new Uint8Array(atrBuffer);

      // Validate ATR length
      if (atr.length === 0) {
        throw new SmartCardError(
          'PROTOCOL_ERROR',
          'ATR/ATS is empty (length 0)'
        );
      }

      return atr;
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  /**
   * Transmit APDU command to the card
   *
   * @param apdu - APDU command to transmit
   * @returns Response APDU with data and status words
   * @throws {SmartCardError} with code "INVALID_PARAMETER" if command is invalid or too long
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if transmission fails
   * @throws {SmartCardError} with code "PROTOCOL_ERROR" if response is malformed
   *
   * @remarks
   * Preconditions:
   * - Active session must exist
   * - Card must be present
   *
   * APDU length limits:
   * - Short APDU: Lc ≤ 255, Le ≤ 256
   * - Extended APDU: Lc ≤ 65535, Le ≤ 65536
   * - Response theoretical max: 65538 bytes (data + SW1/SW2)
   *
   * Extended APDU support:
   * - Always assumed supported (mandatory)
   * - Unsupported devices return PLATFORM_ERROR (cutoff policy)
   * - No runtime capability detection
   *
   * Timeout (Android):
   * - IsoDep.transceive() default: 5000ms (not configurable from FFI)
   * - Timeout errors are mapped to PLATFORM_ERROR
   *
   * Thread safety:
   * - Concurrent transmit() calls are serialized by mutual exclusion
   * - I/O is executed on non-UI thread
   */
  public async transmit(apdu: CommandApdu): Promise<ResponseApdu> {
    this.assertNotReleased();

    try {
      const apduBytes = apdu.toUint8Array();
      const response = await this.getHybrid().transmit(
        this.deviceHandle,
        this.cardHandle,
        apduBytes.buffer
      );
      const data = new Uint8Array(response);
      return ResponseApdu.fromUint8Array(data);
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  /**
   * Reset the card (re-establish ISO-DEP session)
   *
   * @throws {SmartCardError} with code "CARD_NOT_PRESENT" if card is not present
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if reset fails
   *
   * @remarks
   * Android implementation:
   * - Closes current ISO-DEP session (IsoDep.close())
   * - Maintains RF (ReaderMode remains active)
   * - Re-establishes session internally (IsoDep.connect())
   *
   * Postconditions:
   * - Card is in active state again
   * - ATR/ATS can be re-retrieved
   *
   * If card is removed during reset:
   * - Returns CARD_NOT_PRESENT
   *
   * This is equivalent to:
   * 1. Close ISO-DEP session
   * 2. Re-execute startSession() internally
   */
  public async reset(): Promise<void> {
    this.assertNotReleased();

    try {
      await this.getHybrid().reset(this.deviceHandle, this.cardHandle);
    } catch (error) {
      throw mapNitroError(error);
    }
  }

  /**
   * Release the card session
   *
   * @throws {SmartCardError} with code "PLATFORM_ERROR" if release fails
   *
   * @remarks
   * Postconditions:
   * - Card session is inactive
   * - ISO-DEP connection is closed
   * - Card handle is invalidated
   *
   * This method is idempotent:
   * - Multiple calls are safe
   * - Already released cards return immediately
   *
   * After release:
   * - Device remains acquired (RF active)
   * - New session can be started with device.startSession()
   */
  public async release(): Promise<void> {
    // If handles are already cleared/missing, treat as disposed (idempotent)
    if (!this.cardHandle || !this.deviceHandle) {
      return; // Idempotent: already released
    }

    const device = this.parentDevice as RnSmartCardDevice;
    const deviceHandle = this.deviceHandle;
    const cardHandle = this.cardHandle;
    let shouldFinalizeLocally = false;

    try {
      await this.getHybrid().releaseCard(deviceHandle, cardHandle);
      shouldFinalizeLocally = true;
    } catch (error) {
      const mappedError = mapNitroError(error);
      if (this.isBenignReleaseError(mappedError)) {
        shouldFinalizeLocally = true;
      } else {
        throw mappedError;
      }
    } finally {
      if (shouldFinalizeLocally) {
        device.onCardReleased(cardHandle);

        // Sever internal references so this object becomes GC-eligible and inert
        // No-op: emitter listeners will be GC'ed with this instance

        this.cardHandle = '';
        this.deviceHandle = '';
        // avoid mutating parentDevice typed reference; object becomes inert after handles invalidated
      }
    }
  }

  private isBenignReleaseError(error: SmartCardError): boolean {
    const message = error.message.toLowerCase();
    return (
      error.code === 'CARD_NOT_PRESENT' ||
      error.code === 'NOT_INITIALIZED' ||
      message.includes('invalid_card_handle') ||
      message.includes('invalid card handle') ||
      message.includes('already released')
    );
  }
}

import {
  SmartCard,
  CommandApdu,
  ResponseApdu,
  SmartCardError,
} from '@aokiapp/jsapdu-interface';
import { mapNitroError } from '../errors/error-mapper';
import type { RnSmartCardDevice } from '../device/rn-smart-card-device';
import type { EventPayload } from '../JsapduRn.nitro';
import { createDeferred } from '../utils/deferred';
import type { Deferred } from '../utils/deferred';

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
  private releaseDeferred: Deferred<void> | null = null;

  constructor(
    parentDevice: RnSmartCardDevice,
    deviceHandle: string,
    cardHandle: string
  ) {
    super(parentDevice);
    this.deviceHandle = deviceHandle;
    this.cardHandle = cardHandle;

    const ee = this.getEventEmitter();
    const onCardDisposed = (_payload: CardEventPayload) => {
      void _payload; // Silence unused variable warning
      this.handleNativeCardDisposed();
    };
    ee.on('CARD_LOST', onCardDisposed);
    ee.on('CARD_SESSION_RESET', onCardDisposed);
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
   * Triggered by CARD_LOST events routed to this card.
   * @internal
   */
  private handleNativeCardDisposed(): void {
    this.finalizeNativeDisposal();
  }

  private finalizeNativeDisposal(): void {
    if (!this.cardHandle || !this.deviceHandle) {
      this.resolveReleaseDeferred();
      return;
    }

    const device = this.parentDevice as RnSmartCardDevice | null;
    const h = this.cardHandle;

    try {
      if (device && h) {
        device.onCardReleased(h);
      }
    } catch {
      // ignore cleanup errors
    } finally {
      this.cardHandle = '';
      this.deviceHandle = '';
      this.resolveReleaseDeferred();
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
  public async transmit(apdu: CommandApdu): Promise<ResponseApdu>;
  public async transmit(apdu: Uint8Array): Promise<Uint8Array>;
  public async transmit(apdu: CommandApdu | Uint8Array): Promise<ResponseApdu | Uint8Array> {
    this.assertNotReleased();

    try {
      if (apdu instanceof CommandApdu) {
        const apduBytes = apdu.toUint8Array();
        const response = await this.getHybrid().transmit(
          this.deviceHandle,
          this.cardHandle,
          apduBytes.buffer
        );
        const data = new Uint8Array(response);
        return ResponseApdu.fromUint8Array(data);
      } else {
        const frame = apdu as Uint8Array;
        // Ensure we pass a plain ArrayBuffer, not SharedArrayBuffer.
        const buf = frame.slice(0).buffer;
        const response = await this.getHybrid().transmit(
          this.deviceHandle,
          this.cardHandle,
          buf
        );
        return new Uint8Array(response);
      }
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
    if (!this.cardHandle || !this.deviceHandle) {
      if (this.releaseDeferred) {
        await this.releaseDeferred.promise;
      }
      return;
    }

    if (this.releaseDeferred) {
      await this.releaseDeferred.promise;
      return;
    }

    const deferred = createDeferred<void>();
    this.releaseDeferred = deferred;

    try {
      await this.getHybrid().releaseCard(this.deviceHandle, this.cardHandle);
    } catch (error) {
      const mappedError = mapNitroError(error);
      if (this.isBenignReleaseError(mappedError)) {
        this.finalizeNativeDisposal();
      } else {
        this.releaseDeferred = null;
        deferred.reject(mappedError);
        throw mappedError;
      }
    }

    await deferred.promise;
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

  private resolveReleaseDeferred(): void {
    if (this.releaseDeferred) {
      this.releaseDeferred.resolve();
      this.releaseDeferred = null;
    }
  }
}

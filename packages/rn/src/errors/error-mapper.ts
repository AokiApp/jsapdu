import { SmartCardError, fromUnknownError } from '@aokiapp/jsapdu-interface';
import type { SmartCardErrorCode } from '@aokiapp/jsapdu-interface';
import { ANDROID_ERROR_PATTERNS, matchesAnyPattern } from './error-patterns';

/**
 * NOTE: ANDROID_ERROR_PATTERNS are provided by './error-patterns'.
 * Ensure this module exists and has test coverage for TagLost/IOException/Security/IllegalState/IllegalArgument patterns.
 * TODO: Refactor this mapper to a table-driven approach to improve readability and efficiency.
 */
/**
 * Maps errors from React Native Nitro modules to SmartCardError
 * Ensures all errors are normalized to the SmartCardError code system
 *
 * @param error - Error from native module
 * @param defaultCode - Default error code if mapping fails
 * @returns Normalized SmartCardError
 * 
 * @remarks
 * Error mapping strategy:
 * 1. Return SmartCardError as-is (already normalized)
 * 2. Map known error code strings (from native layer)
 * 3. Map Android exception patterns to PLATFORM_ERROR
 * 4. Use fromUnknownError() for generic mapping
 * 
 * Android exception→SmartCardError mapping:
 * - TagLostException → PLATFORM_ERROR (card removed)
 * - IOException → PLATFORM_ERROR (I/O failure)
 * - SecurityException → PLATFORM_ERROR (permission denied)
 * - IllegalStateException → PLATFORM_ERROR (connection state invalid)
 * - IllegalArgumentException → INVALID_PARAMETER
 * 
 * FFI-neutral error codes:
 * - NOT_INITIALIZED: Platform not initialized
 * - ALREADY_INITIALIZED: Platform already initialized
 * - CARD_NOT_PRESENT: Card not detected
 * - TIMEOUT: Operation timed out
 * - ALREADY_CONNECTED: Device already acquired
 * - INVALID_PARAMETER: Invalid parameter
 * - PROTOCOL_ERROR: Protocol violation
 * - PLATFORM_ERROR: Platform-specific error (generic)
 * 
 * @example
 * ```typescript
 * try {
 *   await hybridObject.transmit(cardHandle, apdu);
 * } catch (error) {
 *   throw mapNitroError(error);
 *   // TagLostException → SmartCardError("PLATFORM_ERROR", "Card removed")
 * }
 * ```
 */
export function mapNitroError(
  error: unknown,
  defaultCode: SmartCardErrorCode = 'PLATFORM_ERROR'
): SmartCardError {
  // Already a SmartCardError - return as-is
  if (error instanceof SmartCardError) {
    return error;
  }

  // Extract error message and name
  const message = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : '';
  const lowerMessage = message.toLowerCase();
  const lowerName = errorName.toLowerCase();

  // ========================================================================
  // Map known SmartCardError code strings (from native layer)
  // ========================================================================

  if (
    lowerMessage.includes('not initialized') ||
    lowerMessage.includes('not_initialized')
  ) {
    return new SmartCardError('NOT_INITIALIZED', message);
  }

  if (
    lowerMessage.includes('already initialized') ||
    lowerMessage.includes('already_initialized')
  ) {
    return new SmartCardError('ALREADY_INITIALIZED', message);
  }

  if (
    lowerMessage.includes('card not present') ||
    lowerMessage.includes('card_not_present')
  ) {
    return new SmartCardError('CARD_NOT_PRESENT', message);
  }

  if (lowerMessage.includes('timeout')) {
    return new SmartCardError('TIMEOUT', message);
  }

  if (
    lowerMessage.includes('already connected') ||
    lowerMessage.includes('already_connected')
  ) {
    return new SmartCardError('ALREADY_CONNECTED', message);
  }

  if (
    lowerMessage.includes('invalid parameter') ||
    lowerMessage.includes('invalid_parameter')
  ) {
    return new SmartCardError('INVALID_PARAMETER', message);
  }

  if (
    lowerMessage.includes('protocol error') ||
    lowerMessage.includes('protocol_error')
  ) {
    return new SmartCardError('PROTOCOL_ERROR', message);
  }

  if (
    lowerMessage.includes('reader error') ||
    lowerMessage.includes('reader_error')
  ) {
    return new SmartCardError('READER_ERROR', message);
  }

  if (
    lowerMessage.includes('unsupported operation') ||
    lowerMessage.includes('unsupported_operation')
  ) {
    return new SmartCardError('UNSUPPORTED_OPERATION', message);
  }

  // ========================================================================
  // Map Android exception patterns to platform errors
  // ========================================================================

  // TagLostException → PLATFORM_ERROR (card removed)
  if (matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.TAG_LOST)) {
    return new SmartCardError(
      'PLATFORM_ERROR',
      'Card was removed during operation'
    );
  }

  // IOException → PLATFORM_ERROR (I/O failure)
  if (matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.IO_ERROR)) {
    return new SmartCardError('PLATFORM_ERROR', `NFC I/O error: ${message}`);
  }

  // SecurityException → PLATFORM_ERROR (permission denied)
  if (matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.SECURITY)) {
    return new SmartCardError(
      'PLATFORM_ERROR',
      'NFC permission denied or security error'
    );
  }

  // IllegalStateException → PLATFORM_ERROR (connection state invalid)
  if (
    matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.ILLEGAL_STATE)
  ) {
    return new SmartCardError(
      'PLATFORM_ERROR',
      'NFC connection state is invalid'
    );
  }

  // IllegalArgumentException → INVALID_PARAMETER
  if (
    matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.ILLEGAL_ARGUMENT)
  ) {
    return new SmartCardError('INVALID_PARAMETER', `Invalid argument: ${message}`);
  }

  // NFC not supported → PLATFORM_ERROR
  if (
    matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.NFC_NOT_SUPPORTED)
  ) {
    return new SmartCardError(
      'PLATFORM_ERROR',
      'NFC is not supported on this device'
    );
  }

  // NFC disabled → PLATFORM_ERROR
  if (
    matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.NFC_DISABLED)
  ) {
    return new SmartCardError('PLATFORM_ERROR', 'NFC is disabled on this device');
  }

  // ReaderMode errors → PLATFORM_ERROR
  if (
    matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.READER_MODE_ERROR)
  ) {
    return new SmartCardError('PLATFORM_ERROR', `ReaderMode error: ${message}`);
  }

  // ISO-DEP errors → PLATFORM_ERROR
  if (matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.ISODEP_ERROR)) {
    return new SmartCardError('PLATFORM_ERROR', `ISO-DEP error: ${message}`);
  }

  // Connection errors → PLATFORM_ERROR
  if (
    matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.CONNECT_ERROR)
  ) {
    return new SmartCardError('PLATFORM_ERROR', `Connection error: ${message}`);
  }

  // ========================================================================
  // Fallback: Use fromUnknownError for generic mapping
  // ========================================================================

  return fromUnknownError(error, defaultCode);
}

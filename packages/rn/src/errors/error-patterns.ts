/**
 * Android-specific error patterns for error code mapping
 *
 * @remarks
 * These patterns are internal implementation details not exposed in FFI.
 * They are used to map Android exception names and messages to
 * FFI-neutral SmartCardError codes.
 *
 * @internal
 */
export const ANDROID_ERROR_PATTERNS = {
  /**
   * IOException and its subclasses
   * Maps to: PLATFORM_ERROR
   */
  IO_ERROR: ['IOException', 'I/O error', 'transceive failed'],

  /**
   * TagLostException (card removed during operation)
   * Maps to: PLATFORM_ERROR
   */
  TAG_LOST: [
    'TagLostException',
    'tag was lost',
    'card removed',
    'card was removed',
  ],

  /**
   * SecurityException (permission denied)
   * Maps to: PLATFORM_ERROR
   */
  SECURITY: ['SecurityException', 'permission denied', 'NFC permission'],

  /**
   * IllegalStateException (connection state invalid)
   * Maps to: PLATFORM_ERROR
   */
  ILLEGAL_STATE: ['IllegalStateException', 'not connected', 'connection state'],

  /**
   * IllegalArgumentException (invalid argument)
   * Maps to: INVALID_PARAMETER
   */
  ILLEGAL_ARGUMENT: ['IllegalArgumentException', 'invalid argument'],

  /**
   * NFC not supported on device
   * Maps to: PLATFORM_ERROR
   */
  NFC_NOT_SUPPORTED: [
    'NFC not supported',
    'NFC adapter not found',
    'NfcAdapter is null',
  ],

  /**
   * NFC disabled on device
   * Maps to: PLATFORM_ERROR
   */
  NFC_DISABLED: ['NFC is disabled', 'NFC is not enabled'],

  /**
   * ReaderMode activation/deactivation errors
   * Maps to: PLATFORM_ERROR
   */
  READER_MODE_ERROR: ['ReaderMode', 'enableReaderMode failed'],

  /**
   * ISO-DEP specific errors
   * Maps to: PLATFORM_ERROR
   */
  ISODEP_ERROR: ['IsoDep', 'ISO-DEP'],

  /**
   * Connection establishment errors
   * Maps to: PLATFORM_ERROR
   */
  CONNECT_ERROR: ['connect failed', 'connection failed'],
} as const;

/**
 * Check if message or error name matches any pattern in the given list
 *
 * @param message - Lowercase error message
 * @param name - Lowercase error name
 * @param patterns - Array of patterns to match
 * @returns true if any pattern matches, false otherwise
 *
 * @internal
 */
export function matchesAnyPattern(
  message: string,
  name: string,
  patterns: readonly string[]
): boolean {
  return patterns.some(
    (pattern) =>
      message.includes(pattern.toLowerCase()) ||
      name.includes(pattern.toLowerCase())
  );
}

/**
 * @module errors
 * @description PC/SC error codes, error messages, and helper functions for working with the WinSCard API.
 * This file combines error code definitions and error stringification utilities.
 */

/**
 * @description Enum of PC/SC error codes as defined by the WinSCard API.
 */
export enum PcscErrorCode {
  SCARD_S_SUCCESS = 0x00000000,
  SCARD_F_INTERNAL_ERROR = 0x80100001,
  SCARD_E_CANCELLED = 0x80100002,
  SCARD_E_INVALID_HANDLE = 0x80100003,
  SCARD_E_INVALID_PARAMETER = 0x80100004,
  SCARD_E_INVALID_TARGET = 0x80100005,
  SCARD_E_NO_MEMORY = 0x80100006,
  SCARD_F_WAITED_TOO_LONG = 0x80100007,
  SCARD_E_INSUFFICIENT_BUFFER = 0x80100008,
  SCARD_E_UNKNOWN_READER = 0x80100009,
  SCARD_E_TIMEOUT = 0x8010000a,
  SCARD_E_SHARING_VIOLATION = 0x8010000b,
  SCARD_E_NO_SMARTCARD = 0x8010000c,
  SCARD_E_UNKNOWN_CARD = 0x8010000d,
  SCARD_E_CANT_DISPOSE = 0x8010000e,
  SCARD_E_PROTO_MISMATCH = 0x8010000f,
  SCARD_E_NOT_READY = 0x80100010,
  SCARD_E_INVALID_VALUE = 0x80100011,
  SCARD_E_SYSTEM_CANCELLED = 0x80100012,
  SCARD_F_COMM_ERROR = 0x80100013,
  SCARD_F_UNKNOWN_ERROR = 0x80100014,
  SCARD_E_INVALID_ATR = 0x80100015,
  SCARD_E_NOT_TRANSACTED = 0x80100016,
  SCARD_E_READER_UNAVAILABLE = 0x80100017,
  SCARD_P_SHUTDOWN = 0x80100018,
  SCARD_E_PCI_TOO_SMALL = 0x80100019,
  SCARD_E_READER_UNSUPPORTED = 0x8010001a,
  SCARD_E_DUPLICATE_READER = 0x8010001b,
  SCARD_E_CARD_UNSUPPORTED = 0x8010001c,
  SCARD_E_NO_SERVICE = 0x8010001d,
  SCARD_E_SERVICE_STOPPED = 0x8010001e,
  SCARD_E_UNEXPECTED = 0x8010001f,
  SCARD_E_ICC_INSTALLATION = 0x80100020,
  SCARD_E_ICC_CREATEORDER = 0x80100021,
  // SCARD_E_UNSUPPORTED_FEATURE = 0x8010001f, // Same value as SCARD_E_UNEXPECTED
  SCARD_E_DIR_NOT_FOUND = 0x80100023,
  SCARD_E_FILE_NOT_FOUND = 0x80100024,
  SCARD_E_NO_DIR = 0x80100025,
  SCARD_E_NO_FILE = 0x80100026,
  SCARD_E_NO_ACCESS = 0x80100027,
  SCARD_E_WRITE_TOO_MANY = 0x80100028,
  SCARD_E_BAD_SEEK = 0x80100029,
  SCARD_E_INVALID_CHV = 0x8010002a,
  SCARD_E_UNKNOWN_RES_MNG = 0x8010002b,
  SCARD_E_NO_SUCH_CERTIFICATE = 0x8010002c,
  SCARD_E_CERTIFICATE_UNAVAILABLE = 0x8010002d,
  SCARD_E_NO_READERS_AVAILABLE = 0x8010002e,
  SCARD_E_COMM_DATA_LOST = 0x8010002f,
  SCARD_E_NO_KEY_CONTAINER = 0x80100030,
  SCARD_E_SERVER_TOO_BUSY = 0x80100031,
  SCARD_W_UNSUPPORTED_CARD = 0x80100065,
  SCARD_W_UNRESPONSIVE_CARD = 0x80100066,
  SCARD_W_UNPOWERED_CARD = 0x80100067,
  SCARD_W_RESET_CARD = 0x80100068,
  SCARD_W_REMOVED_CARD = 0x80100069,
  SCARD_W_SECURITY_VIOLATION = 0x8010006a,
  SCARD_W_WRONG_CHV = 0x8010006b,
  SCARD_W_CHV_BLOCKED = 0x8010006c,
  SCARD_W_EOF = 0x8010006d,
  SCARD_W_CANCELLED_BY_USER = 0x8010006e,
  SCARD_W_CARD_NOT_AUTHENTICATED = 0x8010006f,
}

/**
 * @description Error code to human-readable message mapping.
 */
export const PcscErrorMessages: Record<number, string> = {
  [PcscErrorCode.SCARD_S_SUCCESS]: "Success",
  [PcscErrorCode.SCARD_F_INTERNAL_ERROR]: "Internal error",
  [PcscErrorCode.SCARD_E_CANCELLED]: "Cancelled",
  [PcscErrorCode.SCARD_E_INVALID_HANDLE]: "Invalid handle",
  [PcscErrorCode.SCARD_E_INVALID_PARAMETER]: "Invalid parameter",
  [PcscErrorCode.SCARD_E_INVALID_TARGET]: "Invalid target",
  [PcscErrorCode.SCARD_E_NO_MEMORY]: "No memory",
  [PcscErrorCode.SCARD_F_WAITED_TOO_LONG]: "Waited too long",
  [PcscErrorCode.SCARD_E_INSUFFICIENT_BUFFER]: "Insufficient buffer",
  [PcscErrorCode.SCARD_E_UNKNOWN_READER]: "Unknown reader",
  [PcscErrorCode.SCARD_E_TIMEOUT]: "Timeout",
  [PcscErrorCode.SCARD_E_SHARING_VIOLATION]: "Sharing violation",
  [PcscErrorCode.SCARD_E_NO_SMARTCARD]: "No smartcard",
  [PcscErrorCode.SCARD_E_UNKNOWN_CARD]: "Unknown card",
  [PcscErrorCode.SCARD_E_CANT_DISPOSE]: "Cannot dispose",
  [PcscErrorCode.SCARD_E_PROTO_MISMATCH]: "Protocol mismatch",
  [PcscErrorCode.SCARD_E_NOT_READY]: "Not ready",
  [PcscErrorCode.SCARD_E_INVALID_VALUE]: "Invalid value",
  [PcscErrorCode.SCARD_E_SYSTEM_CANCELLED]: "System cancelled",
  [PcscErrorCode.SCARD_F_COMM_ERROR]: "Communication error",
  [PcscErrorCode.SCARD_F_UNKNOWN_ERROR]: "Unknown error",
  [PcscErrorCode.SCARD_E_INVALID_ATR]: "Invalid ATR",
  [PcscErrorCode.SCARD_E_NOT_TRANSACTED]: "Not transacted",
  [PcscErrorCode.SCARD_E_READER_UNAVAILABLE]: "Reader unavailable",
  [PcscErrorCode.SCARD_P_SHUTDOWN]: "Shutdown",
  [PcscErrorCode.SCARD_E_PCI_TOO_SMALL]: "PCI too small",
  [PcscErrorCode.SCARD_E_READER_UNSUPPORTED]: "Reader unsupported",
  [PcscErrorCode.SCARD_E_DUPLICATE_READER]: "Duplicate reader",
  [PcscErrorCode.SCARD_E_CARD_UNSUPPORTED]: "Card unsupported",
  [PcscErrorCode.SCARD_E_NO_SERVICE]: "No service",
  [PcscErrorCode.SCARD_E_SERVICE_STOPPED]: "Service stopped",
  [PcscErrorCode.SCARD_E_UNEXPECTED]: "Unexpected",
  [PcscErrorCode.SCARD_E_ICC_INSTALLATION]: "ICC installation",
  [PcscErrorCode.SCARD_E_ICC_CREATEORDER]: "ICC create order",
  [PcscErrorCode.SCARD_E_DIR_NOT_FOUND]: "Directory not found",
  [PcscErrorCode.SCARD_E_FILE_NOT_FOUND]: "File not found",
  [PcscErrorCode.SCARD_E_NO_DIR]: "No directory",
  [PcscErrorCode.SCARD_E_NO_FILE]: "No file",
  [PcscErrorCode.SCARD_E_NO_ACCESS]: "No access",
  [PcscErrorCode.SCARD_E_WRITE_TOO_MANY]: "Write too many",
  [PcscErrorCode.SCARD_E_BAD_SEEK]: "Bad seek",
  [PcscErrorCode.SCARD_E_INVALID_CHV]: "Invalid CHV",
  [PcscErrorCode.SCARD_E_UNKNOWN_RES_MNG]: "Unknown resource manager",
  [PcscErrorCode.SCARD_E_NO_SUCH_CERTIFICATE]: "No such certificate",
  [PcscErrorCode.SCARD_E_CERTIFICATE_UNAVAILABLE]: "Certificate unavailable",
  [PcscErrorCode.SCARD_E_NO_READERS_AVAILABLE]: "No readers available",
  [PcscErrorCode.SCARD_E_COMM_DATA_LOST]: "Communication data lost",
  [PcscErrorCode.SCARD_E_NO_KEY_CONTAINER]: "No key container",
  [PcscErrorCode.SCARD_E_SERVER_TOO_BUSY]: "Server too busy",
  [PcscErrorCode.SCARD_W_UNSUPPORTED_CARD]: "Unsupported card",
  [PcscErrorCode.SCARD_W_UNRESPONSIVE_CARD]: "Unresponsive card",
  [PcscErrorCode.SCARD_W_UNPOWERED_CARD]: "Unpowered card",
  [PcscErrorCode.SCARD_W_RESET_CARD]: "Reset card",
  [PcscErrorCode.SCARD_W_REMOVED_CARD]: "Removed card",
  [PcscErrorCode.SCARD_W_SECURITY_VIOLATION]: "Security violation",
  [PcscErrorCode.SCARD_W_WRONG_CHV]: "Wrong CHV",
  [PcscErrorCode.SCARD_W_CHV_BLOCKED]: "CHV blocked",
  [PcscErrorCode.SCARD_W_EOF]: "EOF",
  [PcscErrorCode.SCARD_W_CANCELLED_BY_USER]: "Cancelled by user",
  [PcscErrorCode.SCARD_W_CARD_NOT_AUTHENTICATED]: "Card not authenticated",
};

/**
 * @description Converts a PC/SC error code to a human-readable string.
 * @param {number} code The error code.
 * @returns {string} The error message, or a hex representation of the code if not found.
 */
export function pcsc_stringify_error(code: number): string {
  // In Windows, the error code is a signed 32-bit integer.
  // When the error code transferred to JavaScript, it became a negative value.
  // We need to convert it to an unsigned 32-bit integer.
  const unsignedCode = code < 0 ? code + 0x100000000 : code;

  return (
    PcscErrorMessages[unsignedCode] ||
    `Unknown error: 0x${unsignedCode.toString(16).padStart(8, "0")}`
  );
}

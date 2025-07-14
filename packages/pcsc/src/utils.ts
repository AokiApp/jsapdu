import {
  SmartCardError,
  SmartCardErrorCode,
  fromUnknownError,
} from "@aokiapp/interface";
import { 
  PcscErrorCode, 
  pcsc_stringify_error,
  SCardStatus,
  SCardListReaders,
  SCardGetStatusChange,
  MAX_ATR_SIZE,
  SCARD_STATE_UNAWARE,
  SCARD_STATE_PRESENT,
  SCARD_STATE_INUSE,
  SCARD_STATE_MUTE,
  SCARD_STATE_UNAVAILABLE,
  SCARD_STATE_EMPTY,
  SCARD_STATE_EXCLUSIVE,
  SCARD_STATE_UNPOWERED,
  SCARD_STATE_ATRMATCH,
  SCARD_STATE_CHANGED,
  SCARD_STATE_UNKNOWN,
  SCARD_STATE_IGNORE,
} from "@aokiapp/pcsc-ffi-node";

/**
 * Maps PC/SC error codes to SmartCardErrorCode
 */
export function mapPcscErrorToSmartCardErrorCode(
  pcscError: number,
): SmartCardErrorCode {
  // Convert negative values to unsigned 32-bit integers
  const unsignedCode = pcscError < 0 ? pcscError + 0x100000000 : pcscError;

  switch (unsignedCode) {
    case PcscErrorCode.SCARD_S_SUCCESS:
      return "PLATFORM_ERROR"; // This shouldn't happen as success is not an error
    case PcscErrorCode.SCARD_E_NO_SERVICE:
    case PcscErrorCode.SCARD_E_SERVICE_STOPPED:
      return "NOT_INITIALIZED";
    case PcscErrorCode.SCARD_E_INVALID_HANDLE:
      return "NOT_CONNECTED";
    case PcscErrorCode.SCARD_E_SHARING_VIOLATION:
      return "ALREADY_CONNECTED";
    case PcscErrorCode.SCARD_E_NO_SMARTCARD:
    case PcscErrorCode.SCARD_W_REMOVED_CARD:
      return "CARD_NOT_PRESENT";
    case PcscErrorCode.SCARD_F_COMM_ERROR:
    case PcscErrorCode.SCARD_E_NOT_TRANSACTED:
    case PcscErrorCode.SCARD_E_COMM_DATA_LOST:
      return "TRANSMISSION_ERROR";
    case PcscErrorCode.SCARD_E_PROTO_MISMATCH:
      return "PROTOCOL_ERROR";
    case PcscErrorCode.SCARD_E_TIMEOUT:
    case PcscErrorCode.SCARD_F_WAITED_TOO_LONG:
      return "TIMEOUT";
    case PcscErrorCode.SCARD_E_NO_READERS_AVAILABLE:
      return "NO_READERS";
    case PcscErrorCode.SCARD_E_READER_UNAVAILABLE:
    case PcscErrorCode.SCARD_E_UNKNOWN_READER:
      return "READER_ERROR";
    case PcscErrorCode.SCARD_E_NO_MEMORY:
    case PcscErrorCode.SCARD_E_INSUFFICIENT_BUFFER:
      return "RESOURCE_LIMIT";
    case PcscErrorCode.SCARD_E_INVALID_PARAMETER:
    case PcscErrorCode.SCARD_E_INVALID_VALUE:
      return "INVALID_PARAMETER";
    case PcscErrorCode.SCARD_E_UNEXPECTED: // Used instead of SCARD_E_UNSUPPORTED_FEATURE (same value)
    case PcscErrorCode.SCARD_E_CARD_UNSUPPORTED:
    case PcscErrorCode.SCARD_E_READER_UNSUPPORTED:
    case PcscErrorCode.SCARD_W_UNSUPPORTED_CARD:
      return "UNSUPPORTED_OPERATION";
    case PcscErrorCode.SCARD_E_CANCELLED:
    case PcscErrorCode.SCARD_E_SYSTEM_CANCELLED:
    case PcscErrorCode.SCARD_W_CANCELLED_BY_USER:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_E_NOT_READY:
    case PcscErrorCode.SCARD_E_NOT_TRANSACTED:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_E_INVALID_ATR:
      return "INVALID_PARAMETER";
    case PcscErrorCode.SCARD_E_DUPLICATE_READER:
      return "RESOURCE_LIMIT";
    case PcscErrorCode.SCARD_E_CARD_UNSUPPORTED:
      return "UNSUPPORTED_OPERATION";
    case PcscErrorCode.SCARD_E_NO_SUCH_CERTIFICATE:
    case PcscErrorCode.SCARD_E_CERTIFICATE_UNAVAILABLE:
      return "CARD_NOT_PRESENT";
    case PcscErrorCode.SCARD_W_UNRESPONSIVE_CARD:
      return "TRANSMISSION_ERROR";
    case PcscErrorCode.SCARD_W_UNPOWERED_CARD:
      return "CARD_NOT_PRESENT";
    case PcscErrorCode.SCARD_W_RESET_CARD:
      return "CARD_NOT_PRESENT";
    case PcscErrorCode.SCARD_W_SECURITY_VIOLATION:
    case PcscErrorCode.SCARD_E_NO_ACCESS:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_W_WRONG_CHV:
    case PcscErrorCode.SCARD_W_CHV_BLOCKED:
    case PcscErrorCode.SCARD_W_CARD_NOT_AUTHENTICATED:
    case PcscErrorCode.SCARD_E_INVALID_CHV:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_E_UNKNOWN_RES_MNG:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_E_NO_KEY_CONTAINER:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_E_SERVER_TOO_BUSY:
      return "RESOURCE_LIMIT";
    case PcscErrorCode.SCARD_E_CANT_DISPOSE:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_E_ICC_INSTALLATION:
    case PcscErrorCode.SCARD_E_ICC_CREATEORDER:
      return "PLATFORM_ERROR";
    case PcscErrorCode.SCARD_E_DIR_NOT_FOUND:
    case PcscErrorCode.SCARD_E_FILE_NOT_FOUND:
    case PcscErrorCode.SCARD_E_NO_DIR:
    case PcscErrorCode.SCARD_E_NO_FILE:
      return "RESOURCE_LIMIT";
    default:
      console.warn("Unknown PC/SC error code:", unsignedCode);
      return "PLATFORM_ERROR";
  }
}

/**
 * Converts a PC/SC error code to a SmartCardError
 */
export function pcscErrorToSmartCardError(pcscError: number): SmartCardError {
  if (pcscError === PcscErrorCode.SCARD_S_SUCCESS) {
    return new SmartCardError(
      "PLATFORM_ERROR",
      "Success code was treated as an error",
    );
  }

  const errorCode = mapPcscErrorToSmartCardErrorCode(pcscError);
  const errorMessage = pcsc_stringify_error(pcscError);

  return new SmartCardError(
    errorCode,
    `PC/SC Error: ${errorMessage}`,
    new Error(`PC/SC Error Code: 0x${pcscError.toString(16).padStart(8, "0")}`),
  );
}

export function ensureScardSuccess(scardStatus: number) {
  if (scardStatus !== PcscErrorCode.SCARD_S_SUCCESS) {
    throw pcscErrorToSmartCardError(scardStatus);
  }
}

/**
 * 非同期処理用の簡易Mutex
 */
export class AsyncMutex {
  private mutex = Promise.resolve();

  async lock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const p = new Promise<void>((resolve) => (release = resolve));
    const prev = this.mutex;
    this.mutex = this.mutex.then(() => p);
    await prev;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

/**
 * Converts a Uint8Array to a hexadecimal string
 */
export function uint8ArrayToHexString(array: Uint8Array): string {
  return Array.from(array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Converts a hexadecimal string to a Uint8Array
 */
export function hexStringToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even number of characters");
  }

  const result = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return result;
}

/**
 * Platform-specific encoding configuration for PC/SC
 */
export interface PlatformConfig {
  charSize: number;
  encoding: BufferEncoding;
}

/**
 * Get platform-specific configuration for Windows wide mode support
 */
export function getPlatformConfig(): PlatformConfig {
  const isWindows = process.platform === "win32";
  return {
    charSize: isWindows ? 2 : 1,
    encoding: isWindows ? "utf16le" : "utf8",
  };
}

/**
 * Result of SCardStatus call
 */
export interface SCardStatusResult {
  readerName: string;
  state: number;
  protocol: number;
  atr: Uint8Array;
}

/**
 * Call SCardStatus with automatic buffer size handling
 */
export async function callSCardStatus(cardHandle: number): Promise<SCardStatusResult> {
  const { charSize, encoding } = getPlatformConfig();
  
  // First call: get required buffer sizes
  let readerNameBuffer = null;
  let readerNameLength = [0];
  const state = [0];
  const protocol = [0];
  const atrBuffer = Buffer.alloc(36); // MAX_ATR_SIZE
  const atrLength = [atrBuffer.length];

  // Get required buffer size
  let ret = SCardStatus(
    cardHandle,
    readerNameBuffer,
    readerNameLength,
    state,
    protocol,
    atrBuffer,
    atrLength,
  );
  
  if (ret !== 0 && ret !== PcscErrorCode.SCARD_E_INSUFFICIENT_BUFFER) {
    ensureScardSuccess(ret);
  }

  // Second call: allocate buffer and get actual data
  readerNameBuffer = Buffer.alloc(readerNameLength[0] * charSize);
  ret = SCardStatus(
    cardHandle,
    readerNameBuffer,
    readerNameLength,
    state,
    protocol,
    atrBuffer,
    atrLength,
  );
  ensureScardSuccess(ret);

  // Parse results
  const readerName = readerNameBuffer.toString(encoding).replace(/\0+$/, '');
  const atrSize = atrLength[0];
  const atr = new Uint8Array(atrBuffer.slice(0, atrSize));

  return {
    readerName,
    state: state[0],
    protocol: protocol[0],
    atr,
  };
}

/**
 * Call SCardListReaders with automatic buffer size handling
 */
export async function callSCardListReaders(context: number): Promise<string[]> {
  const { charSize, encoding } = getPlatformConfig();
  
  // First call to get buffer size
  const pcchReaders = [0];
  let ret = SCardListReaders(context, null, null, pcchReaders);

  // Handle case where no readers are available
  if (ret === PcscErrorCode.SCARD_E_NO_READERS_AVAILABLE) {
    return [];
  }

  ensureScardSuccess(ret);

  const readerBufferSize = pcchReaders[0];
  if (readerBufferSize === 0) {
    return [];
  }

  // Second call: allocate buffer and get reader names
  const readersBuffer = Buffer.alloc(readerBufferSize * charSize);
  pcchReaders[0] = readerBufferSize;
  ret = SCardListReaders(context, null, readersBuffer, pcchReaders);
  ensureScardSuccess(ret);

  // Parse reader names
  return readersBuffer
    .toString(encoding)
    .split("\0")
    .filter((r) => r.length > 0);
}

// 状態ビット→ラベル
const STATE_FLAGS: [number, string][] = [
  [SCARD_STATE_PRESENT, "present"],
  [SCARD_STATE_INUSE, "inuse"],
  [SCARD_STATE_MUTE, "mute"],
  [SCARD_STATE_UNAVAILABLE, "unavailable"],
  [SCARD_STATE_EMPTY, "empty"],
  [SCARD_STATE_EXCLUSIVE, "exclusive"],
  [SCARD_STATE_UNPOWERED, "unpowered"],
  [SCARD_STATE_ATRMATCH, "atrmatch"],
  [SCARD_STATE_CHANGED, "changed"],
  [SCARD_STATE_UNKNOWN, "unknown"],
  [SCARD_STATE_IGNORE, "ignore"],
];

function parseStateFlags(dwEventState: number): string[] {
  return STATE_FLAGS.filter(([flag]) => (dwEventState & flag) !== 0).map(([, label]) => label);
}

function atrToHex(atr: Uint8Array): string {
  return Array.from(atr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Queries the current state of a smart card reader using SCardGetStatusChange (timeout=0),
 * and returns a JavaScript-esque object.
 * @param hContext PC/SC context handle
 * @param readerName Name of the reader to query
 * @returns {Promise<{ reader: string, state: string[], atr: string, atrBytes: Uint8Array }>} State info
 * @throws SmartCardError on failure
 */
export async function getReaderCurrentState(
  hContext: number,
  readerName: string
): Promise<{ reader: string; state: string[]; atr: string; atrBytes: Uint8Array }> {
  debugger; 
  const states = [
    {
      szReader: readerName,
      pvUserData: null,
      dwCurrentState: SCARD_STATE_UNAWARE,
      dwEventState: 0,
      cbAtr: 0,
      rgbAtr: new Uint8Array(MAX_ATR_SIZE),
    },
  ];
  const ret = SCardGetStatusChange(hContext, 0, states , states.length);
  ensureScardSuccess(ret);
  const s = states[0];
  const atrBytes = s.rgbAtr instanceof Uint8Array ? s.rgbAtr.slice(0, s.cbAtr) : new Uint8Array(s.rgbAtr).slice(0, s.cbAtr);
  return {
    reader: s.szReader,
    state: parseStateFlags(s.dwEventState),
    atr: atrToHex(atrBytes),
    atrBytes,
  };
}

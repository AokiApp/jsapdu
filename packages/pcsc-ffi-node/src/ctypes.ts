/**
 * @module types
 * @description This module defines the data types, structures, and constants used for interacting with the PC/SC API.
 * These definitions are based on the Microsoft WinSCard API and are used by Koffi to correctly marshal data between Node.js and the native PC/SC library.
 */
import koffi from "koffi";

/**
 * ## Basic Data Types
 *
 * These are fundamental data types used in the PC/SC API, mapped to their corresponding Koffi representations.
 * They form the building blocks for more complex structures and function signatures.
 */

/**
 * @description Represents a 32-bit unsigned integer.
 * This is commonly used for status codes, flags, and lengths.
 *
 * Note: While wintypes.h defines DWORD as 'unsigned long' on some platforms,
 * we use uint32 for consistency across all platforms, ensuring DWORD is always 32-bit
 * as expected by the PC/SC specification and Windows compatibility.
 */
export const DWORD = koffi.types.uint32;

/**
 * @description Represents a signed 32-bit integer.
 * In the context of PC/SC, this is often used for return codes from functions.
 * Using int32 ensures consistent 32-bit size across all platforms (Windows, Linux, macOS).
 * On Windows, LONG is always 32-bit. On Unix systems, we need to match this for compatibility.
 */
export const LONG = koffi.types.int32;

/**
 * @description Represents a pointer to a constant void (untyped memory).
 * This is used for generic data pointers that are not modified by the function.
 */
export const LPCVOID = "void*";

/**
 * @description Represents a pointer to void (untyped memory).
 * This is used for generic data pointers that can be modified by the function.
 */
export const LPVOID = "void*";

/**
 * @description Represents a pointer to a constant null-terminated string (C-style string).
 * Used for input string parameters.
 *
 * Note: On Windows, PC/SC functions have both A (ANSI) and W (Wide) versions.
 * This binding uses the A versions for cross-platform compatibility.
 * Strings are handled as UTF-8 on Unix and ANSI on Windows.
 */
export const LPCSTR = "const char*";

/**
 * @description Represents a pointer to a mutable null-terminated string (C-style string).
 * Used for output string buffers.
 *
 * Note: On Windows, PC/SC functions have both A (ANSI) and W (Wide) versions.
 * This binding uses the A versions for cross-platform compatibility.
 * Strings are handled as UTF-8 on Unix and ANSI on Windows.
 */
export const LPSTR = "char*";

/**
 * @description Represents a pointer to a constant wide null-terminated string (UTF-16).
 * Used for input string parameters in Windows W (Wide) functions.
 * Not used in current implementation but provided for completeness.
 */
export const LPCWSTR = "const char16_t*";

/**
 * @description Represents a pointer to a mutable wide null-terminated string (UTF-16).
 * Used for output string buffers in Windows W (Wide) functions.
 * Not used in current implementation but provided for completeness.
 */
export const LPWSTR = "char16_t*";

/**
 * @description Represents a pointer to a DWORD.
 * Note: The direction (in, out, inout) is not specified here.
 * It must be specified in the function definition where this type is used.
 * For example, use `koffi.inout(koffi.pointer(DWORD))` for in/out parameters.
 */
export const LPDWORD = koffi.pointer(DWORD);

/**
 * @description Represents a pointer to a byte (unsigned char).
 * This is commonly used for binary data buffers, such as the ATR string or APDUs.
 */
export const LPBYTE = "uchar*";

/**
 * @description Represents a pointer to a constant byte (unsigned char).
 * This is commonly used for binary data buffers that are not modified.
 */
export const LPCBYTE = "const uchar*";

/**
 * ## Additional wintypes.h Types
 *
 * These are additional types defined in wintypes.h that may be used in PC/SC operations.
 * Platform-specific definitions based on wintypes.h
 */

/**
 * @description Represents an unsigned 8-bit integer (byte).
 * Equivalent to uint8_t in C.
 */
export const BYTE = koffi.types.uint8;

/**
 * @description Represents an unsigned 8-bit character.
 * Equivalent to uint8_t in C.
 */
export const UCHAR = koffi.types.uint8;

/**
 * @description Represents an unsigned 16-bit integer.
 * Equivalent to uint16_t in C.
 */
export const USHORT = koffi.types.uint16;

/**
 * @description Represents an unsigned 32-bit integer.
 * Equivalent to uint32_t in C. Same as DWORD for consistency.
 */
export const ULONG = koffi.types.uint32;

/**
 * @description Represents an unsigned 16-bit word.
 * Equivalent to uint16_t in C.
 */
export const WORD = koffi.types.uint16;

/**
 * @description Represents a boolean value.
 * Using int32 to match the Windows SDK definition (int).
 */
export const BOOL = koffi.types.int32;

/**
 * @description Represents a pointer to ULONG.
 */
export const PULONG = koffi.pointer(ULONG);

/**
 * @description Represents a pointer to DWORD.
 */
export const PDWORD = koffi.pointer(DWORD);

/**
 * @description Represents a pointer to UCHAR.
 */
export const PUCHAR = koffi.pointer(UCHAR);

/**
 * ## PC/SC Specific Types
 *
 * These are handle types defined by the PC/SC standard. They are essentially pointers or identifiers
 * that refer to objects managed by the PC/SC resource manager.
 */

/**
 * @description Represents a handle to the PC/SC resource manager context.
 * This handle is the first thing you acquire and the last thing you release.
 *
 * On Windows x64, this is a `ULONG_PTR`, which is a 64-bit unsigned integer.
 * On 64-bit Linux with pcsc-lite, this is a `LONG`, which is a 64-bit signed integer.
 *
 * We use `uint64` for consistency across all supported 64-bit platforms. As handles are
 * opaque values, treating them as unsigned is safe and avoids potential sign-related issues.
 */
export const SCARDCONTEXT = koffi.types.uint64;

/**
 * @description Represents a pointer to a `SCARDCONTEXT`. This is used for output parameters
 * where a function (like `SCardEstablishContext`) returns a new context handle.
 */
export const LPSCARDCONTEXT = koffi.pointer(SCARDCONTEXT);

/**
 * @description Represents a handle to a specific smart card connection.
 * This handle is obtained from `SCardConnect` and used for all subsequent card operations.
 *
 * On Windows x64, this is a `ULONG_PTR`, which is a 64-bit unsigned integer.
 * On 64-bit Linux with pcsc-lite, this is a `LONG`, which is a 64-bit signed integer.
 *
 * We use `uint64` for consistency across all supported 64-bit platforms. As handles are
 * opaque values, treating them as unsigned is safe and avoids potential sign-related issues.
 */
export const SCARDHANDLE = koffi.types.uint64;

/**
 * @description Represents a pointer to a `SCARDHANDLE`. This is used for output parameters
 * where a function (like `SCardConnect`) returns a new card handle.
 * `koffi.out` signifies that the value is written by the native function.
 */
export const LPSCARDHANDLE = koffi.pointer(SCARDHANDLE);

/**
 * ## PC/SC Constants
 *
 * These are constants defined by the PC/SC standard for various operations.
 */

/**
 * @description Context scope constants for SCardEstablishContext
 */
export const SCARD_SCOPE_USER = 0x0000; // Scope in user space
export const SCARD_SCOPE_TERMINAL = 0x0001; // Scope in terminal
export const SCARD_SCOPE_SYSTEM = 0x0002; // Scope in system
export const SCARD_SCOPE_GLOBAL = 0x0003; // Scope is global

/**
 * @description Protocol constants for card communication
 */
export const SCARD_PROTOCOL_UNDEFINED = 0x0000; // Protocol not set
export const SCARD_PROTOCOL_UNSET = SCARD_PROTOCOL_UNDEFINED; // Backward compatibility
export const SCARD_PROTOCOL_T0 = 0x0001; // T=0 active protocol
export const SCARD_PROTOCOL_T1 = 0x0002; // T=1 active protocol
export const SCARD_PROTOCOL_RAW = 0x0004; // Raw active protocol
export const SCARD_PROTOCOL_T15 = 0x0008; // T=15 protocol
export const SCARD_PROTOCOL_ANY = SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1; // IFD determines protocol

/**
 * @description Share mode constants for SCardConnect
 */
export const SCARD_SHARE_EXCLUSIVE = 0x0001; // Exclusive mode only
export const SCARD_SHARE_SHARED = 0x0002; // Shared mode only
export const SCARD_SHARE_DIRECT = 0x0003; // Raw mode only

/**
 * @description Disposition constants for SCardDisconnect
 */
export const SCARD_LEAVE_CARD = 0x0000; // Do nothing on close
export const SCARD_RESET_CARD = 0x0001; // Reset on close
export const SCARD_UNPOWER_CARD = 0x0002; // Power down on close
export const SCARD_EJECT_CARD = 0x0003; // Eject on close

/**
 * @description Maximum reader name length
 */
export const MAX_READERNAME = 128;

/**
 * @description Maximum ATR size
 * Windows SDK uses 36 bytes, pcsc-lite uses 33 bytes.
 * Using 36 bytes for compatibility with both platforms.
 */
export const MAX_ATR_SIZE = 36;

/**
 * ## PC/SC Structures
 *
 * These are C-style structures used to pass more complex data to and from PC/SC functions.
 */

/**
 * @description Protocol Control Information (PCI) structure
 * Used in SCardTransmit to specify protocol parameters
 *
 * Note: While PCSC Lite defines cbPciLength as 'unsigned long' on some platforms,
 * we use DWORD (uint32) for both fields to ensure cross-platform consistency.
 * This matches the Windows SDK definition and ensures struct layout compatibility.
 */
export const SCARD_IO_REQUEST = koffi.struct("SCARD_IO_REQUEST", {
  dwProtocol: DWORD, // Protocol identifier
  cbPciLength: DWORD, // Protocol Control Information Length
});

/**
 * @description Pointer to SCARD_IO_REQUEST structure
 */
export const LPSCARD_IO_REQUEST = koffi.pointer(SCARD_IO_REQUEST);

/**
 * @description Pointer to constant SCARD_IO_REQUEST structure
 */
export const LPCSCARD_IO_REQUEST = koffi.pointer(SCARD_IO_REQUEST);

/**
 * @description Pre-defined Protocol Control Information for T=0 protocol
 * This is a global constant that should be used for T=0 transmissions
 */
export const SCARD_PCI_T0 = {
  dwProtocol: SCARD_PROTOCOL_T0,
  cbPciLength: koffi.sizeof(SCARD_IO_REQUEST),
};

/**
 * @description Pre-defined Protocol Control Information for T=1 protocol
 * This is a global constant that should be used for T=1 transmissions
 */
export const SCARD_PCI_T1 = {
  dwProtocol: SCARD_PROTOCOL_T1,
  cbPciLength: koffi.sizeof(SCARD_IO_REQUEST),
};

/**
 * @description Pre-defined Protocol Control Information for RAW protocol
 * This is a global constant that should be used for RAW transmissions
 */
export const SCARD_PCI_RAW = {
  dwProtocol: SCARD_PROTOCOL_RAW,
  cbPciLength: koffi.sizeof(SCARD_IO_REQUEST),
};

/**
 * @description Reader state structure for SCardGetStatusChange
 */
export const SCARD_READERSTATE = koffi.struct("SCARD_READERSTATE", {
  szReader: LPCSTR, // Reader name
  pvUserData: LPVOID, // User defined data
  dwCurrentState: DWORD, // Current state of reader at time of call
  dwEventState: DWORD, // State of reader after state change
  cbAtr: DWORD, // Number of bytes in the returned ATR
  rgbAtr: koffi.array("uchar", MAX_ATR_SIZE), // ATR of inserted card
});

/**
 * @description Pointer to SCARD_READERSTATE structure
 */
export const LPSCARD_READERSTATE = koffi.pointer(SCARD_READERSTATE);

/**
 * ## Card State Constants
 *
 * Constants for card and reader states
 */

/**
 * @description Card state constants
 */
export const SCARD_UNKNOWN = 0x0001; // Unknown state
export const SCARD_ABSENT = 0x0002; // Card is absent
export const SCARD_PRESENT = 0x0004; // Card is present
export const SCARD_SWALLOWED = 0x0008; // Card not powered
export const SCARD_POWERED = 0x0010; // Card is powered
export const SCARD_NEGOTIABLE = 0x0020; // Ready for PTS
export const SCARD_SPECIFIC = 0x0040; // PTS has been set

/**
 * @description Reader state constants for SCardGetStatusChange
 */
export const SCARD_STATE_UNAWARE = 0x0000; // App wants status
export const SCARD_STATE_IGNORE = 0x0001; // Ignore this reader
export const SCARD_STATE_CHANGED = 0x0002; // State has changed
export const SCARD_STATE_UNKNOWN = 0x0004; // Reader unknown
export const SCARD_STATE_UNAVAILABLE = 0x0008; // Status unavailable
export const SCARD_STATE_EMPTY = 0x0010; // Card removed
export const SCARD_STATE_PRESENT = 0x0020; // Card inserted
export const SCARD_STATE_ATRMATCH = 0x0040; // ATR matches card
export const SCARD_STATE_EXCLUSIVE = 0x0080; // Exclusive Mode
export const SCARD_STATE_INUSE = 0x0100; // Shared Mode
export const SCARD_STATE_MUTE = 0x0200; // Unresponsive card
export const SCARD_STATE_UNPOWERED = 0x0400; // Unpowered card

/**
 * @description Auto-allocation constant for dynamic buffer allocation
 */
export const SCARD_AUTOALLOCATE = 0xffffffff;

/**
 * @description Infinite timeout constant
 */
export const INFINITE = 0xffffffff;

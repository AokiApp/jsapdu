/**
 * @module functions
 * @description This module defines the Foreign Function Interface (FFI) for all the standard PC/SC functions.
 * It uses the `lib` object (the loaded native library) from the `ffi` module and the data types
 * from the `types` module to create JavaScript functions that can call directly into the native PC/SC code.
 * Each function is defined with its exact native signature, including the return type and the types of its parameters.
 */

import {
  DWORD,
  LONG,
  LPCVOID,
  LPSCARDCONTEXT,
  SCARDCONTEXT,
  SCARDHANDLE,
  LPSCARDHANDLE,
  LPCSTR,
  LPSTR,
  LPCWSTR,
  LPWSTR,
  LPDWORD,
  LPBYTE,
  LPCBYTE,
  LPCSCARD_IO_REQUEST,
  LPSCARD_IO_REQUEST,
  LPSCARD_READERSTATE,
} from "./ctypes";
import { lib } from "./ffi";
import koffi, { TypeSpec } from "koffi";
import { KoffiTypedFn } from "./types";

const isWindows = process.platform === "win32";

/**
 * @description Helper function to define PC/SC function prototypes with proper calling conventions.
 * On Windows, PC/SC functions use the WINAPI (__stdcall) calling convention.
 * On other platforms, they use the standard C calling convention.
 *
 * @param name - The name of the function to define
 * @param result - The return type of the function
 * @param args - Array of parameter types
 * @param WinApi - Optional parameter to specify WINAPI calling convention
 * @returns The defined function ready to be called
 */
function defProto(
  name: string,
  result: TypeSpec,
  args: TypeSpec[],
  WinApi?: "WINAPI",
) {
  if (isWindows && WinApi === "WINAPI") {
    return lib.func("__stdcall", name, result, args);
  } else {
    return lib.func(name, result, args);
  }
}

// Platform-specific type aliases for string pointers
const [LPCSTR_P, LPSTR_P] = isWindows ? [LPCWSTR, LPWSTR] : [LPCSTR, LPSTR];

/**
 * @description Establishes the resource manager context (the scope) for PC/SC operations.
 * This is typically the first PC/SC function you call. The context handle returned by this function
 * is used in all subsequent PC/SC operations.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardestablishcontext
 * @param {DWORD} dwScope - The scope of the establishment (SCARD_SCOPE_USER, SCARD_SCOPE_TERMINAL, SCARD_SCOPE_SYSTEM).
 * @param {LPCVOID} pvReserved1 - Reserved for future use, must be NULL.
 * @param {LPCVOID} pvReserved2 - Reserved for future use, must be NULL.
 * @param {LPSCARDCONTEXT} phContext - A pointer to receive the new context handle.
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardEstablishContext: KoffiTypedFn<
  (
    dwScope: "DWORD",
    pvReserved1: "LPCVOID@alwaysNull",
    pvReserved2: "LPCVOID@alwaysNull",
    phContext: "LPSCARDCONTEXT@out",
  ) => "LONG"
> = defProto(
  "SCardEstablishContext",
  LONG,
  [DWORD, LPCVOID, LPCVOID, koffi.out(LPSCARDCONTEXT)],
  "WINAPI",
);

/**
 * @description Terminates a connection to the PC/SC resource manager.
 * This function releases the context handle and any resources associated with it.
 * This is typically the last PC/SC function you call.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardreleasecontext
 * @param {SCARDCONTEXT} hContext - The context handle to release.
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardReleaseContext: KoffiTypedFn<
  (hContext: "SCARDCONTEXT") => "LONG"
> = defProto("SCardReleaseContext", LONG, [SCARDCONTEXT], "WINAPI");

/**
 * @description Lists the available smart card readers in the system.
 * This function can be called twice: first to get the required buffer size,
 * then with a properly sized buffer to get the actual reader names.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardlistreadersa
 * @param {SCARDCONTEXT} hContext - The context handle from SCardEstablishContext.
 * @param {LPCSTR} mszGroups - Reader groups to include in the search (usually NULL for all readers).
 * @param {LPSTR} mszReaders - Buffer to receive the reader names (can be NULL to get required size).
 * @param {LPDWORD} pcchReaders - Pointer to the buffer size (in/out parameter).
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardListReaders: KoffiTypedFn<
  (
    hContext: "SCARDCONTEXT",
    mszGroups: "LPCSTR@nullable",
    mszReaders: "LPSTR@nullable",
    pcchReaders: "LPDWORD@inout",
  ) => "LONG"
> = defProto(
  isWindows ? "SCardListReadersW" : "SCardListReaders",
  LONG,
  [SCARDCONTEXT, LPCSTR_P, LPSTR_P, koffi.inout(LPDWORD)],
  "WINAPI",
);

/**
 * @description Establishes a connection to a smart card in the specified reader.
 * This function returns a handle to the card that can be used for subsequent operations.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardconnecta
 * @param {SCARDCONTEXT} hContext - The context handle from SCardEstablishContext.
 * @param {LPCSTR} szReader - The name of the reader containing the card.
 * @param {DWORD} dwShareMode - How the card should be shared (SCARD_SHARE_EXCLUSIVE, SCARD_SHARE_SHARED, etc.).
 * @param {DWORD} dwPreferredProtocols - Protocols acceptable for this connection (SCARD_PROTOCOL_T0, SCARD_PROTOCOL_T1, etc.).
 * @param {LPSCARDHANDLE} phCard - Pointer to receive the card handle.
 * @param {LPDWORD} pdwActiveProtocol - Pointer to receive the active protocol.
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardConnect: KoffiTypedFn<
  (
    hContext: "SCARDCONTEXT",
    szReader: "LPCSTR",
    dwShareMode: "DWORD",
    dwPreferredProtocols: "DWORD",
    phCard: "LPSCARDHANDLE@out",
    pdwActiveProtocol: "LPDWORD@out",
  ) => "LONG"
> = defProto(
  isWindows ? "SCardConnectW" : "SCardConnect",
  LONG,
  [
    SCARDCONTEXT,
    LPCSTR_P,
    DWORD,
    DWORD,
    koffi.out(LPSCARDHANDLE),
    koffi.out(LPDWORD),
  ],
  "WINAPI",
);

/**
 * @description Terminates a connection to a smart card.
 * This function releases the card handle and performs the specified action on the card.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scarddisconnect
 * @param {SCARDHANDLE} hCard - The card handle from SCardConnect.
 * @param {DWORD} dwDisposition - Action to perform on the card (SCARD_LEAVE_CARD, SCARD_RESET_CARD, etc.).
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardDisconnect: KoffiTypedFn<
  (hCard: "SCARDHANDLE", dwDisposition: "DWORD") => "LONG"
> = defProto("SCardDisconnect", LONG, [SCARDHANDLE, DWORD], "WINAPI");

/**
 * @description Sends an APDU (Application Protocol Data Unit) to a smart card and receives the response.
 * This is the primary function for communicating with smart cards.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardtransmit
 * @param {SCARDHANDLE} hCard - The card handle from SCardConnect.
 * @param {LPCSCARD_IO_REQUEST} pioSendPci - Protocol control information for the send operation.
 * @param {LPCBYTE} pbSendBuffer - Buffer containing the APDU to send.
 * @param {DWORD} cbSendLength - Length of the send buffer.
 * @param {LPSCARD_IO_REQUEST} pioRecvPci - Protocol control information for the receive operation (can be NULL, in/out).
 * @param {LPBYTE} pbRecvBuffer - Buffer to receive the response.
 * @param {LPDWORD} pcbRecvLength - Pointer to the receive buffer size (in/out parameter).
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardTransmit: KoffiTypedFn<
  (
    hCard: "SCARDHANDLE",
    pioSendPci: "LPCSCARD_IO_REQUEST",
    pbSendBuffer: "LPCBYTE",
    cbSendLength: "DWORD",
    pioRecvPci: "LPSCARD_IO_REQUEST@nullable@inout",
    pbRecvBuffer: "LPBYTE@out",
    pcbRecvLength: "LPDWORD@inout",
  ) => "LONG"
> = defProto(
  "SCardTransmit",
  LONG,
  [
    SCARDHANDLE,
    LPCSCARD_IO_REQUEST,
    LPCBYTE,
    DWORD,
    koffi.inout(LPSCARD_IO_REQUEST),
    LPBYTE,
    koffi.inout(LPDWORD),
  ],
  "WINAPI",
);

/**
 * @description Retrieves the current status of a smart card.
 * This function can be used to get information about the card's state, protocol, and ATR.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardstatusa
 * @param {SCARDHANDLE} hCard - The card handle from SCardConnect.
 * @param {LPSTR} mszReaderNames - Buffer to receive the reader names. Pass a Buffer or null.
 * @param {LPDWORD} pcchReaderLen - Pointer to the reader names buffer size (in/out parameter). Pass array with size.
 * @param {LPDWORD} pdwState - Pointer to receive the card state. Pass array to receive value.
 * @param {LPDWORD} pdwProtocol - Pointer to receive the active protocol. Pass array to receive value.
 * @param {LPBYTE} pbAtr - Buffer to receive the ATR. Pass a Buffer or null.
 * @param {LPDWORD} pcbAtrLen - Pointer to the ATR buffer size (in/out parameter). Pass array with size.
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 *
 * Note: While the Windows SDK allows NULL for optional parameters, this binding requires
 * actual buffers and arrays for output parameters. Use appropriately sized buffers.
 */
export const SCardStatus: KoffiTypedFn<
  (
    hCard: "SCARDHANDLE",
    mszReaderNames: "LPSTR@nullable@out",
    pcchReaderLen: "LPDWORD@nullable@inout",
    pdwState: "LPDWORD@nullable@out",
    pdwProtocol: "LPDWORD@nullable@out",
    pbAtr: "LPBYTE@nullable@out",
    pcbAtrLen: "LPDWORD@nullable@inout",
  ) => "LONG"
> = defProto(
  isWindows ? "SCardStatusW" : "SCardStatus",
  LONG,
  [
    SCARDHANDLE,
    LPSTR_P,
    koffi.inout(LPDWORD),
    koffi.out(LPDWORD),
    koffi.out(LPDWORD),
    LPBYTE,
    koffi.inout(LPDWORD),
  ],
  "WINAPI",
);

/**
 * @description Begins a transaction on a smart card.
 * This function provides exclusive access to the card for the duration of the transaction.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardbegintransaction
 * @param {SCARDHANDLE} hCard - The card handle from SCardConnect.
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardBeginTransaction: KoffiTypedFn<
  (hCard: "SCARDHANDLE") => "LONG"
> = defProto("SCardBeginTransaction", LONG, [SCARDHANDLE], "WINAPI");

/**
 * @description Ends a transaction on a smart card.
 * This function releases the exclusive access to the card.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardendtransaction
 * @param {SCARDHANDLE} hCard - The card handle from SCardConnect.
 * @param {DWORD} dwDisposition - Action to perform on the card (SCARD_LEAVE_CARD, SCARD_RESET_CARD, etc.).
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardEndTransaction: KoffiTypedFn<
  (hCard: "SCARDHANDLE", dwDisposition: "DWORD") => "LONG"
> = defProto("SCardEndTransaction", LONG, [SCARDHANDLE, DWORD], "WINAPI");

/**
 * @description Cancels any pending operations on the specified context.
 * This function can be used to interrupt blocking operations.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardcancel
 * @param {SCARDCONTEXT} hContext - The context handle from SCardEstablishContext.
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardCancel: KoffiTypedFn<(hContext: "SCARDCONTEXT") => "LONG"> =
  defProto("SCardCancel", LONG, [SCARDCONTEXT], "WINAPI");

/**
 * @description Waits for a change in the state of a reader.
 * This function blocks until the state of one or more readers changes, or the timeout elapses.
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/api/winscard/nf-winscard-scardgetstatuschangea
 * @param {SCARDCONTEXT} hContext - The context handle from SCardEstablishContext.
 * @param {DWORD} dwTimeout - The maximum amount of time (in milliseconds) to wait for a state change, or INFINITE.
 * @param {LPSCARD_READERSTATE} rgReaderStates - Array of SCARD_READERSTATE structures (in/out parameter).
 * @param {DWORD} cReaders - Number of elements in rgReaderStates.
 * @returns {LONG} A status code, `SCARD_S_SUCCESS` on success.
 */
export const SCardGetStatusChange: KoffiTypedFn<
  (
    hContext: "SCARDCONTEXT",
    dwTimeout: "DWORD",
    rgReaderStates: "LPSCARD_READERSTATE@inout",
    cReaders: "DWORD"
  ) => "LONG"
> = defProto(
  isWindows ? "SCardGetStatusChangeW" : "SCardGetStatusChange",
  LONG,
  [
    SCARDCONTEXT,
    DWORD,
    koffi.inout(LPSCARD_READERSTATE),
    DWORD,
  ],
  "WINAPI"
);

/**
 * @module pcsc-ffi
 * @description This is the main entry point for the `pcsc-ffi` library.
 * It aggregates and exports all the necessary components from the various sub-modules,
 * providing a single, convenient point of access for consumers of the library.
 *
 * By importing from this file, you get access to:
 * - All PC/SC FFI function definitions (`functions.ts`).
 * - All data types, structures, and protocol constants (`types.ts`).
 * - All PC/SC error and success codes (`errors.ts`).
 */

/**
 * ## Platform Validation
 *
 * Only AMD64 and AArch64 platforms are supported. Panic on unsupported platforms.
 * This check is performed at library import time to fail fast on unsupported platforms.
 */
function validatePlatform(): void {
  const supportedArchs = ["x64", "arm64"];
  if (!supportedArchs.includes(process.arch)) {
    throw new Error(
      `Unsupported platform: ${process.platform}/${process.arch}. Only AMD64 (x64) and AArch64 (arm64) are supported.`,
    );
  }
}

// Validate platform immediately on library import
validatePlatform();

// Export all functions from the functions module.
// This includes SCardEstablishContext, SCardConnect, SCardTransmit, etc.
export * from "./functions";

// Export all types, structures, and constants from the types module.
// This includes DWORD, SCARDCONTEXT, SCARD_READERSTATE, SCARD_PROTOCOL_T0, etc.
export * from "./ctypes";

// Export all error codes from the errors module.
// This includes SCARD_S_SUCCESS, SCARD_E_INVALID_HANDLE, etc.
export * from "./errors";

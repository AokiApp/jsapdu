/**
 * @module ffi
 * @description This module is responsible for loading the correct native PC/SC library based on the host operating system.
 * It uses Koffi's `load` function to dynamically link to the appropriate shared library (`.dll`, `.so`, or `.framework`).
 * This abstracts away the platform-specific details of where the PC/SC implementation resides.
 */

import koffi from "koffi";

/**
 * @description Determines the name of the native PC/SC library file based on the current operating system.
 * - On Windows, it's `winscard.dll`.
 * - On macOS, it's `PCSC.framework/PCSC`.
 * - On Linux and other Unix-like systems, it's `libpcsclite.so.1`.
 */
const libraryName =
  process.platform === "win32"
    ? "winscard.dll"
    : process.platform === "darwin"
      ? "PCSC.framework/PCSC"
      : "libpcsclite.so.1";

/**
 * @description Loads the native PC/SC shared library into the Node.js process using Koffi.
 * The loaded library object (`lib`) is then used to define and call the native functions.
 * If the library cannot be found or loaded, Koffi will throw an error.
 */
export const lib = koffi.load(libraryName);

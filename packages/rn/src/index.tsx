/**
 * @module @aokiapp/jsapdu-rn
 * @description React Native NFC SmartCard Platform Implementation
 *
 * This package provides NFC-based SmartCard communication for React Native applications.
 * It implements the @aokiapp/jsapdu-interface abstractions using Android NFC APIs
 * (ReaderMode, IsoDep) via Nitro Modules for high-performance JSI communication.
 *
 * ## Features
 * - ISO-DEP APDU communication (contact and contactless)
 * - Extended APDU support (Lc/Le two-byte encoding)
 * - FFI-neutral error handling
 * - Resource lifecycle management
 * - Thread-safe operations
 *
 * ## Basic Usage
 *
 * @example
 * ```typescript
 * import { RnSmartCardPlatform } from '@aokiapp/jsapdu-rn';
 *
 * const platform = new RnSmartCardPlatform();
 * await platform.init();
 *
 * const devices = await platform.getDeviceInfo();
 * const device = await platform.acquireDevice(devices[0].id);
 * await device.waitForCardPresence(15000);
 * const card = await device.startSession();
 * const atr = await card.getAtr();
 * console.log('ATR:', Array.from(atr).map(b => b.toString(16)).join(' '));
 *
 * await card.release();
 * await platform.release();
 * ```
 *
 * ## Factory Function Usage
 *
 * @example
 * ```typescript
 * import { createPlatform } from '@aokiapp/jsapdu-rn';
 *
 * const platform = createPlatform();
 * await platform.init();
 * // ... use platform
 * ```
 *
 * ## Error Handling
 *
 * @example
 * ```typescript
 * import { RnSmartCardPlatform, mapNitroError } from '@aokiapp/jsapdu-rn';
 * import { SmartCardError } from '@aokiapp/jsapdu-interface';
 *
 * try {
 *   await platform.init();
 * } catch (error) {
 *   if (error instanceof SmartCardError) {
 *     if (error.code === 'PLATFORM_ERROR') {
 *       console.error('NFC not supported or disabled');
 *     }
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Implementation Classes
// ============================================================================

export { RnSmartCardPlatform } from './platform/rn-smart-card-platform';
export { RnSmartCardDevice } from './device/rn-smart-card-device';
export { RnSmartCard } from './card/rn-smart-card';
export { RnDeviceInfo } from './device/rn-device-info';

// ============================================================================
// Error Handling
// ============================================================================

export { mapNitroError } from './errors/error-mapper';

// ============================================================================
// Factory Functions (Convenience API)
// ============================================================================

import { RnSmartCardPlatform } from './platform/rn-smart-card-platform';

/**
 * Create a new SmartCard platform instance
 *
 * This is a convenience factory function that creates and returns
 * a new RnSmartCardPlatform instance. The platform is not initialized
 * automatically; you must call `init()` before use.
 *
 * @returns A new RnSmartCardPlatform instance
 *
 * @example
 * ```typescript
 * import { createPlatform } from '@aokiapp/jsapdu-rn';
 *
 * const platform = createPlatform();
 * await platform.init();
 *
 * const devices = await platform.getDeviceInfo();
 * console.log('Available devices:', devices.length);
 *
 * await platform.release();
 * ```
 */
export function createPlatform(): RnSmartCardPlatform {
  return new RnSmartCardPlatform();
}

/**
 * Create and initialize a new SmartCard platform instance
 *
 * This is a convenience function that creates a new platform
 * and automatically calls `init()`. Use this when you want
 * a ready-to-use platform instance.
 *
 * @returns An initialized RnSmartCardPlatform instance
 * @throws {SmartCardError} with code "ALREADY_INITIALIZED" if already initialized
 * @throws {SmartCardError} with code "PLATFORM_ERROR" if NFC is not supported
 *
 * @example
 * ```typescript
 * import { createAndInitPlatform } from '@aokiapp/jsapdu-rn';
 *
 * const platform = await createAndInitPlatform();
 * const devices = await platform.getDeviceInfo();
 * // ... use platform
 * await platform.release();
 * ```
 */
export async function createAndInitPlatform(): Promise<RnSmartCardPlatform> {
  const platform = new RnSmartCardPlatform();
  await platform.init();
  return platform;
}

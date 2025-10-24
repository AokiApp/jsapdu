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

import {
  SmartCardPlatform,
  SmartCardPlatformManager,
} from '@aokiapp/jsapdu-interface';
// ============================================================================
// Factory Functions (Convenience API)
// ============================================================================

import { RnSmartCardPlatform } from './platform/rn-smart-card-platform';

class RnSmartCardPlatformManager extends SmartCardPlatformManager {
  getPlatform(): SmartCardPlatform {
    return new RnSmartCardPlatform();
  }
}

export const platformManager = new RnSmartCardPlatformManager();

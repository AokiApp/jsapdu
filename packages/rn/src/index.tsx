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
 * @packageDocumentation
 */

// export type definitions for public API
export {
  type RnSmartCardPlatform,
  type PlatformEventPayload,
  type PlatformEventType,
} from './platform/rn-smart-card-platform';
export { type RnSmartCardDevice } from './device/rn-smart-card-device';
export { type RnSmartCard } from './card/rn-smart-card';
export { type RnDeviceInfo } from './device/rn-device-info';

import { SmartCardPlatformManager } from '@aokiapp/jsapdu-interface';
import { RnSmartCardPlatform } from './platform/rn-smart-card-platform';

class RnSmartCardPlatformManager extends SmartCardPlatformManager {
  getPlatform() {
    return new RnSmartCardPlatform();
  }
}

// singleton instance of the platform manager
export const platformManager = new RnSmartCardPlatformManager();

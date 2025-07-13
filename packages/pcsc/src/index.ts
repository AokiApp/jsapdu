/**
 * @module @aokiapp/pcsc
 * @description PC/SC Smart Card Platform Implementation
 *
 * This module provides a PC/SC implementation of the SmartCard interfaces defined in @aokiapp/interface.
 * It uses the PC/SC FFI bindings from @aokiapp/pcsc-ffi-node to interact with the native PC/SC library.
 *
 * The main entry point is the PcscPlatformManager, which provides access to the PC/SC platform.
 *
 * @example
 * ```typescript
 * import { PcscPlatformManager } from '@aokiapp/pcsc';
 *
 * async function main() {
 *   // Get the PC/SC platform manager
 *   const platformManager = PcscPlatformManager.getInstance();
 *
 *   // Get the PC/SC platform
 *   const platform = platformManager.getPlatform();
 *
 *   // Initialize the platform
 *   await platform.init();
 *
 *   try {
 *     // Get available readers
 *     const deviceInfos = await platform.getDeviceInfo();
 *
 *     if (deviceInfos.length === 0) {
 *       console.log('No readers found');
 *       return;
 *     }
 *
 *     // Acquire the first reader
 *     const device = await platform.acquireDevice(deviceInfos[0].id);
 *
 *     // Check if a card is present
 *     const isCardPresent = await device.isCardPresent();
 *
 *     if (!isCardPresent) {
 *       console.log('No card present');
 *       return;
 *     }
 *
 *     // Start a session with the card
 *     const card = await device.startSession();
 *
 *     // Get the ATR
 *     const atr = await card.getAtr();
 *     console.log('ATR:', Array.from(atr).map(b => b.toString(16).padStart(2, '0')).join(''));
 *
 *     // Release the card
 *     await card.release();
 *   } finally {
 *     // Release the platform
 *     await platform.release();
 *   }
 * }
 * ```
 */

export { PcscPlatformManager } from "./platform-manager.js";

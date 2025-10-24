package com.margelo.nitro.aokiapp.jsapdurn

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.ArrayBuffer
import app.aoki.jsapdu.rn.platform.SmartCardPlatformImpl
import app.aoki.jsapdu.rn.device.SmartCardDeviceImpl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers

/**
 * React Native Nitro Modules delegator for Android NFC with Coroutine support.
 *
 * Key improvements:
 * - Full integration with coroutine-enabled managers
 * - Proper exception handling and FFI-neutral error mapping
 * - CoroutineScope management for structured concurrency
 * - Enhanced resource lifecycle coordination
 * - Thread-safe operations with proper context switching
 *
 * FFI-neutral design:
 * - Public methods use generic terms (no ReaderMode, IsoDep, etc.)
 * - Internal managers handle Android-specific operations
 * - Error codes mapped to standard SmartCard error taxonomy
 * - All async operations properly managed through Promise.async
 *
 * Max: 350 lines per updated coding standards.
 */
@DoNotStrip
class JsapduRn : HybridJsapduRnSpec() {

  // CoroutineScope for structured concurrency management
  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

  // ============================================================================
  // Platform Management
  // ============================================================================

  /**
   * Initialize NFC platform with proper context management.
   *
   * @return Promise that completes when platform is initialized
   * @throws IllegalStateException with FFI-neutral error codes
   */
  override fun initPlatform(): Promise<Unit> = Promise.async {
    try {
      SmartCardPlatformImpl.initialize()
    } catch (e: IllegalStateException) {
      throw e // Re-throw mapped errors as-is
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Platform initialization failed: ${e.message}")
    }
  }

  /**
   * Release platform resources with proper cleanup coordination.
   *
   * @return Promise that completes when platform is released
   */
  override fun releasePlatform(): Promise<Unit> = Promise.async {
    try {
      SmartCardPlatformImpl.release()
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Platform release failed: ${e.message}")
    }
  }

  /**
   * Get available device information.
   *
   * @return Promise with array of DeviceInfo (0 or 1 element for integrated NFC)
   */
  override fun getDeviceInfo(): Promise<Array<DeviceInfo>> = Promise.async {
    try {
      SmartCardPlatformImpl.getDeviceInfo()
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to get device info: ${e.message}")
    }
  }

  /**
   * Acquire device and activate RF field.
   *
   * @param deviceId Device identifier from getDeviceInfo()
   * @return Promise with device handle for subsequent operations
   */
  override fun acquireDevice(deviceId: String): Promise<String> = Promise.async {
    try {
      SmartCardPlatformImpl.acquireDevice(deviceId)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to acquire device: ${e.message}")
    }
  }

  // ============================================================================
  // Device Management
  // ============================================================================

  /**
   * Check device availability (non-blocking).
   *
   * @param deviceHandle Device handle from acquireDevice()
   * @return Promise with availability status
   */
  override fun isDeviceAvailable(deviceHandle: String): Promise<Boolean> = Promise.async {
    try {
      SmartCardPlatformImpl.isDeviceAvailable(deviceHandle)
    } catch (e: Exception) {
      false // Return false on any error for availability check
    }
  }

  /**
   * Check card presence (non-blocking).
   *
   * @param deviceHandle Device handle from acquireDevice()
   * @return Promise with card presence status
   */
  override fun isCardPresent(deviceHandle: String): Promise<Boolean> = Promise.async {
    try {
      SmartCardPlatformImpl.isCardPresent(deviceHandle)
    } catch (e: Exception) {
      false // Return false on any error for presence check
    }
  }

  /**
   * Wait for card presence with timeout.
   *
   * @param deviceHandle Device handle from acquireDevice()
   * @param timeout Timeout in milliseconds
   * @return Promise that completes when card is detected or timeout occurs
   */
  override fun waitForCardPresence(deviceHandle: String, timeout: Double): Promise<Unit> = Promise.async {
    try {
      SmartCardPlatformImpl.waitForCardPresence(deviceHandle, timeout)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Card presence wait failed: ${e.message}")
    }
  }

  /**
   * Start communication session with detected card.
   *
   * @param deviceHandle Device handle from acquireDevice()
   * @return Promise with card handle for APDU operations
   */
  override fun startSession(deviceHandle: String): Promise<String> = Promise.async {
    try {
      SmartCardPlatformImpl.startSession(deviceHandle)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to start card session: ${e.message}")
    }
  }

  /**
   * Release device and deactivate RF field.
   *
   * @param deviceHandle Device handle from acquireDevice()
   * @return Promise that completes when device is released
   */
  override fun releaseDevice(deviceHandle: String): Promise<Unit> = Promise.async {
    try {
      SmartCardPlatformImpl.releaseDevice(deviceHandle)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to release device: ${e.message}")
    }
  }

  // ============================================================================
  // Card Communication
  // ============================================================================

  /**
   * Get ATR (Answer To Reset) or ATS (Answer To Select) from card.
   *
   * @param cardHandle Card handle from startSession()
   * @return Promise with ATR/ATS bytes as ArrayBuffer
   */
  override fun getAtr(cardHandle: String): Promise<ArrayBuffer> = Promise.async {
    try {
      SmartCardPlatformImpl.getAtr(cardHandle)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to get ATR: ${e.message}")
    }
  }

  /**
   * Transmit APDU command to card.
   *
   * @param cardHandle Card handle from startSession()
   * @param apdu APDU command as ArrayBuffer
   * @return Promise with response APDU (data + SW1/SW2) as ArrayBuffer
   */
  override fun transmit(cardHandle: String, apdu: ArrayBuffer): Promise<ArrayBuffer> = Promise.async {
    try {
      SmartCardPlatformImpl.transmit(cardHandle, apdu)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: APDU transmission failed: ${e.message}")
    }
  }

  /**
   * Reset card session (re-establish ISO-DEP connection).
   *
   * @param cardHandle Card handle from startSession()
   * @return Promise that completes when card is reset
   */
  override fun reset(cardHandle: String): Promise<Unit> = Promise.async {
    try {
      SmartCardPlatformImpl.reset(cardHandle)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Card reset failed: ${e.message}")
    }
  }

  /**
   * Release card session.
   *
   * @param cardHandle Card handle from startSession()
   * @return Promise that completes when card session is released
   */
  override fun releaseCard(cardHandle: String): Promise<Unit> = Promise.async {
    try {
      SmartCardPlatformImpl.releaseCard(cardHandle)
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to release card: ${e.message}")
    }
  }
}
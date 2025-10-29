package app.aoki.jsapdu.rn.device

import com.margelo.nitro.core.ArrayBuffer
import android.nfc.tech.IsoDep
import kotlinx.coroutines.runBlocking

/**
 * FFI-neutral device/card manager for Android NFC with Coroutine support.
 *
 * Unified interface that delegates to specialized coroutine-enabled managers:
 * - DeviceLifecycleManager: Device acquisition/release with Mutex protection
 * - CardSessionManager: Session management with async I/O operations
 * - ApduTransceiver: APDU/ATR communication with proper concurrency control
 *
 * Key improvements:
 * - Suspend function delegation to coroutine-enabled managers
 * - Proper exception propagation with FFI-neutral error codes
 * - Thread-safe coordination between different manager components
 * - Enhanced resource cleanup with coroutine cancellation support
 *
 * Responsibilities:
 * - Public API coordination and delegation
 * - Consistent error handling across all operations
 * - Resource lifecycle management coordination
 *
 * Max: 350 lines per updated coding standards.
 */
object SmartCardDeviceImpl {

  // Device lifecycle delegation (coroutine-enabled)

  suspend fun acquire(deviceHandle: String) {
    DeviceLifecycleManager.acquire(deviceHandle)
  }

  suspend fun release(deviceHandle: String) {
    DeviceLifecycleManager.release(deviceHandle)
  }

  fun isDeviceAvailable(deviceHandle: String): Boolean {
    return DeviceLifecycleManager.isDeviceAvailable(deviceHandle)
  }

  fun isCardPresent(deviceHandle: String): Boolean {
    return DeviceLifecycleManager.isCardPresent(deviceHandle)
  }

  suspend fun markCardPresent(deviceHandle: String, isoDep: IsoDep) {
    DeviceLifecycleManager.markCardPresent(deviceHandle, isoDep)
  }

  suspend fun markTagLost(deviceHandle: String) {
    DeviceLifecycleManager.markTagLost(deviceHandle)
  }

  /**
   * Wait for card presence with coroutine-based timeout handling.
   *
   * @param deviceHandle Device identifier
   * @param timeoutMs Timeout in milliseconds
   * @throws IllegalStateException with timeout or error codes
   */
  suspend fun waitForCardPresence(deviceHandle: String, timeoutMs: Double) {
    try {
      DeviceLifecycleManager.waitForCardPresence(deviceHandle, timeoutMs)
    } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
      throw IllegalStateException("TIMEOUT: ${e.message}")
    } catch (e: IllegalStateException) {
      throw e // Re-throw mapped errors as-is
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Wait operation failed: ${e.message}")
    }
  }

  // Session management delegation (coroutine-enabled)

  suspend fun startSession(deviceHandle: String): String {
    return CardSessionManager.startSession(deviceHandle)
  }

  suspend fun reset(cardHandle: String) {
    CardSessionManager.reset(cardHandle)
  }

  suspend fun releaseCard(cardHandle: String) {
    CardSessionManager.releaseCard(cardHandle)
  }

  // APDU/ATR communication delegation (coroutine-enabled)

  suspend fun getAtr(cardHandle: String): ArrayBuffer {
    return ApduTransceiver.getAtr(cardHandle)
  }

  suspend fun transmit(cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
    return ApduTransceiver.transmit(cardHandle, apdu)
  }

  // Cleanup coordination (coroutine-enabled)

  suspend fun cancelAllWaitsAndRelease() {
    try {
      // Clear all card sessions first
      CardSessionManager.clearAll()
      
      // Cancel device waits and release resources
      DeviceLifecycleManager.cancelAllWaitsAndRelease()
      
    } catch (e: Exception) {
      // Log error but ensure cleanup continues
      throw IllegalStateException("PLATFORM_ERROR: Cleanup failed: ${e.message}")
    }
  }

  // Validation utilities

  suspend fun validateDeviceState(deviceHandle: String) {
    DeviceLifecycleManager.withDeviceState(deviceHandle) { state ->
      if (state == null) {
        throw IllegalStateException("PLATFORM_ERROR: Device not found: $deviceHandle")
      }
      if (!state.isAcquired) {
        throw IllegalStateException("PLATFORM_ERROR: Device not acquired: $deviceHandle")
      }
    }
  }

  suspend fun validateCardSession(cardHandle: String) {
    CardSessionManager.validateCardSession(cardHandle)
  }

  // Bridge methods for non-coroutine callers (using runBlocking)
  // These are needed for compatibility with existing synchronous code

  fun acquireSync(deviceHandle: String) = runBlocking {
    acquire(deviceHandle)
  }

  fun releaseSync(deviceHandle: String) = runBlocking {
    release(deviceHandle)
  }

  fun markCardPresentSync(deviceHandle: String, isoDep: IsoDep) = runBlocking {
    markCardPresent(deviceHandle, isoDep)
  }

  fun markTagLostSync(deviceHandle: String) = runBlocking {
    markTagLost(deviceHandle)
  }

  fun waitForCardPresenceSync(deviceHandle: String, timeoutMs: Double) = runBlocking {
    waitForCardPresence(deviceHandle, timeoutMs)
  }

  fun startSessionSync(deviceHandle: String): String = runBlocking {
    startSession(deviceHandle)
  }

  fun resetSync(cardHandle: String) = runBlocking {
    reset(cardHandle)
  }

  fun releaseCardSync(cardHandle: String) = runBlocking {
    releaseCard(cardHandle)
  }

  fun getAtrSync(cardHandle: String): ArrayBuffer = runBlocking {
    getAtr(cardHandle)
  }

  fun transmitSync(cardHandle: String, apdu: ArrayBuffer): ArrayBuffer = runBlocking {
    transmit(cardHandle, apdu)
  }

  fun cancelAllWaitsAndReleaseSync() = runBlocking {
    cancelAllWaitsAndRelease()
  }
}
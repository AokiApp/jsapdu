package app.aoki.jsapdu.rn.old.device

import com.margelo.nitro.core.ArrayBuffer
import kotlinx.coroutines.runBlocking

/**
 * FFI-neutral device/card manager for Android NFC with Coroutine support.
 * Delegates to specialized managers while keeping API surface stable.
 */
object SmartCardDeviceImpl {
  suspend fun reset(cardHandle: String) {
    SmartCardServiceRegistry.getSessionsOrThrow().reset(cardHandle)
  }

  suspend fun releaseCard(cardHandle: String) {
    SmartCardServiceRegistry.getSessionsOrThrow().releaseCard(cardHandle)
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
      SmartCardServiceRegistry.getSessionsOrThrow().clearAll()
      // Platform-level cleanup (waiters/ReaderMode) is performed by SmartCardPlatformService
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Cleanup failed: ${e.message}")
    }
  }

  // Validation utilities


  suspend fun validateCardSession(cardHandle: String) {
    SmartCardServiceRegistry.getSessionsOrThrow().validateCardSession(cardHandle)
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
package app.aoki.jsapdu.rn.old.device

import android.nfc.tech.IsoDep
import android.nfc.TagLostException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload

/**
 * Card session management for Android NFC with Coroutine support.
 * Handles ISO-DEP connection, reset, and release operations with proper concurrency control.
 *
 * Key improvements:
 * - Kotlin Coroutine + Mutex for thread-safe session operations
 * - Proper I/O context switching for blocking NFC operations
 * - Enhanced error handling with FFI-neutral error mapping
 * - Resource cleanup with coroutine-aware exception handling
 * - Race condition prevention for session state transitions
 *
 * Max: 350 lines per updated coding standards.
 */
object CardSessionManager {

  private val sessionMutex = Mutex()
  private val cards: MutableMap<String, String> = ConcurrentHashMap() // cardHandle -> deviceHandle

  // tag for logging
  private const val TAG = "CardSessionManager"

  suspend fun startSession(deviceHandle: String): String {
    val state = DeviceLifecycleManager.getDeviceState(deviceHandle)
      ?: run {
        throw IllegalStateException("PLATFORM_ERROR: Device not acquired: $deviceHandle")
      }

    if (!state.isCardPresent) {
      throw IllegalStateException("CARD_NOT_PRESENT: Card not present in device: $deviceHandle")
    }

    // Check if session already active for this device
    val existingCardHandle = state.activeCardHandle
    if (existingCardHandle != null && cards.containsKey(existingCardHandle)) {
      throw IllegalStateException("ALREADY_CONNECTED: Card session already active: $existingCardHandle")
    }

    // Get IsoDep instance and establish connection
    val isoDep = DeviceLifecycleManager.getIsoDep(deviceHandle)
      ?: run {
        throw IllegalStateException("PLATFORM_ERROR: IsoDep not available for device: $deviceHandle")
      }

    return withContext(Dispatchers.IO) {
      try {
        // Ensure IsoDep connection is established
        if (!isoDep.isConnected) {
          isoDep.connect()
        }

        // Generate unique card handle and register session
        val cardHandle = "card-$deviceHandle-${System.currentTimeMillis()}"

        // Update state atomically within the lock
        sessionMutex.withLock {
          state.activeCardHandle = cardHandle
          cards[cardHandle] = deviceHandle
        }

        cardHandle
      } catch (e: IOException) {
        throw IllegalStateException("PLATFORM_ERROR: Failed to establish card connection: ${e.message}")
      } catch (e: TagLostException) {
        // Card was removed during connection attempt
        DeviceLifecycleManager.markTagLost(deviceHandle)
        throw IllegalStateException("PLATFORM_ERROR: Card removed during session start")
      } catch (e: SecurityException) {
        throw IllegalStateException("PLATFORM_ERROR: NFC permission denied: ${e.message}")
      }
    }
  }

  suspend fun reset(cardHandle: String) = sessionMutex.withLock {
    val deviceHandle = cards[cardHandle]
      ?: throw IllegalStateException("PLATFORM_ERROR: Card session not found: $cardHandle")
    
    val isoDep = DeviceLifecycleManager.getIsoDep(deviceHandle)
      ?: throw IllegalStateException("PLATFORM_ERROR: IsoDep session not active for card: $cardHandle")
    
    withContext(Dispatchers.IO) {
      try {
        // Close and reconnect IsoDep (RF field maintained by ReaderMode)
        if (isoDep.isConnected) {
          isoDep.close()
        }
        
        // Reconnect to reset card state
        isoDep.connect()
        
        // Emit CARD_SESSION_RESET on successful reconnect
        StatusEventDispatcher.emit(
          StatusEventType.CARD_SESSION_RESET,
          EventPayload(
            deviceHandle = deviceHandle,
            cardHandle = cardHandle,
            details = "Session reset"
          )
        )
        
      } catch (e: IOException) {
        // If reconnection fails, mark card as lost and propagate error
        DeviceLifecycleManager.markTagLost(deviceHandle)
        throw IllegalStateException("PLATFORM_ERROR: Failed to reset card session: ${e.message}")
      } catch (e: TagLostException) {
        // Card physically removed during reset
        DeviceLifecycleManager.markTagLost(deviceHandle)
        throw IllegalStateException("PLATFORM_ERROR: Card removed during reset")
      }
    }
  }

  suspend fun releaseCard(cardHandle: String) = sessionMutex.withLock {
    val deviceHandle = cards.remove(cardHandle) ?: return@withLock // Already released
    
    val state = DeviceLifecycleManager.getDeviceState(deviceHandle)
    state?.activeCardHandle = null
    
    // Close IsoDep connection on I/O thread
    val isoDep = DeviceLifecycleManager.getIsoDep(deviceHandle)
    if (isoDep != null && isoDep.isConnected) {
      withContext(Dispatchers.IO) {
        try {
          isoDep.close()
        } catch (_: Exception) {
          // Suppress close errors during cleanup - connection might already be closed
        }
      }
    }
    
    // Note: Keep isCardPresent true - physical card might still be present
    // Only mark as not present when explicitly lost via markTagLost()
  }

  // Internal access (thread-safe reads)

  fun getDeviceHandle(cardHandle: String): String? = cards[cardHandle]

  suspend fun clearAll() = sessionMutex.withLock {
    // Close all active sessions before clearing
    cards.keys.toList().forEach { cardHandle ->
      try {
        releaseCard(cardHandle)
      } catch (_: Exception) {
        // Suppress errors during cleanup
      }
    }
    cards.clear()
  }

  // Session validation utilities

  suspend fun validateCardSession(cardHandle: String) = sessionMutex.withLock {
    val deviceHandle = cards[cardHandle]
      ?: throw IllegalStateException("PLATFORM_ERROR: Card session not found: $cardHandle")
    
    DeviceLifecycleManager.withDeviceState(deviceHandle) { state ->
      if (state == null) {
        throw IllegalStateException("PLATFORM_ERROR: Device not available for card: $cardHandle")
      }
      
      if (!state.isAcquired) {
        throw IllegalStateException("PLATFORM_ERROR: Device not acquired for card: $cardHandle")
      }
      
      if (!state.isCardPresent) {
        throw IllegalStateException("CARD_NOT_PRESENT: Card not present for handle: $cardHandle")
      }
    }
  }
}
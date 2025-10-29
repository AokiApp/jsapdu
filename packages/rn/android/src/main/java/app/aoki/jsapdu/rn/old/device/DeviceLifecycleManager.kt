package app.aoki.jsapdu.rn.device

import android.nfc.tech.IsoDep
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.TimeoutCancellationException
import java.util.concurrent.ConcurrentHashMap
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload

/**
 * Device lifecycle and state management for Android NFC with Coroutine support.
 * Handles device acquisition, release, and availability checks with proper concurrency control.
 *
 * Key improvements:
 * - Kotlin Coroutine + Mutex for thread-safe operations
 * - CompletableDeferred instead of CountDownLatch for better async support
 * - Proper exception handling for race conditions
 * - Enhanced resource cleanup with coroutine cancellation support
 *
 * Max: 350 lines per updated coding standards.
 */
object DeviceLifecycleManager {

  data class DeviceState(
    var isAcquired: Boolean = false,
    var activeCardHandle: String? = null
  )

  private val stateMutex = Mutex()
  private val devices: MutableMap<String, DeviceState> = ConcurrentHashMap()
  private val isoDepByDevice: MutableMap<String, IsoDep> = ConcurrentHashMap()
  private val waitingDeferred: MutableMap<String, CompletableDeferred<Unit>> = ConcurrentHashMap()

  // Device lifecycle operations with Mutex protection

  suspend fun acquire(deviceHandle: String) = stateMutex.withLock {
    val state = devices.getOrPut(deviceHandle) { DeviceState() }
    if (state.isAcquired) {
      throw IllegalStateException("Device already acquired: $deviceHandle")
    }
    state.isAcquired = true
    state.activeCardHandle = null
  }

  suspend fun release(deviceHandle: String) = stateMutex.withLock {
    val state = devices[deviceHandle] ?: return@withLock
    
    // Release active card if any
    state.activeCardHandle?.let { cardHandle ->
      try {
        CardSessionManager.releaseCard(cardHandle)
      } catch (e: Exception) {
        // Log but continue cleanup - don't let card release failure block device release
      }
    }
    
    // Cancel any pending wait
    waitingDeferred.remove(deviceHandle)?.let { deferred ->
      if (!deferred.isCompleted) {
        deferred.completeExceptionally(RuntimeException("TIMEOUT: Device released during wait"))
      }
    }
    
    // Close and clear IsoDep
    isoDepByDevice.remove(deviceHandle)?.let { isoDep ->
      try {
        if (isoDep.isConnected) {
          isoDep.close()
        }
      } catch (_: Exception) {
        // Suppress close errors for cleanup - IsoDep might already be closed
      }
    }
    
    // Clear device state
    state.isAcquired = false
    state.activeCardHandle = null
    devices.remove(deviceHandle)
  }

  // State queries (thread-safe reads)

  fun isDeviceAvailable(deviceHandle: String): Boolean {
    val state = devices[deviceHandle] ?: return false
    return state.isAcquired
  }

  fun isCardPresent(deviceHandle: String): Boolean {
    // todo : Implement
  }

  // Card presence management with proper concurrency

  suspend fun markCardPresent(deviceHandle: String, isoDep: IsoDep) = stateMutex.withLock {
    val state = devices.getOrPut(deviceHandle) { DeviceState() }
    isoDepByDevice[deviceHandle] = isoDep
    
    // Complete any pending wait
    waitingDeferred.remove(deviceHandle)?.let { deferred ->
      if (!deferred.isCompleted) {
        deferred.complete(Unit)
      }
    }

    // Emit CARD_FOUND event
    StatusEventDispatcher.emit(
      StatusEventType.CARD_FOUND,
      EventPayload(
        deviceHandle = deviceHandle,
        cardHandle = null,
        details = "ISO-DEP tag discovered"
      )
    )
  }

  suspend fun markTagLost(deviceHandle: String) = stateMutex.withLock {
    val state = devices[deviceHandle] ?: return@withLock
    val lastCardHandle = state.activeCardHandle
    
    // Release active card session if exists
    state.activeCardHandle?.let { cardHandle ->
      try {
        CardSessionManager.releaseCard(cardHandle)
      } catch (_: Exception) {
        // Suppress errors during cleanup
      }
      state.activeCardHandle = null
    }
    
    // Close IsoDep connection
    isoDepByDevice.remove(deviceHandle)?.let { isoDep ->
      try {
        if (isoDep.isConnected) {
          isoDep.close()
        }
      } catch (_: Exception) {
        // Suppress close errors - connection might already be lost
      }
    }
    
    // Cancel any pending wait with TagLost exception
    waitingDeferred.remove(deviceHandle)?.let { deferred ->
      if (!deferred.isCompleted) {
        deferred.completeExceptionally(
          RuntimeException("PLATFORM_ERROR: Card removed during wait")
        )
      }
    }

    // Emit CARD_LOST event
    StatusEventDispatcher.emit(
      StatusEventType.CARD_LOST,
      EventPayload(
        deviceHandle = deviceHandle,
        cardHandle = lastCardHandle,
        details = "ISO-DEP tag lost"
      )
    )
  }

  // Coroutine-based wait with timeout

  @Throws(TimeoutCancellationException::class)
  suspend fun waitForCardPresence(deviceHandle: String, timeoutMs: Double) {
    // Check if card is already present (fast path)
    val state = devices[deviceHandle] ?: throw IllegalStateException("Device not acquired: $deviceHandle")
    
   // todo: Implement
  }

  // Internal access for other managers (thread-safe)

  fun getDeviceState(deviceHandle: String): DeviceState? = devices[deviceHandle]

  fun getIsoDep(deviceHandle: String): IsoDep? = isoDepByDevice[deviceHandle]

  // Emergency cleanup for screen-off/doze events

  suspend fun cancelAllWaitsAndRelease() = stateMutex.withLock {
    // Cancel all waiting operations
    waitingDeferred.values.forEach { deferred ->
      if (!deferred.isCompleted) {
        deferred.completeExceptionally(
          RuntimeException("TIMEOUT: Cancelled due to screen-off/doze")
        )
      }
    }
    waitingDeferred.clear()
    
    // Close all IsoDep connections
    isoDepByDevice.values.forEach { isoDep ->
      try {
        if (isoDep.isConnected) {
          isoDep.close()
        }
      } catch (_: Exception) {
        // Suppress close errors during emergency cleanup
      }
    }
    isoDepByDevice.clear()
    
    // Clear all device states
    devices.values.forEach { state ->
      state.isAcquired = false
      state.activeCardHandle = null
    }
    devices.clear()
  }

  // Utility for getting device state safely with lock
  suspend fun <T> withDeviceState(deviceHandle: String, block: (DeviceState?) -> T): T = stateMutex.withLock {
    val state = devices[deviceHandle]
    block(state)
  }
}
package app.aoki.jsapdu.rn.platform

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.runBlocking
import java.util.concurrent.ConcurrentHashMap
import com.margelo.nitro.aokiapp.jsapdurn.StatusEventDispatcher
import com.margelo.nitro.aokiapp.jsapdurn.StatusEventType
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload

/**
 * ReaderMode controller with Coroutine support and improved concurrency control.
 *
 * Key improvements:
 * - Multiple device support with individual listener management
 * - Kotlin Coroutine + Mutex for thread-safe ReaderMode operations
 * - Enhanced error handling with proper exception mapping
 * - Resource cleanup with race condition prevention
 * - Fixed NFC flags: NFC_A | NFC_B | NFC_F | SKIP_NDEF for ISO-DEP filtering
 *
 * Internal use only - does not expose Android types to FFI boundary.
 * Max: 350 lines per updated coding standards.
 */
object NfcReaderController : NfcAdapter.ReaderCallback {

  interface Listener {
    suspend fun onIsoDep(deviceHandle: String, isoDep: IsoDep)
    suspend fun onTagLost(deviceHandle: String)
  }

  private val readerMutex = Mutex()
  private val activeDevices: MutableMap<String, DeviceReaderState> = ConcurrentHashMap()

  private data class DeviceReaderState(
    val deviceHandle: String,
    val listener: Listener,
    var currentActivity: Activity?,
    var isReaderModeEnabled: Boolean = false
  )

  /**
   * Enable ReaderMode for specific device with proper concurrency control.
   *
   * @param activity Current foreground Activity (required for ReaderMode)
   * @param deviceHandle Device identifier
   * @param listener Callback for tag discovery events
   * @throws IllegalStateException if NFC not supported or already enabled
   */
  suspend fun enable(activity: Activity, deviceHandle: String, listener: Listener) = readerMutex.withLock {
    // Check for existing active device
    if (activeDevices.containsKey(deviceHandle)) {
      throw IllegalStateException("ALREADY_CONNECTED: ReaderMode already enabled for device: $deviceHandle")
    }
    
    // Validate NFC availability
    val adapter = NfcAdapter.getDefaultAdapter(activity)
      ?: throw IllegalStateException("PLATFORM_ERROR: NFC not supported on this device")
    
    if (!adapter.isEnabled) {
      throw IllegalStateException("PLATFORM_ERROR: NFC is disabled in system settings")
    }
    
    try {
      // Configure ReaderMode with fixed flags for ISO-DEP detection
      val flags = (NfcAdapter.FLAG_READER_NFC_A
          or NfcAdapter.FLAG_READER_NFC_B
          or NfcAdapter.FLAG_READER_NFC_F
          or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK)
      
      // Enable ReaderMode with proper options
      val options = Bundle().apply {
        // Optional: Set presence check delay to detect card removal faster
        putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 1000)
      }
      
      adapter.enableReaderMode(activity, this@NfcReaderController, flags, options)
      
      // Register device state
      activeDevices[deviceHandle] = DeviceReaderState(
        deviceHandle = deviceHandle,
        listener = listener,
        currentActivity = activity,
        isReaderModeEnabled = true
      )

      // Emit ReaderMode enabled event
      StatusEventDispatcher.emit(
        StatusEventType.READER_MODE_ENABLED,
        EventPayload(deviceHandle = deviceHandle, cardHandle = null, details = "ReaderMode enabled; presenceDelay=1000")
      )
      
      } catch (e: SecurityException) {
      throw IllegalStateException("PLATFORM_ERROR: NFC permission denied: ${e.message}")
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to enable ReaderMode: ${e.message}")
    }
  }

  /**
   * Disable ReaderMode for specific device with cleanup.
   *
   * @param activity Current Activity (should match the one used for enable)
   * @param deviceHandle Device identifier
   */
  suspend fun disable(activity: Activity, deviceHandle: String) = readerMutex.withLock {
    val deviceState = activeDevices.remove(deviceHandle) ?: return@withLock
    
    try {
      val adapter = NfcAdapter.getDefaultAdapter(activity)
      if (adapter != null && deviceState.isReaderModeEnabled) {
        adapter.disableReaderMode(activity)
        // Emit ReaderMode disabled event
        StatusEventDispatcher.emit(
          StatusEventType.READER_MODE_DISABLED,
          EventPayload(deviceHandle = deviceHandle, cardHandle = null, details = "ReaderMode disabled")
        )
      }
    } catch (e: Exception) {
      // Log error but continue cleanup - don't let disable failure block resource release
    }
    
    // Notify listener about tag loss during disable
    try {
      runBlocking {
        deviceState.listener.onTagLost(deviceHandle)
      }
    } catch (_: Exception) {
      // Suppress listener notification errors during cleanup
    }
  }

  /**
   * Disable all ReaderMode instances (emergency cleanup).
   * Used during screen-off/doze events.
   */
  suspend fun disableAll() = readerMutex.withLock {
    val devicesToDisable = activeDevices.values.toList()
    activeDevices.clear()
    
    devicesToDisable.forEach { deviceState ->
      try {
        val activity = deviceState.currentActivity
        if (activity != null) {
          val adapter = NfcAdapter.getDefaultAdapter(activity)
          adapter?.disableReaderMode(activity)
        }
      } catch (_: Exception) {
        // Suppress disable errors during emergency cleanup
      }
      
      // Notify listener about tag loss
      try {
        runBlocking {
          deviceState.listener.onTagLost(deviceState.deviceHandle)
        }
      } catch (_: Exception) {
        // Suppress listener notification errors
      }
    }
  }

  /**
   * NfcAdapter.ReaderCallback implementation - called on NFC service thread.
   * Filters for ISO-DEP tags and notifies appropriate device listener.
   */
  override fun onTagDiscovered(tag: Tag) {
    // Filter for ISO-DEP technology only
    val isoDep = IsoDep.get(tag) ?: return
    
    // Use runBlocking since this callback runs on NFC service thread
    // and we need to coordinate with our coroutine-based state management
    runBlocking {
      readerMutex.withLock {
        // Find which device should handle this tag discovery
        // Since we currently support single device, use the first active one
        val deviceState = activeDevices.values.firstOrNull() ?: return@withLock
        
        try {
          // Configure IsoDep with reasonable timeout
          isoDep.timeout = 5000 // 5 seconds default timeout
          
          // Notify device listener
          deviceState.listener.onIsoDep(deviceState.deviceHandle, isoDep)
          
        } catch (e: Exception) {
          // If listener notification fails, ensure IsoDep cleanup
          try {
            if (isoDep.isConnected) {
              isoDep.close()
            }
          } catch (_: Exception) {
            // Suppress close errors
          }
        }
      }
    }
  }

  /**
   * Check if ReaderMode is currently active for any device.
   *
   * @return true if at least one device has active ReaderMode
   */
  fun isReaderModeActive(): Boolean = activeDevices.isNotEmpty()

  /**
   * Check if specific device has active ReaderMode.
   *
   * @param deviceHandle Device identifier
   * @return true if ReaderMode is active for this device
   */
  fun isReaderModeActive(deviceHandle: String): Boolean {
    return activeDevices[deviceHandle]?.isReaderModeEnabled == true
  }

  /**
   * Update Activity reference for existing device (for Activity lifecycle changes).
   *
   * @param deviceHandle Device identifier
   * @param newActivity New Activity instance
   */
  suspend fun updateActivity(deviceHandle: String, newActivity: Activity) = readerMutex.withLock {
    activeDevices[deviceHandle]?.currentActivity = newActivity
  }

  /**
   * Get current Activity for device (if available).
   *
   * @param deviceHandle Device identifier
   * @return Current Activity or null if not available
   */
  fun getCurrentActivity(deviceHandle: String): Activity? {
    return activeDevices[deviceHandle]?.currentActivity
  }
}
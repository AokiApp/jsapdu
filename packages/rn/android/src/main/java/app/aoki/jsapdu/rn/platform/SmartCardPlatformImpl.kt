package app.aoki.jsapdu.rn.platform

import android.content.Context
import android.nfc.NfcAdapter
import android.nfc.tech.IsoDep
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.aokiapp.jsapdurn.D2CProtocol
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.P2DProtocol
import app.aoki.jsapdu.rn.device.SmartCardDeviceImpl
import app.aoki.jsapdu.rn.device.DeviceLifecycleManager
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.runBlocking
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import com.margelo.nitro.aokiapp.jsapdurn.StatusEventDispatcher
import com.margelo.nitro.aokiapp.jsapdurn.StatusEventType
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload

/**
 * FFI-neutral platform manager for Android NFC with Coroutine support.
 *
 * Key improvements:
 * - Kotlin Coroutine + Mutex for thread-safe platform operations
 * - Enhanced initialization with proper resource management
 * - Improved error handling with FFI-neutral error codes
 * - Coroutine-aware screen-off/doze event handling
 * - Race condition prevention for platform state transitions
 *
 * Notes:
 * - No Android-specific terms in external APIs; internal use only
 * - All suspend functions use appropriate Dispatchers for I/O operations
 * - JsapduRn.kt delegates to this singleton for all platform operations
 *
 * Max: 350 lines per updated coding standards.
 */
object SmartCardPlatformImpl {

  private const val DEFAULT_TIMEOUT_MS = 30000.0

  private val platformMutex = Mutex()
  private var appContext: ReactApplicationContext? = null
  private var nfcAdapter: NfcAdapter? = null
  private var initialized: Boolean = false

  /**
   * Initialize platform with proper resource setup and error handling.
   *
   * @param context Application context
   * @throws IllegalStateException if already initialized or NFC not supported
   */
  suspend fun initialize() = platformMutex.withLock {
    if (initialized) {
      throw IllegalStateException("ALREADY_INITIALIZED: Platform already initialized")
    }

    appContext = NitroModules.applicationContext
      ?: throw IllegalStateException("PLATFORM_ERROR: No valid application context available")
    
    try {
      nfcAdapter = NfcAdapter.getDefaultAdapter(appContext)
      
      if (nfcAdapter == null) {
        throw IllegalStateException("PLATFORM_ERROR: NFC hardware not available on this device")
      }
      
      // Register screen-off/idle receivers for resource cleanup
      val ctx = appContext
      if (ctx != null) {
        ScreenStateReceiver.register(ctx) {
          // Use runBlocking since BroadcastReceiver callback is not suspend
          runBlocking {
            SmartCardDeviceImpl.cancelAllWaitsAndRelease()
            NfcReaderController.disableAll()
          }
        }
      }
      
      initialized = true
      
    } catch (e: SecurityException) {
      throw IllegalStateException("PLATFORM_ERROR: NFC permission denied: ${e.message}")
    } catch (e: IllegalStateException) {
      // Re-throw our mapped errors as-is
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to initialize NFC platform: ${e.message}")
    }
  }

  /**
   * Release platform resources with proper cleanup.
   *
   * @throws IllegalStateException if not initialized
   */
  suspend fun release() = platformMutex.withLock {
    if (!initialized) {
      throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
    }
    
    try {
      // Unregister screen state receiver
      ScreenStateReceiver.unregister(appContext!! as Context)

      // Disable all ReaderMode instances and cleanup resources
      NfcReaderController.disableAll()
      SmartCardDeviceImpl.cancelAllWaitsAndRelease()
      
      nfcAdapter = null
      initialized = false
      
    } catch (e: Exception) {
      // Ensure platform is marked as uninitialized even if cleanup fails
      initialized = false
      throw IllegalStateException("PLATFORM_ERROR: Error during platform release: ${e.message}")
    }
  }

  /**
   * Get available device information.
   * Returns single integrated NFC device or empty array if NFC unavailable.
   *
   * @return Array of DeviceInfo (0 or 1 element)
   */
  suspend fun getDeviceInfo(): Array<DeviceInfo> = platformMutex.withLock {
    ensureInitialized()
    
    val adapter = nfcAdapter
    if (adapter == null || !adapter.isEnabled) {
      return@withLock emptyArray() // NFC disabled or unavailable
    }
    
    arrayOf(
      DeviceInfo(
        id = "integrated-nfc-0",
        devicePath = null,
        friendlyName = "Integrated NFC Reader",
        description = "Android NFC with ISO-DEP support",
        supportsApdu = true,
        supportsHce = false, // HCE not implemented in initial version
        isIntegratedDevice = true,
        isRemovableDevice = false,
        d2cProtocol = D2CProtocol.NFC,
        p2dProtocol = P2DProtocol.NFC,
        apduApi = arrayOf("nfc", "androidnfc")
      )
    )
  }

  /**
   * Acquire device and activate RF field.
   *
   * @param deviceId Device identifier from getDeviceInfo()
   * @return Device handle for subsequent operations
   * @throws IllegalStateException with FFI-neutral error codes
   */
  suspend fun acquireDevice(deviceId: String): String = platformMutex.withLock {
    ensureInitialized()
    
    val adapter = nfcAdapter
      ?: throw IllegalStateException("PLATFORM_ERROR: NFC not supported")
    
    if (!adapter.isEnabled) {
      throw IllegalStateException("PLATFORM_ERROR: NFC is disabled in system settings")
    }
    
    val handle = "handle-$deviceId-${System.currentTimeMillis()}"
    
    // Get current Activity for ReaderMode
    val activity = appContext?.getCurrentActivity() ?: throw IllegalStateException("PLATFORM_ERROR: No foreground Activity available for ReaderMode")
    
    try {
      // Acquire device in lifecycle manager first
      DeviceLifecycleManager.acquire(handle)
      
      // Enable ReaderMode with coroutine-aware listener
      NfcReaderController.enable(activity, handle, object : NfcReaderController.Listener {
        override suspend fun onIsoDep(deviceHandle: String, isoDep: IsoDep) {
          DeviceLifecycleManager.markCardPresent(deviceHandle, isoDep)
        }
        
        override suspend fun onTagLost(deviceHandle: String) {
          DeviceLifecycleManager.markTagLost(deviceHandle)
        }
      })
      
      // Emit device acquired event
      StatusEventDispatcher.emit(
        StatusEventType.DEVICE_ACQUIRED,
        EventPayload(deviceHandle = handle, cardHandle = null, details = "ReaderMode enabled")
      )

      return@withLock handle
      
    } catch (e: IllegalStateException) {
      // Clean up device if ReaderMode enable failed
      try {
        DeviceLifecycleManager.release(handle)
      } catch (_: Exception) {
        // Suppress cleanup errors
      }
      throw e
    } catch (e: SecurityException) {
      throw IllegalStateException("PLATFORM_ERROR: NFC permission denied: ${e.message}")
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to acquire device: ${e.message}")
    }
  }

  /**
   * Check if device is available (non-blocking).
   */
  fun isDeviceAvailable(deviceHandle: String): Boolean {
    if (!initialized) return false
    val adapter = nfcAdapter ?: return false
    return adapter.isEnabled && DeviceLifecycleManager.isDeviceAvailable(deviceHandle)
  }

  /**
   * Check if card is present (non-blocking).
   */
  fun isCardPresent(deviceHandle: String): Boolean {
    ensureInitialized()
    return DeviceLifecycleManager.isCardPresent(deviceHandle)
  }

  /**
   * Wait for card presence with timeout.
   */
  suspend fun waitForCardPresence(deviceHandle: String, timeout: Double?) {
    ensureInitialized()
    val timeoutMs = timeout ?: DEFAULT_TIMEOUT_MS
    
    // Validate timeout parameter
    if (timeoutMs < 0) {
      throw IllegalStateException("INVALID_PARAMETER: Timeout cannot be negative: $timeoutMs")
    }
    if (timeoutMs == 0.0) {
      throw IllegalStateException("TIMEOUT: Immediate timeout requested")
    }
    
    try {
      DeviceLifecycleManager.waitForCardPresence(deviceHandle, timeoutMs)
    } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
      // Emit WAIT_TIMEOUT for deviceHandle
      StatusEventDispatcher.emit(
        StatusEventType.WAIT_TIMEOUT,
        EventPayload(
          deviceHandle = deviceHandle,
          cardHandle = null,
          details = "timeout=${timeoutMs.toLong()}ms"
        )
      )
      throw IllegalStateException("TIMEOUT: ${e.message}")
    } catch (e: IllegalStateException) {
      throw e // Re-throw our mapped errors
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Wait failed: ${e.message}")
    }
  }

  /**
   * Start card session.
   */
  suspend fun startSession(deviceHandle: String): String {
    ensureInitialized()
    return SmartCardDeviceImpl.startSession(deviceHandle)
  }

  /**
   * Release device and deactivate RF field.
   */
  suspend fun releaseDevice(deviceHandle: String) {
    ensureInitialized()
    
    try {
      // Get current Activity for ReaderMode disable
      val activity = appContext!!.getCurrentActivity()
      if (activity != null) {
        NfcReaderController.disable(activity!!, deviceHandle)
      }
      
      // Release device resources
      SmartCardDeviceImpl.release(deviceHandle)

      // Emit device released event
      StatusEventDispatcher.emit(
        StatusEventType.DEVICE_RELEASED,
        EventPayload(deviceHandle = deviceHandle, cardHandle = null, details = "ReaderMode disabled")
      )
      
    } catch (e: IllegalStateException) {
      throw e
    } catch (e: Exception) {
      throw IllegalStateException("PLATFORM_ERROR: Failed to release device: ${e.message}")
    }
  }

  /**
   * Get ATR/ATS from card.
   */
  suspend fun getAtr(cardHandle: String): ArrayBuffer {
    ensureInitialized()
    return SmartCardDeviceImpl.getAtr(cardHandle)
  }

  /**
   * Transmit APDU to card.
   */
  suspend fun transmit(cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
    ensureInitialized()
    return SmartCardDeviceImpl.transmit(cardHandle, apdu)
  }

  /**
   * Reset card session.
   */
  suspend fun reset(cardHandle: String) {
    ensureInitialized()
    SmartCardDeviceImpl.reset(cardHandle)
  }

  /**
   * Release card session.
   */
  suspend fun releaseCard(cardHandle: String) {
    ensureInitialized()
    SmartCardDeviceImpl.releaseCard(cardHandle)
  }

  /**
   * Emergency cleanup for screen-off/doze events.
   * Called from BroadcastReceiver - uses runBlocking.
   */
  fun emergencyCleanup() {
    if (!initialized) return
    
    runBlocking {
      try {
        NfcReaderController.disableAll()
        SmartCardDeviceImpl.cancelAllWaitsAndRelease()
      } catch (_: Exception) {
        // Suppress errors during emergency cleanup
      }
    }
  }

  private fun ensureInitialized() {
    if (!initialized) {
      throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
    }
  }

}
package app.aoki.jsapdu.rn

import android.nfc.NfcAdapter
import android.app.Activity
import android.se.omapi.SEService
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import app.aoki.jsapdu.rn.core.IDevice
import app.aoki.jsapdu.rn.nfc.NfcPlatformHelper
import app.aoki.jsapdu.rn.omapi.OmapiPlatformHelper
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.runBlocking
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Platform manager for smart card devices.
 * Manages different device types (NFC, OMAPI, BLE, etc.) through IDevice interface.
 * Delegates device-specific logic to namespace helpers for better maintainability.
 */
class SmartCardPlatform {
    private val appContext: ReactApplicationContext
    
    // NFC subsystem
    @Volatile private var nfcAdapter: NfcAdapter? = null
    
    // OMAPI subsystem
    @Volatile private var seService: SEService? = null
    @Volatile private var seServiceConnected: Boolean = false
    
    // Device registry
    private val devices = ConcurrentHashMap<String, IDevice>()
    
    // Lifecycle state
    @Volatile private var initialized: Boolean = false
    private val platformMutex = Mutex()
    private val acquireLock = Any()

    init {
        val ctx = NitroModules.applicationContext
        requireNotNull(ctx) { "SmartCardPlatform: NitroModules.applicationContext must not be null at pre-initialization" }
        appContext = ctx
    }

    fun initialize(force: Boolean = false) = runBlocking {
        platformMutex.withLock {
            if (!force && initialized) {
                throw IllegalStateException("ALREADY_INITIALIZED: Platform already initialized")
            }
            
            initializeNfc(force)
            initializeOmapi(force)
            
            initialized = true
            emitPlatformInitialized()
        }
    }

    fun release(force: Boolean = false) = runBlocking {
        platformMutex.withLock {
            if (!force && !initialized) {
                throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
            }
            initialized = false
            
            releaseNfc(force)
            releaseOmapi(force)
        }
        
        // Release all devices outside lock to avoid nested locking
        val toRelease = devices.values.toList()
        devices.clear()
        toRelease.forEach {
            try { it.release() } catch (_: Exception) { /* best-effort */ }
        }
        
        emitPlatformReleased()
    }
    
    fun isInitialized(): Boolean = initialized

    fun currentActivity(): Activity? = appContext.currentActivity

    /**
     * Returns available device info for all supported device types.
     */
    fun getDeviceInfo(): Array<DeviceInfo> {
        if (!initialized) {
            throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        }
        
        val deviceList = mutableListOf<DeviceInfo>()
        
        // Collect devices from all subsystems
        deviceList.addAll(NfcPlatformHelper.getDeviceInfo(nfcAdapter))
        deviceList.addAll(OmapiPlatformHelper.getDeviceInfo(seService, seServiceConnected))
        
        return deviceList.toTypedArray()
    }

    /**
     * Acquire device based on device ID. Returns a device handle string.
     */
    fun acquireDevice(deviceId: String): String {
        if (!initialized) {
            throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        }
        
        synchronized(acquireLock) {
            // Enforce single-acquire per device ID
            if (devices.values.any { it.id == deviceId }) {
                throw IllegalStateException("ALREADY_ACQUIRED: Device '$deviceId' already acquired")
            }
            
            val device = createDevice(deviceId)
            device.acquire()
            
            val handle = device.handle
            devices[handle] = device
            
            emitDeviceAcquired(handle, deviceId)
            return handle
        }
    }
    
    fun getTarget(deviceHandle: String): IDevice? = devices[deviceHandle]

    internal fun unregisterDevice(handle: String) {
        devices.remove(handle)
    }

    // ---- Private subsystem initialization ------------------------------------------------

    private fun initializeNfc(force: Boolean) {
        nfcAdapter = NfcAdapter.getDefaultAdapter(appContext)
        // NFC is optional, platform can initialize without it
        
    }

    private fun initializeOmapi(force: Boolean) {
        val serviceLatch = CountDownLatch(1)
        // SEService constructor requires an Executor and OnConnectedListener on newer platforms.
        val seExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
        val service = SEService(appContext, seExecutor, SEService.OnConnectedListener {
            seServiceConnected = true
            serviceLatch.countDown()
        })
        seService = service
        
        // Wait for SEService connection (max 3 seconds, non-blocking)
        try {
            serviceLatch.await(3, TimeUnit.SECONDS)
        } catch (_: InterruptedException) {
            seServiceConnected = false
        }
    }

    private fun releaseNfc(force: Boolean) {
        nfcAdapter = null
    }

    private fun releaseOmapi(force: Boolean) {
        try {
            seService?.shutdown()
        } catch (_: Exception) { /* ignore */ }
        seService = null
        seServiceConnected = false
    }

    // ---- Private device creation --------------------------------------------------------

    private fun createDevice(deviceId: String): IDevice {
        return when {
            deviceId.startsWith("integrated-nfc-") -> {
                NfcPlatformHelper.createDevice(this, nfcAdapter, deviceId)
            }
            deviceId.startsWith("omapi-") -> {
                OmapiPlatformHelper.createDevice(
                    this, appContext, seService, seServiceConnected, deviceId
                )
            }
            // TODO: Add BLE device creation
            else -> {
                throw IllegalArgumentException("INVALID_DEVICE_ID: Unknown device type for ID '$deviceId'")
            }
        }
    }

    // ---- Private event emission ---------------------------------------------------------

    private fun emitPlatformInitialized() {
        try {
            val nfcState = NfcPlatformHelper.getStateString(nfcAdapter)
            val omapiState = OmapiPlatformHelper.getStateString(seServiceConnected)
            
            StatusEventDispatcher.emit(
                StatusEventType.PLATFORM_INITIALIZED,
                EventPayload(
                    deviceHandle = null,
                    cardHandle = null,
                    details = "NFC=$nfcState, OMAPI=$omapiState"
                )
            )
        } catch (_: Exception) { /* suppress */ }
    }

    private fun emitPlatformReleased() {
        try {
            StatusEventDispatcher.emit(
                StatusEventType.PLATFORM_RELEASED,
                EventPayload(
                    deviceHandle = null,
                    cardHandle = null,
                    details = "platform released"
                )
            )
        } catch (_: Exception) { /* suppress */ }
    }

    private fun emitDeviceAcquired(handle: String, deviceId: String) {
        try {
            StatusEventDispatcher.emit(
                StatusEventType.DEVICE_ACQUIRED,
                EventPayload(
                    deviceHandle = handle,
                    cardHandle = null,
                    details = "Device '$deviceId' acquired"
                )
            )
        } catch (_: Exception) { /* suppress */ }
    }
}

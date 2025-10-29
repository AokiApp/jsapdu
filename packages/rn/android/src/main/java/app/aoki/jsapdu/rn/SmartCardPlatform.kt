package app.aoki.jsapdu.rn

import android.nfc.NfcAdapter
import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import app.aoki.jsapdu.rn.device.SmartCardDevice
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.D2CProtocol
import com.margelo.nitro.aokiapp.jsapdurn.P2DProtocol
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.runBlocking
import java.util.concurrent.ConcurrentHashMap

class SmartCardPlatform {
    private val appContext: ReactApplicationContext
    @Volatile private var nfcAdapter: NfcAdapter? = null
    private val devices = ConcurrentHashMap<String, SmartCardDevice>()
    @Volatile private var initialized: Boolean = false
    private val platformMutex = Mutex()
    private val acquireLock = Any()
    // devicesLock removed; using ConcurrentHashMap

    init {
        val ctx = NitroModules.applicationContext
        requireNotNull(ctx) { "SmartCardPlatform: NitroModules.applicationContext must not be null at pre-initialization" }
        appContext = ctx
    }

    fun initialize() = runBlocking {
        platformMutex.withLock {
            if (initialized) {
                throw IllegalStateException("ALREADY_INITIALIZED: Platform already initialized")
            }
            nfcAdapter = NfcAdapter.getDefaultAdapter(appContext)
                ?: throw IllegalStateException("PLATFORM_ERROR: NFC hardware not available on this device")
            initialized = true
            // Emit platform init and initial NFC state
            try {
                val nfcState = if (nfcAdapter?.isEnabled == true) "on" else "off"
                StatusEventDispatcher.emit(
                    StatusEventType.PLATFORM_INITIALIZED,
                    EventPayload(deviceHandle = null, cardHandle = null, details = "NFC=$nfcState")
                )
                StatusEventDispatcher.emit(
                    StatusEventType.NFC_STATE_CHANGED,
                    EventPayload(deviceHandle = null, cardHandle = null, details = nfcState)
                )
            } catch (_: Exception) { /* suppress */ }
        }
    }

    fun release() = runBlocking {
        // Mark platform released under lifecycle lock
        platformMutex.withLock {
            if (!initialized) {
                throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
            }
            initialized = false
            nfcAdapter = null
        }
        // Snapshot and clear devices outside lifecycle lock to avoid nested locking
        val toRelease: List<SmartCardDevice> = devices.values.toList()
        devices.clear()
        toRelease.forEach {
            try { it.release() } catch (_: Exception) { /* best-effort */ }
        }
        // Emit platform released
        try {
            StatusEventDispatcher.emit(
                StatusEventType.PLATFORM_RELEASED,
                EventPayload(deviceHandle = null, cardHandle = null, details = "platform released")
            )
        } catch (_: Exception) { /* suppress */ }
    }
    
    fun isInitialized(): Boolean = initialized

    fun currentActivity(): Activity? = appContext.currentActivity

    /**
     * Returns single integrated NFC device info or empty array if NFC unavailable.
     */
    fun getDeviceInfo(): Array<DeviceInfo> {
        if (!initialized) throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        val adapter = nfcAdapter
        return if (adapter == null || !adapter.isEnabled) {
            emptyArray()
        } else {
            arrayOf(
                DeviceInfo(
                    id = "integrated-nfc-0",
                    devicePath = null,
                    friendlyName = "Integrated NFC Reader",
                    description = "Android NFC with ISO-DEP support",
                    supportsApdu = true,
                    supportsHce = false,
                    isIntegratedDevice = true,
                    isRemovableDevice = false,
                    d2cProtocol = D2CProtocol.NFC,
                    p2dProtocol = P2DProtocol.NFC,
                    apduApi = arrayOf("nfc", "androidnfc")
                )
            )
        }
    }

    /**
     * Acquire device and activate RF field. Returns a device handle string.
     */
    fun acquireDevice(deviceId: String): String {
        if (!initialized) throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        val adapter = nfcAdapter ?: throw IllegalStateException("PLATFORM_ERROR: NFC not supported")
        if (!adapter.isEnabled) throw IllegalStateException("PLATFORM_ERROR: NFC is disabled in system settings")

        if (deviceId != "integrated-nfc-0") {
            throw IllegalArgumentException("INVALID_DEVICE_ID: No such device with ID '$deviceId'")
        }

        synchronized(acquireLock) {
            // Enforce single-acquire for the integrated reader
            if (devices.values.any { it.id == deviceId }) {
                throw IllegalStateException("ALREADY_ACQUIRED: Device '$deviceId' already acquired")
            }

            val device = SmartCardDevice(this, adapter, id = deviceId)
            device.acquire()

            val handle = device.handle
            devices[handle] = device
            try {
                StatusEventDispatcher.emit(
                    StatusEventType.DEVICE_ACQUIRED,
                    EventPayload(deviceHandle = handle, cardHandle = null, details = "ReaderMode enabled")
                )
            } catch (_: Exception) { /* suppress */ }
            return handle
        }
    }
    
    fun getTarget(deviceHandle: String): SmartCardDevice? = devices[deviceHandle]

    internal fun unregisterDevice(handle: String) {
        devices.remove(handle)
    }
}
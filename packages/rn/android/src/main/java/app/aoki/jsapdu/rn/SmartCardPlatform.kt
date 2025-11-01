package app.aoki.jsapdu.rn

import android.nfc.NfcAdapter
import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import app.aoki.jsapdu.rn.core.IDevice
import app.aoki.jsapdu.rn.nfc.NfcDevice
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

/**
 * Platform manager for smart card devices.
 * Manages different device types (NFC, OMAPI, BLE, etc.) through IDevice interface.
 * Currently supports NFC devices with planned support for additional types.
 */
class SmartCardPlatform {
    private val appContext: ReactApplicationContext
    @Volatile private var nfcAdapter: NfcAdapter? = null
    private val devices = ConcurrentHashMap<String, IDevice>()
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
            // Initialize NFC adapter - in future, initialize other device types here
            nfcAdapter = NfcAdapter.getDefaultAdapter(appContext)
            // Note: NFC is optional, platform can initialize without it
            initialized = true
            // Emit platform init and initial NFC state
            try {
                val nfcState = when {
                    nfcAdapter == null -> "unavailable"
                    nfcAdapter?.isEnabled == true -> "on"
                    else -> "off"
                }
                StatusEventDispatcher.emit(
                    StatusEventType.PLATFORM_INITIALIZED,
                    EventPayload(deviceHandle = null, cardHandle = null, details = "NFC=$nfcState")
                )
                if (nfcAdapter != null) {
                    StatusEventDispatcher.emit(
                        StatusEventType.NFC_STATE_CHANGED,
                        EventPayload(deviceHandle = null, cardHandle = null, details = nfcState)
                    )
                }
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
        val toRelease: List<IDevice> = devices.values.toList()
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
     * Returns available device info for all supported device types.
     * Currently returns NFC devices, will be extended for OMAPI/BLE.
     */
    fun getDeviceInfo(): Array<DeviceInfo> {
        if (!initialized) throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        val deviceList = mutableListOf<DeviceInfo>()
        
        // Add NFC device if available
        val adapter = nfcAdapter
        if (adapter != null && adapter.isEnabled) {
            deviceList.add(
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
        
        // TODO: Add OMAPI devices
        // TODO: Add BLE devices
        
        return deviceList.toTypedArray()
    }

    /**
     * Acquire device based on device ID. Returns a device handle string.
     * Supports different device types based on the device ID pattern.
     */
    fun acquireDevice(deviceId: String): String {
        if (!initialized) throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        
        synchronized(acquireLock) {
            // Enforce single-acquire per device ID
            if (devices.values.any { it.id == deviceId }) {
                throw IllegalStateException("ALREADY_ACQUIRED: Device '$deviceId' already acquired")
            }
            
            val device: IDevice = when {
                deviceId.startsWith("integrated-nfc-") -> {
                    // NFC device
                    val adapter = nfcAdapter ?: throw IllegalStateException("PLATFORM_ERROR: NFC not supported")
                    if (!adapter.isEnabled) throw IllegalStateException("PLATFORM_ERROR: NFC is disabled in system settings")
                    
                    if (deviceId != "integrated-nfc-0") {
                        throw IllegalArgumentException("INVALID_DEVICE_ID: No such NFC device with ID '$deviceId'")
                    }
                    
                    NfcDevice(this, adapter, id = deviceId)
                }
                // TODO: Add OMAPI device creation
                // deviceId.startsWith("omapi-") -> { ... }
                // TODO: Add BLE device creation
                // deviceId.startsWith("ble-") -> { ... }
                else -> {
                    throw IllegalArgumentException("INVALID_DEVICE_ID: Unknown device type for ID '$deviceId'")
                }
            }
            
            device.acquire()
            val handle = device.handle
            devices[handle] = device
            
            try {
                StatusEventDispatcher.emit(
                    StatusEventType.DEVICE_ACQUIRED,
                    EventPayload(deviceHandle = handle, cardHandle = null, details = "Device '$deviceId' acquired")
                )
            } catch (_: Exception) { /* suppress */ }
            return handle
        }
    }
    
    fun getTarget(deviceHandle: String): IDevice? = devices[deviceHandle]

    internal fun unregisterDevice(handle: String) {
        devices.remove(handle)
    }
}
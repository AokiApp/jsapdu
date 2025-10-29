package app.aoki.jsapdu.rn

import android.nfc.NfcAdapter
import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import app.aoki.jsapdu.rn.device.SmartCardDevice
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.D2CProtocol
import com.margelo.nitro.aokiapp.jsapdurn.P2DProtocol
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.runBlocking

class SmartCardPlatform {
    private val appContext: ReactApplicationContext
    private var nfcAdapter: NfcAdapter? = null
    private val devices = mutableMapOf<String, SmartCardDevice>()
    private var initialized: Boolean = false
    private val platformMutex = Mutex()

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
        }
    }

    fun release() = runBlocking {
        platformMutex.withLock {
            if (!initialized) {
                throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
            }
            try {
                devices.values.forEach { it.release() }
                devices.clear()
            } catch (_: Exception) {
                // Best-effort disable; ignore errors during shutdown
            }
            nfcAdapter = null
            initialized = false
        }
    }
    
    fun isInitialized(): Boolean = initialized

    fun currentActivity(): Activity? = appContext.currentActivity

    /**
     * Returns single integrated NFC device info or empty array if NFC unavailable.
     * Mirrors the logic in old SmartCardPlatformImpl.
     */
    fun getDeviceInfo(): Array<DeviceInfo> {
        if (!initialized) throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        val adapter = nfcAdapter
        if (adapter == null || !adapter.isEnabled) {
            return emptyArray()
        }
        return arrayOf(
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

    /**
    * Acquire device and activate RF field.
    * Returns a device handle string.
    * Enables NFC ReaderMode if possible.
    */
    fun acquireDevice(deviceId: String): String {
        if (!initialized) throw IllegalStateException("NOT_INITIALIZED: Platform not initialized")
        val adapter = nfcAdapter ?: throw IllegalStateException("PLATFORM_ERROR: NFC not supported")
        if (!adapter.isEnabled) throw IllegalStateException("PLATFORM_ERROR: NFC is disabled in system settings")

        if (deviceId != "integrated-nfc-0") {
            throw IllegalArgumentException("INVALID_DEVICE_ID: No such device with ID '$deviceId'")
        }

        val device = SmartCardDevice(this, adapter, id = deviceId)
        device.acquire()

        val handle = device.handle
        devices[handle] = device
        return handle
    }
    
    fun getTarget(deviceHandle: String): SmartCardDevice? {
        return devices[deviceHandle]
    }

    internal fun unregisterDevice(handle: String) {
        devices.remove(handle)
    }
    
}
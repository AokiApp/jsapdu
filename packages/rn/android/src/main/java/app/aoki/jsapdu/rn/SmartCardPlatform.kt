package app.aoki.jsapdu.rn

import android.nfc.NfcAdapter
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.runBlocking

class SmartCardPlatform {
    private val appContext: ReactApplicationContext
    private var nfcAdapter: NfcAdapter? = null
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
            nfcAdapter = null
            initialized = false
        }
    }

    fun isInitialized(): Boolean = initialized

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
}
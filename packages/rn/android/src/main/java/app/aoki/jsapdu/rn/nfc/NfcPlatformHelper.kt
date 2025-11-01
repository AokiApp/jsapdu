package app.aoki.jsapdu.rn.nfc

import android.nfc.NfcAdapter
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.D2CProtocol
import com.margelo.nitro.aokiapp.jsapdurn.P2DProtocol
import app.aoki.jsapdu.rn.SmartCardPlatform
import app.aoki.jsapdu.rn.core.IDevice

/**
 * NFC-specific platform helper for device enumeration and creation.
 * Isolates NFC logic from the main SmartCardPlatform.
 */
object NfcPlatformHelper {
    
    /**
     * Get device info for available NFC devices.
     */
    fun getDeviceInfo(adapter: NfcAdapter?): List<DeviceInfo> {
        if (adapter == null || !adapter.isEnabled) {
            return emptyList()
        }
        
        return listOf(
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
     * Create an NFC device instance.
     * @throws IllegalStateException if NFC is not available or device ID is invalid
     */
    fun createDevice(
        platform: SmartCardPlatform,
        adapter: NfcAdapter?,
        deviceId: String
    ): IDevice {
        val nfcAdapter = adapter 
            ?: throw IllegalStateException("PLATFORM_ERROR: NFC not supported")
        
        if (!nfcAdapter.isEnabled) {
            throw IllegalStateException("PLATFORM_ERROR: NFC is disabled in system settings")
        }
        
        if (deviceId != "integrated-nfc-0") {
            throw IllegalArgumentException("INVALID_DEVICE_ID: No such NFC device with ID '$deviceId'")
        }
        
        return NfcDevice(platform, nfcAdapter, id = deviceId)
    }
    
    /**
     * Get NFC state as string.
     */
    fun getStateString(adapter: NfcAdapter?): String {
        return when {
            adapter == null -> "unavailable"
            adapter.isEnabled -> "on"
            else -> "off"
        }
    }
}
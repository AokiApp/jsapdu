package expo.modules.jsapdu

import android.nfc.NfcAdapter
import android.os.Build

/**
 * Android implementation of SmartCardDeviceInfo
 * Provides information about the Android NFC device
 */
class AndroidDeviceInfoImpl(
  private val platform: AndroidPlatformImpl,
  private val nfcAdapter: NfcAdapter
) : Registrable() {
  
  /**
   * Identifier of the device
   * Unique within the platform
   * Used to identify the device when connecting
   */
  val id: String = "android-nfc-${Build.MANUFACTURER}-${Build.MODEL}"
  
  /**
   * Hardware path of the device if available
   * use for reference, not for display or identification
   */
  val devicePath: String? = null
  
  /**
   * Friendly name of the device
   * Used for display purposes
   */
  val friendlyName: String = "Android NFC (${Build.MODEL})"
  
  /**
   * Device description
   * Used for display purposes
   */
  val description: String = "Android NFC Reader on ${Build.MANUFACTURER} ${Build.MODEL}"
  
  /**
   * Supports APDU R/W operations
   */
  val supportsApdu: Boolean = true
  
  /**
   * Supports Host Card Emulation
   */
  val supportsHce: Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
  
  /**
   * The device is an integrated reader (phone inside)
   */
  val isIntegratedDevice: Boolean = true
  
  /**
   * The device is a removable reader (usb, bluetooth, etc)
   */
  val isRemovableDevice: Boolean = false
  
  /**
   * D2C (Device to Card) communication
   */
  val d2cProtocol: String = "nfc"
  
  /**
   * P2D (Platform to Device) communication
   */
  val p2dProtocol: String = "nfc"
  
  /**
   * API type of APDU communication
   * provided by the specific platform implementation
   * Supports nested protocol (e.g. BLE over WebUSB)
   */
  val apduApi: List<String> = listOf("androidnfc")
  
  /**
   * Acquire the device
   * @throws SmartCardError If device acquisition fails
   */
  fun acquireDevice(): AndroidDeviceImpl {
    try {
      return AndroidDeviceImpl(platform, this, nfcAdapter)
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.READER_ERROR)
    }
  }
}
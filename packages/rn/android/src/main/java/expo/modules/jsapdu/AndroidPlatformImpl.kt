package expo.modules.jsapdu

import android.content.Context
import android.nfc.NfcAdapter
import android.nfc.NfcManager
import expo.modules.kotlin.AppContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Android implementation of SmartCardPlatform
 * Provides access to the Android NFC functionality
 */
class AndroidPlatformImpl(
  private val context: Context,
  private val appContext: AppContext
) : Registrable() {
  
  // Indicates if the platform is initialized
  private var initialized: Boolean = false
  
  // NFC adapter
  private var nfcAdapter: NfcAdapter? = null
  
  // NFC manager
  private var nfcManager: NfcManager? = null
  
  /**
   * Initialize the platform
   * @throws SmartCardError If initialization fails or platform is already initialized
   */
  suspend fun init(): Boolean = withContext(Dispatchers.IO) {
    try {
      assertNotInitialized()
      
      // Get NFC manager
      nfcManager = context.getSystemService(Context.NFC_SERVICE) as? NfcManager
        ?: throw SmartCardError(
          SmartCardErrorCode.PLATFORM_ERROR,
          "NFC service not available"
        )
      
      // Get NFC adapter
      nfcAdapter = nfcManager?.defaultAdapter
        ?: throw SmartCardError(
          SmartCardErrorCode.PLATFORM_ERROR,
          "NFC adapter not available"
        )
      
      // Check if NFC is enabled
      if (!nfcAdapter!!.isEnabled) {
        throw SmartCardError(
          SmartCardErrorCode.PLATFORM_ERROR,
          "NFC is not enabled"
        )
      }
      
      initialized = true
      true
    } catch (e: Exception) {
      throw fromUnknownError(e)
    }
  }
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun init() {
    try {
      assertNotInitialized()
      
      // Get NFC manager
      nfcManager = context.getSystemService(Context.NFC_SERVICE) as? NfcManager
        ?: throw SmartCardError(
          SmartCardErrorCode.PLATFORM_ERROR,
          "NFC service not available"
        )
      
      // Get NFC adapter
      nfcAdapter = nfcManager?.defaultAdapter
        ?: throw SmartCardError(
          SmartCardErrorCode.PLATFORM_ERROR,
          "NFC adapter not available"
        )
      
      // Check if NFC is enabled
      if (!nfcAdapter!!.isEnabled) {
        throw SmartCardError(
          SmartCardErrorCode.PLATFORM_ERROR,
          "NFC is not enabled"
        )
      }
      
      initialized = true
    } catch (e: Exception) {
      throw fromUnknownError(e)
    }
  }
  
  /**
   * Release the platform
   * @throws SmartCardError If release fails or platform is not initialized
   */
  suspend fun release(): Boolean = withContext(Dispatchers.IO) {
    try {
      assertInitialized()
      
      // Clean up resources
      nfcAdapter = null
      nfcManager = null
      
      initialized = false
      true
    } catch (e: Exception) {
      throw fromUnknownError(e)
    }
  }
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun release() {
    try {
      assertInitialized()
      
      // Clean up resources
      nfcAdapter = null
      nfcManager = null
      
      initialized = false
    } catch (e: Exception) {
      throw fromUnknownError(e)
    }
  }
  
  /**
   * Get whether the platform is initialized or not
   */
  fun isInitialized(): Boolean {
    return initialized
  }
  
  /**
   * Asserts if the platform is initialized
   * @throws SmartCardError If the platform is not initialized
   */
  private fun assertInitialized() {
    if (!initialized) {
      throw SmartCardError(
        SmartCardErrorCode.NOT_INITIALIZED,
        "Platform not initialized"
      )
    }
  }
  
  /**
   * Asserts if the platform is not initialized
   * @throws SmartCardError If the platform is initialized
   */
  private fun assertNotInitialized() {
    if (initialized) {
      throw SmartCardError(
        SmartCardErrorCode.ALREADY_INITIALIZED,
        "Platform already initialized"
      )
    }
  }
  
  /**
   * Get devices
   * @throws SmartCardError If platform is not initialized or operation fails
   */
  suspend fun getDevices(): List<AndroidDeviceInfoImpl> = withContext(Dispatchers.IO) {
    try {
      assertInitialized()
      
      // For Android NFC, there's typically only one device (the phone's NFC hardware)
      val deviceInfo = AndroidDeviceInfoImpl(this@AndroidPlatformImpl, nfcAdapter!!)
      listOf(deviceInfo)
    } catch (e: Exception) {
      throw fromUnknownError(e)
    }
  }
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun getDevices(): List<AndroidDeviceInfoImpl> {
    try {
      assertInitialized()
      
      // For Android NFC, there's typically only one device (the phone's NFC hardware)
      val deviceInfo = AndroidDeviceInfoImpl(this, nfcAdapter!!)
      return listOf(deviceInfo)
    } catch (e: Exception) {
      throw fromUnknownError(e)
    }
  }
  
  /**
   * Get the NFC adapter
   * @return NFC adapter
   * @throws SmartCardError If platform is not initialized
   */
  fun getNfcAdapter(): NfcAdapter {
    assertInitialized()
    return nfcAdapter ?: throw SmartCardError(
      SmartCardErrorCode.PLATFORM_ERROR,
      "NFC adapter not available"
    )
  }

  /**
   * Get the app context
   * @return App context
   */
  fun getAppContext(): AppContext {
    return appContext
  }
}
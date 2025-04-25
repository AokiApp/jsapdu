package expo.modules.jsapdu

import android.content.Context
import expo.modules.kotlin.AppContext

/**
 * Android implementation of SmartCardPlatformManager
 * Provides access to the Android NFC platform
 */
class AndroidPlatformManagerImpl(
  private val context: Context,
  private val appContext: AppContext
) : Registrable() {
  
  // The platform instance
  private var platform: AndroidPlatformImpl? = null
  
  /**
   * Get the Android NFC platform
   * @return Android NFC platform
   */
  fun getPlatform(): AndroidPlatformImpl {
    if (platform == null) {
      platform = AndroidPlatformImpl(context, appContext)
    }
    return platform!!
  }
  
  /**
   * Initialize the platform
   * This is called from JavaScript
   */
  fun init() {
    getPlatform().init()
  }
  
  /**
   * Release the platform
   * This is called from JavaScript
   */
  fun release() {
    platform?.release()
    platform = null
  }
}
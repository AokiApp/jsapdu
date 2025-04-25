package expo.modules.jsapdu

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Android implementation of SmartCardDevice
 * Handles the Android NFC device operations
 */
class AndroidDeviceImpl(
  private val platform: AndroidPlatformImpl,
  private val deviceInfo: AndroidDeviceInfoImpl,
  private val nfcAdapter: NfcAdapter
) : Registrable() {
  
  // Flag to track if the device is active
  private val active = AtomicBoolean(true)
  
  // The current tag
  private var currentTag: Tag? = null
  
  // Deferred that will be completed when a tag is discovered
  private var tagDeferred: CompletableDeferred<Tag>? = null
  
  // NFC adapter reader mode callback
  private val readerCallback = object : NfcAdapter.ReaderCallback {
    override fun onTagDiscovered(tag: Tag) {
      currentTag = tag
      tagDeferred?.complete(tag)
    }
  }
  
  init {
    // Register for tag discovery
    val activity = platform.getAppContext().activityProvider?.currentActivity
      ?: throw SmartCardError(
        SmartCardErrorCode.PLATFORM_ERROR,
        "Activity not available"
      )
    
    // Enable reader mode
    nfcAdapter.enableReaderMode(
      activity,
      readerCallback,
      NfcAdapter.FLAG_READER_NFC_A or
        NfcAdapter.FLAG_READER_NFC_B or
        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
      null
    )
  }
  
  /**
   * Get the device information of itself
   */
  fun getDeviceInfo(): AndroidDeviceInfoImpl {
    return deviceInfo
  }
  
  /**
   * Whether acquired device session is active or not
   */
  fun isActive(): Boolean {
    return active.get()
  }
  
  /**
   * Check if the card is present
   * @throws {SmartCardError} If check fails
   */
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun isCardPresent(): Boolean {
    if (!active.get()) {
      throw SmartCardError(
        SmartCardErrorCode.NOT_CONNECTED,
        "Device not active"
      )
    }
    
    return currentTag != null
  }
  
  /**
   * Start communication session with the card
   * @throws {SmartCardError} If session start fails
   */
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun startSession(): AndroidSmartCardImpl {
    if (!active.get()) {
      throw SmartCardError(
        SmartCardErrorCode.NOT_CONNECTED,
        "Device not active"
      )
    }
    
    // Check if we have a tag
    if (currentTag == null) {
      throw SmartCardError(
        SmartCardErrorCode.CARD_NOT_PRESENT,
        "No card present"
      )
    }
    
    // Get IsoDep instance for the tag
    val isoDep = IsoDep.get(currentTag)
      ?: throw SmartCardError(
        SmartCardErrorCode.CARD_NOT_PRESENT,
        "Card does not support ISO-DEP"
      )
    
    try {
      // Connect to the tag
      isoDep.connect()
      
      // Create a new card instance
      return AndroidSmartCardImpl(this, isoDep)
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.READER_ERROR)
    }
  }
  
  /**
   * Start HCE session
   * @throws {SmartCardError} If session start fails
   */
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun startHceSession(): AndroidEmulatedCardImpl {
    if (!active.get()) {
      throw SmartCardError(
        SmartCardErrorCode.NOT_CONNECTED,
        "Device not active"
      )
    }
    
    if (!deviceInfo.supportsHce) {
      throw SmartCardError(
        SmartCardErrorCode.UNSUPPORTED_OPERATION,
        "HCE not supported on this device"
      )
    }
    
    try {
      // Create a new emulated card instance
      return AndroidEmulatedCardImpl(this)
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.READER_ERROR)
    }
  }
  
  /**
   * Release the device
   * @throws {SmartCardError} If release fails
   */
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun release() {
    if (!active.getAndSet(false)) {
      return
    }
    
    try {
      // Disable reader mode
      val activity = platform.getAppContext().activityProvider?.currentActivity
      if (activity != null) {
        nfcAdapter.disableReaderMode(activity)
      }
      
      // Clean up resources
      currentTag = null
      tagDeferred?.cancel()
      tagDeferred = null
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.READER_ERROR)
    }
  }
}
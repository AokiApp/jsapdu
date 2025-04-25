package expo.modules.jsapdu

import android.nfc.cardemulation.HostApduService
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.Messenger
import android.os.Message
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.RemoteException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Android implementation of EmulatedCard
 * Handles Host Card Emulation (HCE) functionality
 */
class AndroidEmulatedCardImpl(
  private val parentDevice: AndroidDeviceImpl,
  private val module: JSApduModule
) : Registrable() {
  
  // Flag to track if the card is active
  private val active = AtomicBoolean(true)
  
  // Pending APDU response
  private var pendingApduResponse: ByteArray? = null
  private val apduResponseLock = Object()
  
  // Messenger for communicating with the HCE service
  private var serviceMessenger: Messenger? = null
  
  // Flag to track if the service is bound
  private val serviceBound = AtomicBoolean(false)
  
  // Handler for receiving messages from the HCE service
  private val incomingHandler = Handler(Looper.getMainLooper()) { msg ->
    when (msg.what) {
      MESSAGE_APDU_RECEIVED -> {
        val apdu = msg.data.getByteArray(KEY_APDU)
        if (apdu != null) {
          // Send event to JavaScript with proper routing information
          module.sendEvent("onApduCommand", mapOf(
            "receiverId" to receiverId,
            "apduCommand" to apdu.map { it.toInt() and 0xFF }
          ))
          
          // Wait for response with timeout
          synchronized(apduResponseLock) {
            try {
              apduResponseLock.wait(RESPONSE_TIMEOUT_MS.toLong())
            } catch (e: InterruptedException) {
              // Ignore
            }
          }
          
          // Send response or default response
          val response = pendingApduResponse ?: DEFAULT_RESPONSE
          pendingApduResponse = null
          sendResponse(response)
        }
        true
      }
      MESSAGE_STATE_CHANGED -> {
        val state = msg.data.getString(KEY_STATE) ?: "unknown"
        // Send event to JavaScript with proper routing information
        module.sendEvent("onHceStateChange", mapOf(
          "receiverId" to receiverId,
          "state" to state
        ))
        true
      }
      else -> false
    }
  }
  
  // Messenger for receiving messages from the HCE service
  private val messenger = Messenger(incomingHandler)
  
  // Service connection
  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, service: IBinder) {
      serviceMessenger = Messenger(service)
      serviceBound.set(true)
      
      // Register the client
      val msg = Message.obtain(null, MESSAGE_REGISTER_CLIENT)
      msg.replyTo = messenger
      try {
        serviceMessenger?.send(msg)
      } catch (e: RemoteException) {
        e.printStackTrace()
      }
    }
    
    override fun onServiceDisconnected(name: ComponentName) {
      serviceMessenger = null
      serviceBound.set(false)
      stateChangeHandler?.invoke("disconnected")
    }
  }
  
  init {
    // Bind to the HCE service
    val context = parentDevice.platform.getAppContext().reactContext
    val intent = Intent(context, JsApduHostApduService::class.java)
    context?.bindService(intent, serviceConnection, android.content.Context.BIND_AUTO_CREATE)
  }
  
  /**
   * Whether acquired device session is active or not
   */
  fun isActive(): Boolean {
    return active.get() && serviceBound.get()
  }
  
  /**
   * Handle APDU response from JavaScript
   */
  fun handleApduResponse(response: ByteArray) {
    pendingApduResponse = response
    synchronized(apduResponseLock) {
      apduResponseLock.notify()
    }
  }
  
  /**
   * Send response to the HCE service
   * @param response Response to send
   */
  private fun sendResponse(response: ByteArray) {
    if (!serviceBound.get() || serviceMessenger == null) {
      return
    }
    
    val msg = Message.obtain(null, MESSAGE_APDU_RESPONSE)
    val data = Bundle()
    data.putByteArray(KEY_APDU, response)
    msg.data = data
    
    try {
      serviceMessenger?.send(msg)
    } catch (e: RemoteException) {
      e.printStackTrace()
    }
  }
  
  /**
   * Release the session
   * @throws SmartCardError If release fails
   */
  suspend fun release(): Boolean = withContext(Dispatchers.IO) {
    if (!active.getAndSet(false)) {
      return@withContext true
    }
    
    try {
      // Unregister the client
      if (serviceBound.get() && serviceMessenger != null) {
        val msg = Message.obtain(null, MESSAGE_UNREGISTER_CLIENT)
        msg.replyTo = messenger
        try {
          serviceMessenger?.send(msg)
        } catch (e: RemoteException) {
          e.printStackTrace()
        }
      }
      
      // Unbind from the service
      val context = parentDevice.platform.getAppContext().reactContext
      context?.unbindService(serviceConnection)
      
      // Clean up resources
      apduHandler = null
      stateChangeHandler = null
      serviceMessenger = null
      serviceBound.set(false)
      
      true
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.PLATFORM_ERROR)
    }
  }
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  
  companion object {
    // Message types
    const val MESSAGE_REGISTER_CLIENT = 1
    const val MESSAGE_UNREGISTER_CLIENT = 2
    const val MESSAGE_APDU_RECEIVED = 3
    const val MESSAGE_APDU_RESPONSE = 4
    const val MESSAGE_STATE_CHANGED = 5
    
    // Bundle keys
    const val KEY_APDU = "apdu"
    const val KEY_STATE = "state"
    
    // Default response when no handler is available
    private val DEFAULT_RESPONSE = byteArrayOf(0x6F, 0x00) // SW_UNKNOWN
    
    // Timeout for waiting for response from JavaScript
    private const val RESPONSE_TIMEOUT_MS = 2000
  }
}
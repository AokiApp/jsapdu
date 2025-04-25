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
  private val parentDevice: AndroidDeviceImpl
) : Registrable() {
  
  // Flag to track if the card is active
  private val active = AtomicBoolean(true)
  
  // APDU handler
  private var apduHandler: ((ByteArray) -> ByteArray)? = null
  
  // State change handler
  private var stateChangeHandler: ((String) -> Unit)? = null
  
  // Messenger for communicating with the HCE service
  private var serviceMessenger: Messenger? = null
  
  // Flag to track if the service is bound
  private val serviceBound = AtomicBoolean(false)
  
  // Handler for receiving messages from the HCE service
  private val incomingHandler = Handler(Looper.getMainLooper()) { msg ->
    when (msg.what) {
      MESSAGE_APDU_RECEIVED -> {
        val apdu = msg.data.getByteArray(KEY_APDU)
        if (apdu != null && apduHandler != null) {
          val response = apduHandler!!(apdu)
          sendResponse(response)
        }
        true
      }
      MESSAGE_STATE_CHANGED -> {
        val state = msg.data.getString(KEY_STATE) ?: "unknown"
        stateChangeHandler?.invoke(state)
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
   * Set APDU handler
   * @throws SmartCardError If setting handler fails
   */
  suspend fun setApduHandler(handler: (ByteArray) -> ByteArray): Boolean = withContext(Dispatchers.IO) {
    try {
      if (!active.get()) {
        throw SmartCardError(
          SmartCardErrorCode.NOT_CONNECTED,
          "Card not active"
        )
      }
      
      apduHandler = handler
      true
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.PLATFORM_ERROR)
    }
  }
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun setApduHandler(handler: (ByteArray) -> ByteArray) {
    try {
      if (!active.get()) {
        throw SmartCardError(
          SmartCardErrorCode.NOT_CONNECTED,
          "Card not active"
        )
      }
      
      apduHandler = handler
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.PLATFORM_ERROR)
    }
  }
  
  /**
   * Set state change handler
   * @throws SmartCardError If setting handler fails
   */
  suspend fun setStateChangeHandler(handler: (String) -> Unit): Boolean = withContext(Dispatchers.IO) {
    try {
      if (!active.get()) {
        throw SmartCardError(
          SmartCardErrorCode.NOT_CONNECTED,
          "Card not active"
        )
      }
      
      stateChangeHandler = handler
      true
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.PLATFORM_ERROR)
    }
  }
  
  /**
   * Non-suspending version for JavaScript bridge
   */
  fun setStateChangeHandler(handler: (String) -> Unit) {
    try {
      if (!active.get()) {
        throw SmartCardError(
          SmartCardErrorCode.NOT_CONNECTED,
          "Card not active"
        )
      }
      
      stateChangeHandler = handler
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.PLATFORM_ERROR)
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
  fun release() {
    if (!active.getAndSet(false)) {
      return
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
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.PLATFORM_ERROR)
    }
  }
  
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
  }
}
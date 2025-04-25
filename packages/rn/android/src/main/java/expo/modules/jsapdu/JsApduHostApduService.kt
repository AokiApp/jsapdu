package expo.modules.jsapdu

import android.content.Intent
import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.RemoteException
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Host APDU Service for JsApdu
 * This service handles APDU commands from external NFC readers
 * and forwards them to the registered clients
 */
class JsApduHostApduService : HostApduService() {
  
  // List of registered clients
  private val clients = CopyOnWriteArrayList<Messenger>()
  
  // Handler for incoming messages
  private val handler = Handler(Looper.getMainLooper()) { msg ->
    when (msg.what) {
      AndroidEmulatedCardImpl.MESSAGE_REGISTER_CLIENT -> {
        msg.replyTo?.let { clients.add(it) }
        notifyStateChange("connected")
        true
      }
      AndroidEmulatedCardImpl.MESSAGE_UNREGISTER_CLIENT -> {
        msg.replyTo?.let { clients.remove(it) }
        true
      }
      AndroidEmulatedCardImpl.MESSAGE_APDU_RESPONSE -> {
        // Store the response for the next processCommandApdu call
        pendingResponse = msg.data.getByteArray(AndroidEmulatedCardImpl.KEY_APDU)
        synchronized(responseLock) {
          responseLock.notify()
        }
        true
      }
      else -> false
    }
  }
  
  // Messenger for clients to communicate with the service
  private val messenger = Messenger(handler)
  
  // Pending response from the client
  private var pendingResponse: ByteArray? = null
  
  // Lock for waiting for response
  private val responseLock = Object()
  
  // Default response when no client is registered
  private val defaultResponse = byteArrayOf(0x6F, 0x00) // SW_UNKNOWN
  
  override fun onBind(intent: Intent): IBinder {
    return messenger.binder
  }
  
  /**
   * Process APDU command from external NFC reader
   * @param commandApdu APDU command
   * @param extras Additional data
   * @return APDU response
   */
  override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
    // If no clients are registered, return default response
    if (clients.isEmpty()) {
      return defaultResponse
    }
    
    // Reset pending response
    pendingResponse = null
    
    // Send command to all clients
    val msg = Message.obtain(null, AndroidEmulatedCardImpl.MESSAGE_APDU_RECEIVED)
    val data = Bundle()
    data.putByteArray(AndroidEmulatedCardImpl.KEY_APDU, commandApdu)
    msg.data = data
    
    for (client in clients) {
      try {
        client.send(msg)
      } catch (e: RemoteException) {
        clients.remove(client)
      }
    }
    
    // Wait for response with timeout
    synchronized(responseLock) {
      try {
        responseLock.wait(RESPONSE_TIMEOUT_MS.toLong())
      } catch (e: InterruptedException) {
        // Ignore
      }
    }
    
    // Return response or default response
    return pendingResponse ?: defaultResponse
  }
  
  /**
   * Called when the device is deselected
   */
  override fun onDeactivated(reason: Int) {
    val state = when (reason) {
      DEACTIVATION_LINK_LOSS -> "disconnected"
      DEACTIVATION_DESELECTED -> "deselected"
      else -> "unknown"
    }
    
    notifyStateChange(state)
  }
  
  /**
   * Notify all clients of a state change
   * @param state New state
   */
  private fun notifyStateChange(state: String) {
    val msg = Message.obtain(null, AndroidEmulatedCardImpl.MESSAGE_STATE_CHANGED)
    val data = Bundle()
    data.putString(AndroidEmulatedCardImpl.KEY_STATE, state)
    msg.data = data
    
    for (client in clients) {
      try {
        client.send(msg)
      } catch (e: RemoteException) {
        clients.remove(client)
      }
    }
  }
  
  companion object {
    // Timeout for waiting for response
    private const val RESPONSE_TIMEOUT_MS = 2000
  }
}
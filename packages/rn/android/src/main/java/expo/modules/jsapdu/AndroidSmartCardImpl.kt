package expo.modules.jsapdu

import android.nfc.tech.IsoDep
import expo.modules.jsapdu.apdu.CommandApdu
import expo.modules.jsapdu.apdu.ResponseApdu
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Android implementation of SmartCard
 * Handles communication with the smart card
 */
class AndroidSmartCardImpl(
  private val parentDevice: AndroidDeviceImpl,
  private val isoDep: IsoDep
) : Registrable() {
  
  // Flag to track if the card is connected
  private val connected = AtomicBoolean(true)
  
  /**
   * Get ATR (Answer To Reset) or equivalent such as ATS (Answer To Select)
   * @throws SmartCardError If operation fails
   */
  fun getAtr(): ByteArray {
    try {
      if (!connected.get()) {
        throw SmartCardError(
          SmartCardErrorCode.NOT_CONNECTED,
          "Card not connected"
        )
      }
      // For IsoDep, we use the historical bytes as ATR
      // This is not a true ATR, but it's the closest equivalent
      return isoDep.historicalBytes ?: ByteArray(0)
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.READER_ERROR)
    }
  }
  
  
  /**
   * Transmit APDU command to the card
   * @throws SmartCardError If transmission fails
   * @throws ValidationError If command is invalid
   */
  suspend fun transmit(apdu: CommandApdu): ResponseApdu = withContext(Dispatchers.IO) {
    try {
      if (!connected.get()) {
        throw SmartCardError(
          SmartCardErrorCode.NOT_CONNECTED,
          "Card not connected"
        )
      }
      
      // Send command to card
      val response = isoDep.transceive(apdu.toByteArray())
      
      // Parse response
      ResponseApdu(response)
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.TRANSMISSION_ERROR)
    }
  }
  
  
  /**
   * Reset the card
   * @throws SmartCardError If reset fails
   */
  suspend fun reset(): Boolean = withContext(Dispatchers.IO) {
    try {
      if (!connected.get()) {
        throw SmartCardError(
          SmartCardErrorCode.NOT_CONNECTED,
          "Card not connected"
        )
      }
      
      // For IsoDep, we can't truly reset the card
      // The best we can do is disconnect and reconnect
      isoDep.close()
      isoDep.connect()
      
      true
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.READER_ERROR)
    }
  }
  
  
  /**
   * Release the session
   * @throws SmartCardError If release fails
   */
  suspend fun release(): Boolean = withContext(Dispatchers.IO) {
    if (!connected.getAndSet(false)) {
      return@withContext true
    }
    
    try {
      // Close the connection
      isoDep.close()
      
      true
    } catch (e: Exception) {
      throw fromUnknownError(e, SmartCardErrorCode.READER_ERROR)
    }
  }
  
}
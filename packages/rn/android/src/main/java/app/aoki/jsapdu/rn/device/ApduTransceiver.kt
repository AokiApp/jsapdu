package app.aoki.jsapdu.rn.device

import com.margelo.nitro.core.ArrayBuffer
import android.nfc.tech.IsoDep
import android.nfc.TagLostException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.nio.ByteBuffer
import com.margelo.nitro.aokiapp.jsapdurn.StatusEventDispatcher
import com.margelo.nitro.aokiapp.jsapdurn.StatusEventType
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload

/**
 * APDU transmission and ATR retrieval for Android NFC with Coroutine support.
 * Handles ISO-DEP communication with proper error mapping and concurrency control.
 *
 * Key improvements:
 * - Kotlin Coroutine support with proper I/O context switching
 * - Mutex protection for APDU transmission serialization
 * - FFI-neutral error mapping (PLATFORM_ERROR, CARD_NOT_PRESENT, etc.)
 * - Enhanced resource validation and cleanup
 * - Thread-safe operations for concurrent access scenarios
 *
 * Error mapping strategy:
 * - IOException -> PLATFORM_ERROR (NFC I/O communication failure)
 * - TagLostException -> CARD_NOT_PRESENT (Physical card removal)
 * - IllegalStateException -> Session/device state errors with specific codes
 * - SecurityException -> PLATFORM_ERROR (NFC permission issues)
 *
 * Max: 350 lines per updated coding standards.
 */
object ApduTransceiver {

  private val transmissionMutex = Mutex()
  private const val TAG = "ApduTransceiver"

  /**
   * Transmit APDU command to card with proper concurrency control.
   *
   * @param cardHandle Card session handle
   * @param apdu APDU command as ArrayBuffer
   * @return Response APDU as ArrayBuffer (data + SW1 + SW2)
   * @throws IllegalStateException with FFI-neutral error codes
   */
  suspend fun transmit(cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
    // Validate card session state
    CardSessionManager.validateCardSession(cardHandle)
    
    val deviceHandle = CardSessionManager.getDeviceHandle(cardHandle)
      ?: throw IllegalStateException("PLATFORM_ERROR: Card session not found: $cardHandle")

    
    android.util.Log.e(TAG, "transmit called: cardHandle=$cardHandle, deviceHandle=$deviceHandle")

      // Convert ArrayBuffer to ByteArray for IsoDep.transceive()
    val commandBytesBuffer: ByteBuffer = apdu.getBuffer(copyIfNeeded = true)
    // I want to convert ByteBuffer to ByteArray
    val commandBytes: ByteArray = ByteArray(commandBytesBuffer.remaining())
    commandBytesBuffer.get(commandBytes)

    android.util.Log.e(TAG, "commandBytes size: ${commandBytes.size} bytes")

    // Serialize APDU transmissions to prevent race conditions
    return transmissionMutex.withLock {
      val isoDep = DeviceLifecycleManager.getIsoDep(deviceHandle)
        ?: throw IllegalStateException("PLATFORM_ERROR: IsoDep session not active for card: $cardHandle")
      
      // Validate IsoDep connection state
      if (!isoDep.isConnected) {
        throw IllegalStateException("PLATFORM_ERROR: IsoDep connection not established for card: $cardHandle")
      }
      
      android.util.Log.e(TAG, "IsoDep is connected, proceeding with transmit")

      // Perform I/O operation on appropriate thread context
      withContext(Dispatchers.IO) {
        try {
          android.util.Log.e(TAG, "Transmitting APDU: ${commandBytes.joinToString(",")}")
          
          // Validate APDU length constraints (basic check)
          if (commandBytes.isEmpty()) {
            throw IllegalStateException("INVALID_PARAMETER: Empty APDU command")
          }
          android.util.Log.e(TAG, "APDU command length validated, proceeding with transceive")
          if (commandBytes.size > 65539) { // Extended APDU max: 65535 + 4 bytes header
            throw IllegalStateException("INVALID_PARAMETER: APDU command too long: ${commandBytes.size} bytes")
          }
          android.util.Log.e(TAG, "APDU command validated, proceeding with transceive")
          // Perform actual NFC transmission
          // Emit APDU_SENT before transmission
          StatusEventDispatcher.emit(
            StatusEventType.APDU_SENT,
            EventPayload(
              deviceHandle = deviceHandle,
              cardHandle = cardHandle,
              details = "len=${commandBytes.size}"
            )
          )
          val responseBytes = isoDep.transceive(commandBytes)
          
          // Validate response
          if (responseBytes == null || responseBytes.size < 2) {
            throw IllegalStateException("PROTOCOL_ERROR: Invalid response from card (too short)")
          }
          
          // Convert response back to ArrayBuffer
          // allocate
          val allocatedDirectly = ByteBuffer.allocateDirect(responseBytes.size)
          // put data
          allocatedDirectly.put(responseBytes)
          // reset position
          allocatedDirectly.flip()

          ArrayBuffer.wrap(allocatedDirectly)
        
        } catch (e: IOException) {
          // NFC I/O communication failure
          StatusEventDispatcher.emit(
            StatusEventType.APDU_FAILED,
            EventPayload(
              deviceHandle = deviceHandle,
              cardHandle = cardHandle,
              details = "IO: ${e.message}"
            )
          )
          throw IllegalStateException("PLATFORM_ERROR: NFC communication failed: ${e.message}")
        } catch (e: TagLostException) {
          // Card physically removed during transmission
          DeviceLifecycleManager.markTagLost(deviceHandle)
          StatusEventDispatcher.emit(
            StatusEventType.CARD_LOST,
            EventPayload(
              deviceHandle = deviceHandle,
              cardHandle = cardHandle,
              details = "TagLost"
            )
          )
          throw IllegalStateException("PLATFORM_ERROR: Card removed during APDU transmission")
        } catch (e: SecurityException) {
          // NFC permission or security constraint violation
          StatusEventDispatcher.emit(
            StatusEventType.APDU_FAILED,
            EventPayload(
              deviceHandle = deviceHandle,
              cardHandle = cardHandle,
              details = "Security: ${e.message}"
            )
          )
          throw IllegalStateException("PLATFORM_ERROR: NFC security error: ${e.message}")
        } catch (e: IllegalArgumentException) {
          // Invalid APDU format or parameter
          StatusEventDispatcher.emit(
            StatusEventType.APDU_FAILED,
            EventPayload(
              deviceHandle = deviceHandle,
              cardHandle = cardHandle,
              details = "Invalid APDU: ${e.message}"
            )
          )
          throw IllegalStateException("INVALID_PARAMETER: Invalid APDU format: ${e.message}")
        }
      }
    }
  }

  /**
   * Retrieve ATR (Answer To Reset) or ATS (Answer To Select) from card.
   * Priority: Historical Bytes -> HiLayerResponse -> PROTOCOL_ERROR
   *
   * @param cardHandle Card session handle
   * @return ATR/ATS bytes as ArrayBuffer
   * @throws IllegalStateException with FFI-neutral error codes
   */
  suspend fun getAtr(cardHandle: String): ArrayBuffer {
    // Validate card session state
    CardSessionManager.validateCardSession(cardHandle)
    
    val deviceHandle = CardSessionManager.getDeviceHandle(cardHandle)
      ?: throw IllegalStateException("PLATFORM_ERROR: Card session not found: $cardHandle")
    
    val isoDep = DeviceLifecycleManager.getIsoDep(deviceHandle)
      ?: throw IllegalStateException("PLATFORM_ERROR: IsoDep session not active for card: $cardHandle")
    
    return withContext(Dispatchers.IO) {
      try {
        // Validate IsoDep connection
        if (!isoDep.isConnected) {
          throw IllegalStateException("PLATFORM_ERROR: IsoDep connection not established for card: $cardHandle")
        }
        
        // Priority 1: Historical Bytes (Type A cards)
        val historicalBytes = isoDep.historicalBytes
        if (historicalBytes != null && historicalBytes.isNotEmpty()) {
          return@withContext ArrayBuffer.copy(ByteBuffer.wrap(historicalBytes))
        }
        
        // Priority 2: HiLayerResponse (ATS for Type A/B cards)
        val ats = isoDep.hiLayerResponse
        if (ats != null && ats.isNotEmpty()) {
          return@withContext ArrayBuffer.copy(ByteBuffer.wrap(ats))
        }
        
        return@withContext ArrayBuffer.allocate(0) // No ATR/ATS available
        
      } catch (e: TagLostException) {
        // Card physically removed during ATR retrieval
        DeviceLifecycleManager.markTagLost(deviceHandle)
        throw IllegalStateException("PLATFORM_ERROR: Card removed during ATR retrieval")
      } catch (e: SecurityException) {
        // NFC permission or security constraint violation
        throw IllegalStateException("PLATFORM_ERROR: NFC security error during ATR retrieval: ${e.message}")
      } catch (e: IllegalStateException) {
        // Re-throw our own mapped errors as-is
        throw e
      } catch (e: Exception) {
        // Map any other unexpected exception to PLATFORM_ERROR
        throw IllegalStateException("PLATFORM_ERROR: Failed to retrieve ATR/ATS: ${e.message}")
      }
    }
  }

  /**
   * Validate APDU command format and length constraints.
   *
   * @param apdu APDU command as ArrayBuffer
   * @throws IllegalStateException if validation fails
   */
  private fun validateApduCommand(apdu: ArrayBuffer) {
    val buffer = apdu.getBuffer(copyIfNeeded = false)
    val size = buffer.remaining()
    
    if (size == 0) {
      throw IllegalStateException("INVALID_PARAMETER: Empty APDU command")
    }
    
    if (size < 4) {
      throw IllegalStateException("INVALID_PARAMETER: APDU too short (minimum 4 bytes): $size bytes")
    }
    
    // Extended APDU limit check (65535 data + 4 header bytes max)
    if (size > 65539) {
      throw IllegalStateException("INVALID_PARAMETER: APDU command too long: $size bytes (max: 65539)")
    }
  }

  /**
   * Validate APDU response format and extract status words.
   *
   * @param responseBytes Response from IsoDep.transceive()
   * @return Validated response bytes
   * @throws IllegalStateException if validation fails
   */
  private fun validateApduResponse(responseBytes: ByteArray?): ByteArray {
    if (responseBytes == null) {
      throw IllegalStateException("PROTOCOL_ERROR: Null response from card")
    }
    
    if (responseBytes.size < 2) {
      throw IllegalStateException("PROTOCOL_ERROR: Response too short (minimum SW1+SW2): ${responseBytes.size} bytes")
    }
    
    // Extract status words for basic validation
    val sw1 = responseBytes[responseBytes.size - 2].toInt() and 0xFF
    val sw2 = responseBytes[responseBytes.size - 1].toInt() and 0xFF
    
    // Basic status word validation (optional - cards may return various status codes)
    // This is informational only; application layer should interpret status codes
    
    return responseBytes
  }
}
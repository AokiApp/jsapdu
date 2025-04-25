package expo.modules.jsapdu.apdu

import expo.modules.jsapdu.ValidationError

/**
 * Response APDU (Application Protocol Data Unit)
 * Represents a response from a smart card
 */
class ResponseApdu {
  val data: ByteArray  // Response data (may be empty)
  val sw1: Byte        // Status Word 1
  val sw2: Byte        // Status Word 2
  
  /**
   * Create a response APDU from individual components
   * @param data Response data (may be empty)
   * @param sw1 Status Word 1
   * @param sw2 Status Word 2
   */
  constructor(
    data: ByteArray = ByteArray(0),
    sw1: Int,
    sw2: Int
  ) {
    this.data = data
    this.sw1 = sw1.toByte()
    this.sw2 = sw2.toByte()
  }
  
  /**
   * Create a response APDU from a byte array
   * @param bytes APDU as byte array
   */
  constructor(bytes: ByteArray) {
    if (bytes.size < 2) {
      throw ValidationError(
        "Response APDU must be at least 2 bytes long",
        "bytes",
        bytes
      )
    }
    
    // Last two bytes are SW1 and SW2
    this.sw1 = bytes[bytes.size - 2]
    this.sw2 = bytes[bytes.size - 1]
    
    // Data is everything except SW1 and SW2
    this.data = if (bytes.size > 2) {
      bytes.copyOfRange(0, bytes.size - 2)
    } else {
      ByteArray(0)
    }
  }
  
  /**
   * Get the status word as a 16-bit integer
   * @return Status word (SW1 << 8 | SW2)
   */
  fun getStatusWord(): Int {
    return (sw1.toInt() and 0xFF shl 8) or (sw2.toInt() and 0xFF)
  }
  
  /**
   * Check if the status word indicates success (0x9000)
   * @return True if the status word is 0x9000, false otherwise
   */
  fun isSuccess(): Boolean {
    return sw1.toInt() == 0x90 && sw2.toInt() == 0x00
  }
  
  /**
   * Convert the APDU to a byte array
   * @return APDU as byte array
   */
  fun toByteArray(): ByteArray {
    val result = ByteArray(data.size + 2)
    data.copyInto(result)
    result[data.size] = sw1
    result[data.size + 1] = sw2
    return result
  }
  
  /**
   * Get the response data as a ByteArray
   * @return Response data
   */
  fun getData(): ByteArray {
    return data
  }
  
  /**
   * Get the response data as a ByteArray with SW1 and SW2 appended
   * @return Response data with SW1 and SW2
   */
  fun getBytes(): ByteArray {
    return toByteArray()
  }
  
  override fun toString(): String {
    val sb = StringBuilder()
    sb.append("ResponseAPDU: ")
    
    if (data.isNotEmpty()) {
      sb.append("Data=")
      data.forEach { sb.append(String.format("%02X", it)) }
      sb.append(", ")
    }
    
    sb.append(String.format("SW=%02X%02X", sw1, sw2))
    
    return sb.toString()
  }
  
  companion object {
    /**
     * Create a response APDU from a byte array
     * @param bytes APDU as byte array
     * @return Response APDU
     */
    fun fromByteArray(bytes: ByteArray): ResponseApdu {
      return ResponseApdu(bytes)
    }
  }
}
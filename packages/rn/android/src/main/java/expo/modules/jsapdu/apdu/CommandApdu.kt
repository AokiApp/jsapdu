package expo.modules.jsapdu.apdu

import expo.modules.jsapdu.ValidationError

/**
 * Command APDU (Application Protocol Data Unit)
 * Represents a command sent to a smart card
 */
class CommandApdu {
  val cla: Byte  // Class byte
  val ins: Byte  // Instruction byte
  val p1: Byte   // Parameter 1
  val p2: Byte   // Parameter 2
  val data: ByteArray?  // Command data
  val le: Int?   // Expected response length
  
  /**
   * Create a command APDU from individual components
   * @param cla Class byte
   * @param ins Instruction byte
   * @param p1 Parameter 1
   * @param p2 Parameter 2
   * @param data Command data (optional)
   * @param le Expected response length (optional)
   */
  constructor(
    cla: Int,
    ins: Int,
    p1: Int,
    p2: Int,
    data: ByteArray? = null,
    le: Int? = null
  ) {
    this.cla = cla.toByte()
    this.ins = ins.toByte()
    this.p1 = p1.toByte()
    this.p2 = p2.toByte()
    this.data = data
    this.le = le
    
    validate()
  }
  
  /**
   * Create a command APDU from a byte array
   * @param bytes APDU as byte array
   */
  constructor(bytes: ByteArray) {
    if (bytes.size < 4) {
      throw ValidationError(
        "APDU must be at least 4 bytes long",
        "bytes",
        bytes
      )
    }
    
    this.cla = bytes[0]
    this.ins = bytes[1]
    this.p1 = bytes[2]
    this.p2 = bytes[3]
    
    // Parse data and Le
    if (bytes.size == 4) {
      // Case 1: No data, no Le
      this.data = null
      this.le = null
    } else if (bytes.size == 5) {
      // Case 2: No data, Le present
      this.data = null
      this.le = bytes[4].toInt() and 0xFF
    } else {
      val lc = bytes[4].toInt() and 0xFF
      
      if (bytes.size == 5 + lc) {
        // Case 3: Data present, no Le
        this.data = bytes.copyOfRange(5, 5 + lc)
        this.le = null
      } else if (bytes.size == 5 + lc + 1) {
        // Case 4: Data present, Le present
        this.data = bytes.copyOfRange(5, 5 + lc)
        this.le = bytes[5 + lc].toInt() and 0xFF
      } else {
        throw ValidationError(
          "Invalid APDU length",
          "bytes",
          bytes
        )
      }
    }
    
    validate()
  }
  
  /**
   * Validate the APDU
   * @throws ValidationError if the APDU is invalid
   */
  private fun validate() {
    // Validate data length
    if (data != null && data.size > 255) {
      throw ValidationError(
        "Data length cannot exceed 255 bytes",
        "data",
        data
      )
    }
    
    // Validate Le
    if (le != null && (le < 0 || le > 256)) {
      throw ValidationError(
        "Le must be between 0 and 256",
        "le",
        le
      )
    }
  }
  
  /**
   * Convert the APDU to a byte array
   * @return APDU as byte array
   */
  fun toByteArray(): ByteArray {
    val dataLength = data?.size ?: 0
    val hasLe = le != null
    
    // Calculate the total length
    val length = 4 + (if (dataLength > 0) 1 + dataLength else 0) + (if (hasLe) 1 else 0)
    val bytes = ByteArray(length)
    
    // Header
    bytes[0] = cla
    bytes[1] = ins
    bytes[2] = p1
    bytes[3] = p2
    
    var offset = 4
    
    // Data
    if (dataLength > 0) {
      bytes[offset++] = dataLength.toByte()
      data?.copyInto(bytes, offset)
      offset += dataLength
    }
    
    // Le
    if (hasLe) {
      bytes[offset] = (le!! % 256).toByte()
    }
    
    return bytes
  }
  
  override fun toString(): String {
    val sb = StringBuilder()
    sb.append("CommandAPDU: ")
    sb.append(String.format("CLA=%02X, ", cla))
    sb.append(String.format("INS=%02X, ", ins))
    sb.append(String.format("P1=%02X, ", p1))
    sb.append(String.format("P2=%02X", p2))
    
    if (data != null) {
      sb.append(", Data=")
      data.forEach { sb.append(String.format("%02X", it)) }
    }
    
    if (le != null) {
      sb.append(String.format(", Le=%d", le))
    }
    
    return sb.toString()
  }
}
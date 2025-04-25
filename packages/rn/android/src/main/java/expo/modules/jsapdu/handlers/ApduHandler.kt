package expo.modules.jsapdu.handlers

/**
 * Handler for APDU commands
 * This interface is used to handle APDU commands from external NFC readers
 */
interface ApduHandler {
  /**
   * Handle APDU command
   * @param apdu APDU command
   * @return APDU response
   */
  fun handleApdu(apdu: ByteArray): ByteArray
}
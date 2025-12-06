package app.aoki.jsapdu.rn.core

/**
 * Method-agnostic interface for smart card sessions.
 * Represents an active communication session with a smart card.
 */
interface ICardSession {
  /** Runtime handle for this card session */
  val handle: String

  /**
   * Get the Answer to Reset (ATR) or equivalent initialization data.
   * @return ATR bytes or empty array if not available
   * @throws IllegalStateException if card is not connected
   */
  fun getAtr(): ByteArray

  /**
   * Transmit an APDU command to the card and receive response.
   * @param apdu the command APDU bytes
   * @return the response APDU bytes
   * @throws IllegalStateException if card is not connected or communication fails
   */
  fun transmit(apdu: ByteArray): ByteArray

  /**
   * Reset the card session.
   * Implementation may vary based on the communication method.
   * @throws NotImplementedError if not supported by the device type
   */
  fun reset()

  /**
   * Release this card session and clean up resources.
   * This should be safe to call multiple times.
   */
  fun release()

  /**
   * Check if the card is still present and connected.
   * @return true if card is connected and ready for communication
   */
  fun isCardPresent(): Boolean
}

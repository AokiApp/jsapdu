package app.aoki.jsapdu.rn.core

/**
 * Method-agnostic interface for smart card devices.
 * Implementations can be NFC, OMAPI, BLE, or other communication methods.
 */
interface IDevice {
    /** Unique identifier for this device type/instance */
    val id: String
    
    /** Runtime handle for this device instance */
    val handle: String
    
    /**
     * Acquire the device and activate it for communication.
     * @throws IllegalStateException if device is already acquired or unavailable
     */
    fun acquire()
    
    /**
     * Release the device and clean up resources.
     * This should be safe to call multiple times.
     */
    fun release()
    
    /**
     * Check if the device is available for use.
     * @return true if device is ready for communication
     */
    fun isAvailable(): Boolean
    
    /**
     * Check if a card is present/detected by this device.
     * @return true if a card is detected
     */
    fun isCardPresent(): Boolean
    
    /**
     * Wait for a card to be present within the specified timeout.
     * @param timeout timeout in seconds
     * @throws IllegalStateException if timeout occurs
     */
    fun waitForCardPresence(timeout: Double)
    
    /**
     * Start a new card session.
     * @return handle for the new card session
     * @throws IllegalStateException if no card is present
     */
    fun startSession(): String
    
    /**
     * Get a card session by its handle.
     * @param cardHandle the card session handle
     * @return the card session or null if not found
     */
    fun getTarget(cardHandle: String): ICardSession?
    
    /**
     * Unregister a card session.
     * Called internally when a card session is released.
     * @param cardHandle the card session handle to unregister
     */
    fun unregisterCard(cardHandle: String)
}
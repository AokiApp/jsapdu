package expo.modules.jsapdu.handlers

/**
 * Handler for state change events
 * This interface is used to handle state change events from the HCE service
 */
interface StateChangeHandler {
  /**
   * Handle state change event
   * @param state New state
   */
  fun handleStateChange(state: String)
}
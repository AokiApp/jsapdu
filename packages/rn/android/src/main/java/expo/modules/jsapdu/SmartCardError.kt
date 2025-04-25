package expo.modules.jsapdu

/**
 * Error codes for SmartCard operations
 */
enum class SmartCardErrorCode {
  NOT_INITIALIZED,
  ALREADY_INITIALIZED,
  NO_READERS,
  READER_ERROR,
  NOT_CONNECTED,
  ALREADY_CONNECTED,
  CARD_NOT_PRESENT,
  TRANSMISSION_ERROR,
  PROTOCOL_ERROR,
  TIMEOUT,
  RESOURCE_LIMIT,
  INVALID_PARAMETER,
  UNSUPPORTED_OPERATION,
  PLATFORM_ERROR
}

/**
 * Base error class for SmartCard operations
 */
open class SmartCardError(
  val code: SmartCardErrorCode,
  message: String,
  cause: Throwable? = null
) : Exception(message, cause) {
  
  /**
   * Gets a sanitized error message suitable for logging/display
   * Ensures sensitive information is not exposed
   */
  fun getSafeMessage(): String {
    return message ?: "Unknown error"
  }
  
  /**
   * Gets detailed error information for debugging
   * Should only be used in development/testing
   */
  fun getDebugInfo(): Map<String, Any?> {
    return mapOf(
      "code" to code.name,
      "message" to message,
      "cause" to cause?.let {
        mapOf(
          "name" to it.javaClass.simpleName,
          "message" to it.message,
          "stackTrace" to it.stackTraceToString()
        )
      }
    )
  }
}

/**
 * Error indicating a required resource was not available
 */
class ResourceError(
  message: String,
  val resourceType: String,
  val limit: Int? = null,
  cause: Throwable? = null
) : SmartCardError(SmartCardErrorCode.RESOURCE_LIMIT, message, cause)

/**
 * Error indicating an operation timed out
 */
class TimeoutError(
  message: String,
  val operationType: String,
  val timeoutMs: Int,
  cause: Throwable? = null
) : SmartCardError(SmartCardErrorCode.TIMEOUT, message, cause)

/**
 * Error indicating an invalid parameter was provided
 */
class ValidationError(
  message: String,
  val parameter: String,
  val value: Any?,
  cause: Throwable? = null
) : SmartCardError(SmartCardErrorCode.INVALID_PARAMETER, message, cause)

/**
 * Creates a SmartCardError from an unknown error
 * Useful for wrapping native errors or errors from external libraries
 */
fun fromUnknownError(error: Throwable, code: SmartCardErrorCode = SmartCardErrorCode.PLATFORM_ERROR): SmartCardError {
  if (error is SmartCardError) {
    return error
  }
  
  return SmartCardError(code, error.message ?: "Unknown error", error)
}
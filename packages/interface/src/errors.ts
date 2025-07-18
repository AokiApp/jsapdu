/**
 * Error codes for SmartCard operations
 */
export type SmartCardErrorCode =
  | "NOT_INITIALIZED"
  | "ALREADY_INITIALIZED"
  | "NO_READERS"
  | "READER_ERROR"
  | "NOT_CONNECTED"
  | "ALREADY_CONNECTED"
  | "CARD_NOT_PRESENT"
  | "TRANSMISSION_ERROR"
  | "PROTOCOL_ERROR"
  | "TIMEOUT"
  | "RESOURCE_LIMIT"
  | "INVALID_PARAMETER"
  | "UNSUPPORTED_OPERATION"
  | "PLATFORM_ERROR";

/**
 * Base error class for SmartCard operations
 */
export class SmartCardError extends Error {
  /**
   * Creates a new SmartCardError
   * @param code - Error code identifying the type of error
   * @param message - Human-readable error message
   * @param cause - Optional underlying cause of the error
   */
  constructor(
    public readonly code: SmartCardErrorCode,
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "SmartCardError";
  }

  /**
   * Gets a sanitized error message suitable for logging/display
   * Ensures sensitive information is not exposed
   */
  public getSafeMessage(): string {
    return this.message;
  }

  /**
   * Gets detailed error information for debugging
   * Should only be used in development/testing
   */
  public getDebugInfo(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }
}

/**
 * Error indicating a required resource was not available
 */
export class ResourceError extends SmartCardError {
  constructor(
    message: string,
    public readonly resourceType: string,
    public readonly limit?: number,
    cause?: Error,
  ) {
    super("RESOURCE_LIMIT", message, cause);
    this.name = "ResourceError";
  }
}

/**
 * Error indicating an operation timed out
 */
export class TimeoutError extends SmartCardError {
  constructor(
    message: string,
    public readonly operationType: string,
    public readonly timeoutMs: number,
    cause?: Error,
  ) {
    super("TIMEOUT", message, cause);
    this.name = "TimeoutError";
  }
}

/**
 * Error indicating an invalid parameter was provided
 */
export class ValidationError extends SmartCardError {
  constructor(
    message: string,
    public readonly parameter: string,
    public readonly value: unknown,
    cause?: Error,
  ) {
    super("INVALID_PARAMETER", message, cause);
    this.name = "ValidationError";
  }
}

/**
 * Creates a SmartCardError from an unknown error
 * Useful for wrapping native errors or errors from external libraries
 */
export function fromUnknownError(
  error: unknown,
  code: SmartCardErrorCode = "PLATFORM_ERROR",
): SmartCardError {
  if (error instanceof SmartCardError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new SmartCardError(
    code,
    message,
    error instanceof Error ? error : undefined,
  );
}

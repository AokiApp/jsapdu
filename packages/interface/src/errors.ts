/**
 * Error codes for SmartCard operations
 */
export type SmartCardErrorCode =
  | "NOT_INITIALIZED"
  | "ALREADY_INITIALIZED"
  // Reader related errors
  | "NO_READERS"
  | "READER_ERROR"
  | "READER_BUSY"
  | "READER_UNAVAILABLE"
  | "READER_REMOVED"
  // Connection related errors
  | "NOT_CONNECTED"
  | "ALREADY_CONNECTED"
  | "CONNECTION_LOST"
  // Card related errors
  | "CARD_NOT_PRESENT"
  | "CARD_MUTE"
  | "CARD_RESET_REQUIRED"
  | "CARD_REMOVED"
  // Communication related errors
  | "TRANSMISSION_ERROR"
  | "PROTOCOL_ERROR"
  | "PROTOCOL_MISMATCH"
  // Resource related errors
  | "MEMORY_ERROR"
  | "TIMEOUT"
  | "RESOURCE_LIMIT"
  | "RESOURCE_BUSY"
  // Other errors
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
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "SmartCardError";
  }

  /**
   * Indicates if the error is potentially recoverable
   */
  protected get recoverable(): boolean {
    const recoverableCodes: SmartCardErrorCode[] = [
      "CARD_NOT_PRESENT",
      "CARD_RESET_REQUIRED",
      "TIMEOUT",
      "READER_BUSY",
      "RESOURCE_BUSY"
    ];
    return recoverableCodes.includes(this.code);
  }

  /**
   * Gets a sanitized error message suitable for logging/display
   * Ensures sensitive information is not exposed
   */
  public getSafeMessage(): string {
    // Sanitize potentially sensitive information
    const sanitized = this.message
      .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '[EMAIL]')
      .replace(/\b\d{4}[-]?\d{4}[-]?\d{4}[-]?\d{4}\b/g, '[CARD_NUMBER]')
      .replace(/\b[0-9A-Fa-f]{32,}\b/g, '[HASH]');

    return `${this.code}: ${sanitized}`;
  }

  /**
   * Gets detailed error information for debugging
   * Should only be used in development/testing
   */
  public getDebugInfo(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message || "",
      recoverable: this.recoverable,
      timestamp: new Date().toISOString(),
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }

  /**
   * Gets recovery guidance based on the error type
   */
  public getRecoveryGuidance(): string {
    switch (this.code) {
      case "CARD_NOT_PRESENT":
        return "Please insert a smart card and try again";
      case "CARD_RESET_REQUIRED":
        return "The card needs to be reset. Remove and reinsert the card";
      case "READER_UNAVAILABLE":
        return "Check if the reader is properly connected and powered on";
      case "TIMEOUT":
        return "The operation timed out. Please try again";
      default:
        return "Please check the device connection and try again";
    }
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
    cause?: Error
  ) {
    super("RESOURCE_LIMIT", message, cause);
    this.name = "ResourceError";
  }

  public override getRecoveryGuidance(): string {
    if (this.resourceType === "memory") {
      return "Try closing other applications or freeing up system memory";
    }
    if (this.resourceType === "connections") {
      return "Try closing unused card reader connections";
    }
    if (this.limit) {
      return `Resource limit of ${this.limit} exceeded for ${this.resourceType}. Try reducing resource usage`;
    }
    return super.getRecoveryGuidance();
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
    cause?: Error
  ) {
    super("TIMEOUT", message, cause);
    this.name = "TimeoutError";
  }

  public override getRecoveryGuidance(): string {
    return this.operationType === "platform_init"
      ? "Check if the smart card reader is properly connected and try again"
      : this.operationType === "card_operation"
      ? "The card operation timed out. Try removing and reinserting the card"
      : super.getRecoveryGuidance();
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
    cause?: Error
  ) {
    super("INVALID_PARAMETER", message, cause);
    this.name = "ValidationError";
  }

  public override getRecoveryGuidance(): string {
    return `Invalid value provided for ${this.parameter}. ` +
      (typeof this.value === "string" && this.value.length > 0
        ? "The provided value may be in an incorrect format"
        : typeof this.value === "number"
        ? "The provided number may be out of the valid range"
        : "Please check the parameter requirements");
  }
}

/**
 * Creates a SmartCardError from an unknown error
 * Useful for wrapping native errors or errors from external libraries
 */
export function fromUnknownError(error: unknown, code: SmartCardErrorCode = "PLATFORM_ERROR"): SmartCardError {
  if (error instanceof SmartCardError) {
    return error;
  }

  // Attempt to categorize unknown errors based on message content
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes("timeout")) {
      return new TimeoutError(
        error.message,
        "unknown_operation",
        30000,
        error
      );
    }

    if (errorMessage.includes("memory") || errorMessage.includes("resource")) {
      return new ResourceError(
        error.message,
        "unknown",
        undefined,
        error
      );
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return new SmartCardError(
    code,
    message,
    error instanceof Error ? error : undefined
  );
}
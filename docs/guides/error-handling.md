# Error Handling Guide

## Overview

jsapdu provides a comprehensive error handling system designed to:
- Provide structured error information
- Enable proper error recovery
- Protect sensitive information
- Support debugging
- Handle platform-specific errors

## Error Types

### SmartCardError

Base error class for all jsapdu errors:

```typescript
import { SmartCardError } from "@aokiapp/interface";

try {
  await card.transmit(command);
} catch (error) {
  if (error instanceof SmartCardError) {
    console.error(`Operation failed: ${error.getSafeMessage()}`);
    // Access error code for specific handling
    if (error.code === "CARD_NOT_PRESENT") {
      // Handle missing card
    }
  }
}
```

### Specialized Error Types

1. ResourceError - For resource limitation issues:
```typescript
try {
  await device.startSession();
} catch (error) {
  if (error instanceof ResourceError) {
    console.error(`Resource limit reached: ${error.resourceType}`);
    if (error.limit) {
      console.error(`Limit: ${error.limit}`);
    }
  }
}
```

2. TimeoutError - For operation timeouts:
```typescript
try {
  await card.transmit(command);
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error(
      `Operation ${error.operationType} timed out after ${error.timeoutMs}ms`
    );
  }
}
```

3. ValidationError - For invalid parameters:
```typescript
try {
  await card.transmit(command);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(
      `Invalid ${error.parameter}: ${error.value}`
    );
  }
}
```

## Error Codes

The library uses the following error codes:

| Code | Description | Common Causes |
|------|-------------|---------------|
| NOT_INITIALIZED | Platform not initialized | Using platform before init() |
| ALREADY_INITIALIZED | Platform already initialized | Calling init() twice |
| NO_READERS | No card readers found | Hardware not connected |
| READER_ERROR | Card reader error | Hardware/driver issues |
| NOT_CONNECTED | Not connected to card | Using card before connection |
| ALREADY_CONNECTED | Already connected to card | Connecting twice |
| CARD_NOT_PRESENT | No card in reader | Missing or removed card |
| TRANSMISSION_ERROR | APDU transmission failed | Communication issues |
| PROTOCOL_ERROR | Protocol-level error | Invalid APDU format |
| TIMEOUT | Operation timed out | Slow card/reader response |
| RESOURCE_LIMIT | Resource limit reached | Too many connections |
| INVALID_PARAMETER | Invalid parameter | Wrong APDU parameters |
| UNSUPPORTED_OPERATION | Operation not supported | Platform limitations |
| PLATFORM_ERROR | Platform-specific error | Various platform issues |

## Best Practices

1. Always catch SmartCardError:
```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof SmartCardError) {
    // Handle structured error
  } else {
    // Handle unknown error
  }
}
```

2. Use error codes for specific handling:
```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof SmartCardError) {
    switch (error.code) {
      case "CARD_NOT_PRESENT":
        // Handle missing card
        break;
      case "TIMEOUT":
        // Handle timeout
        break;
      default:
        // Handle other errors
    }
  }
}
```

3. Safe error messages in production:
```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof SmartCardError) {
    // Use getSafeMessage() for user display
    console.error(error.getSafeMessage());
    
    // Use getDebugInfo() only in development
    if (process.env.NODE_ENV === "development") {
      console.debug(error.getDebugInfo());
    }
  }
}
```

4. Resource cleanup in error cases:
```typescript
let card;
try {
  card = await device.startSession();
  await card.transmit(command);
} catch (error) {
  // Handle error
} finally {
  if (card) {
    await card.release();
  }
}
```

5. Using async dispose pattern:
```typescript
async function example() {
  await using platform = manager.getPlatform();
  await using device = (await platform.getDevices())[0].acquireDevice();
  await using card = await device.startSession();
  
  // Resources automatically cleaned up even if error occurs
  await card.transmit(command);
}
```

## Platform-Specific Errors

When implementing a new platform, convert platform-specific errors to SmartCardError:

```typescript
try {
  // Platform-specific operation
} catch (error) {
  throw fromUnknownError(error, "PLATFORM_ERROR");
}
```

## Debugging

For debugging purposes, you can access detailed error information:

```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof SmartCardError) {
    const debugInfo = error.getDebugInfo();
    console.debug(JSON.stringify(debugInfo, null, 2));
  }
}
```

## Error Recovery

1. Transient Errors:
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof SmartCardError) {
        if (error.code === "TRANSMISSION_ERROR") {
          lastError = error;
          continue;
        }
        throw error;
      }
      throw error;
    }
  }
  
  throw lastError;
}
```

2. Resource Cleanup:
```typescript
try {
  await card.transmit(command);
} catch (error) {
  if (error instanceof SmartCardError) {
    if (error.code === "CARD_NOT_PRESENT") {
      await card.release();
      card = await device.startSession();
    }
  }
}
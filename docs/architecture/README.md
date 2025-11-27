# jsapdu Architecture

## Overview

jsapdu is designed with a layered architecture that provides:

- Platform independence through abstraction
- Extensibility for different card communication protocols
- Type safety and modern resource management
- Clear separation between core functionality and utilities

## Core Components

### 1. Platform Layer

```typescript
export abstract class SmartCardPlatform {
  public abstract init(force?: boolean): Promise<void>;
  public abstract release(force?: boolean): Promise<void>;
  public abstract getDeviceInfo(): Promise<SmartCardDeviceInfo[]>;
  public abstract acquireDevice(id: string): Promise<SmartCardDevice>;
}
```

The platform layer provides:

- Platform initialization and cleanup
- Device enumeration and management
- Resource lifecycle management
- Error handling and recovery

### 2. Device Layer
```typescript
export abstract class SmartCardDevice {
  public abstract getDeviceInfo(): SmartCardDeviceInfo;
  public abstract isSessionActive(): boolean;
  public abstract isDeviceAvailable(): Promise<boolean>;
  public abstract isCardPresent(): Promise<boolean>;
  public abstract startSession(): Promise<SmartCard>;
  public abstract waitForCardPresence(timeout: number): Promise<void>;
  public abstract startHceSession(): Promise<EmulatedCard>;
  public abstract release(): Promise<void>;
}
```
```

The device layer handles:

- Card reader state management
- Card presence detection
- Session establishment
- Device-specific operations

### 3. Card Layer

```typescript
export abstract class SmartCard {
  public abstract getAtr(): Promise<Uint8Array>;
  public abstract transmit(apdu: CommandApdu): Promise<ResponseApdu>;
  public abstract transmit(apdu: Uint8Array): Promise<Uint8Array>;
  public abstract reset(): Promise<void>;
  public abstract release(): Promise<void>;
}
```

The card layer provides:

- APDU command transmission
- Card reset functionality
- ATR/ATS handling
- Session management

## Package Structure

```
jsapdu/
├── packages/
│   ├── interface/         # Core abstractions
│   ├── pcsc/              # PC/SC implementation
│   ├── pcsc-ffi-node/     # Native PC/SC FFI bindings
│   ├── apdu-utils/        # APDU utilities
│   ├── mynacard/          # MynaCard specific code
│   └── rn/                # React Native module
```

### Interface Package

- Defines core abstractions
- Provides APDU handling
- Implements error system
- Contains common utilities

### PCSC Package

- Implements PC/SC platform
- Handles USB card readers
- Manages reader lifecycle
- Provides APDU transmission

## Error Handling

The error system is designed to:

- Provide structured error information
- Enable proper error recovery
- Protect sensitive information
- Support debugging
- Handle platform-specific errors

```typescript
export class SmartCardError extends Error {
  constructor(
    public readonly code: SmartCardErrorCode,
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
  }
}
```

## Resource Management

Resources are managed using:

- Symbol.asyncDispose for automatic cleanup
- Explicit state tracking
- Error-safe release patterns
- Timeout handling

Example:

```typescript
async function example() {
  await using platform = manager.getPlatform();
  const infos = await platform.getDeviceInfo();
  await using device = await platform.acquireDevice(infos[0].id);
  await using card = await device.startSession();

  // Resources automatically cleaned up
}
```

## Extension Points

### 1. New Platforms

To add a new platform:

1. Implement SmartCardPlatformManager
2. Implement SmartCardPlatform
3. Implement device and card classes
4. Handle platform-specific errors

### 2. New Card Types

To add support for new cards:

1. Create card-specific APDU commands
2. Implement high-level operations
3. Add TLV parsing schemas if needed
4. Create utility functions

### 3. New Protocols

To add new communication protocols:

1. Extend platform abstractions if needed
2. Implement protocol-specific device handling
3. Add protocol configuration options
4. Implement error handling

## Security Considerations

1. Resource Cleanup

- All resources must be properly released
- Sensitive data should be cleared
- Connections must be closed properly

2. Error Handling

- Sensitive information must be protected
- Error messages should be sanitized
- Stack traces should be hidden in production

3. Input Validation

- APDU commands must be validated
- Buffer sizes must be checked
- Resource limits must be enforced

## Performance Considerations

1. Memory Management

- Buffer pooling for frequent operations
- Proper cleanup of large buffers
- Minimal copying of data

2. Connection Handling

- Connection pooling where appropriate
- Proper timeout handling
- Resource limit enforcement

3. Async Operations

- Proper async/await usage
- Cancellation support
- Timeout handling

## Testing Strategy

1. Unit Tests

- Core functionality testing
- Error handling verification
- Resource management testing

2. Integration Tests

- Platform implementation testing
- End-to-end scenarios
- Error recovery testing

3. Performance Tests

- Resource usage monitoring
- Operation timing
- Stress testing

## Future Considerations

1. Platform Support

- Web platform support (WebUSB, WebNFC)
- Mobile platform support
- Cloud HSM integration

2. Feature Extensions

- Secure channel support
- Additional card protocols
- Enhanced debugging tools

3. Performance Improvements

- Connection pooling
- Buffer optimization
- Caching strategies

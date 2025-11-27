# @aokiapp/jsapdu-interface

Core abstractions and interfaces for SmartCard communication in the jsapdu ecosystem.

## Overview

This package provides the foundational abstractions that enable platform-agnostic SmartCard communication. It defines the core interfaces, error handling system, and APDU command/response structures used throughout the jsapdu library.

## Installation

```bash
npm install @aokiapp/jsapdu-interface
```

## Core Components

### Platform Abstractions

#### SmartCardPlatformManager

```typescript
import { SmartCardPlatformManager } from "@aokiapp/jsapdu-interface";

// Abstract base class for platform managers
abstract class SmartCardPlatformManager {
  abstract getPlatform(): SmartCardPlatform;
}
```

#### SmartCardPlatform

```typescript
// Main platform interface
abstract class SmartCardPlatform {
  public abstract init(force?: boolean): Promise<void>;
  public abstract release(force?: boolean): Promise<void>;
  public abstract getDeviceInfo(): Promise<SmartCardDeviceInfo[]>;
  public abstract acquireDevice(id: string): Promise<SmartCardDevice>;
}
```

### Device and Card Abstractions

#### SmartCardDevice

```typescript
abstract class SmartCardDevice {
  public abstract isSessionActive(): boolean;
  public abstract isDeviceAvailable(): Promise<boolean>;
  public abstract isCardPresent(): Promise<boolean>;
  public abstract startSession(): Promise<SmartCard>;
  public abstract waitForCardPresence(timeout: number): Promise<void>;
  public abstract startHceSession(): Promise<EmulatedCard>;
}
```

#### SmartCard

```typescript
abstract class SmartCard {
  public abstract getAtr(): Promise<Uint8Array>;
  public abstract transmit(apdu: CommandApdu): Promise<ResponseApdu>;
  public abstract transmit(apdu: Uint8Array): Promise<Uint8Array>;
  public abstract reset(): Promise<void>;
  public abstract release(): Promise<void>;
}
```

### APDU Command System

#### CommandApdu

```typescript
import { CommandApdu } from "@aokiapp/jsapdu-interface";

// Create APDU commands
const selectCommand = new CommandApdu(
  0x00, // CLA
  0xa4, // INS
  0x04, // P1
  0x00, // P2
  Buffer.from("A0000000041010", "hex"), // Data
  0x00, // Le
);

// Serialize to bytes
const bytes = selectCommand.toUint8Array();
const hexString = selectCommand.toHexString();

// Parse from bytes
const parsed = CommandApdu.fromUint8Array(bytes);
```

#### ResponseApdu

```typescript
import { ResponseApdu } from "@aokiapp/jsapdu-interface";

// Parse response from card
const response = ResponseApdu.fromUint8Array(responseBytes);

console.log("Status Word:", response.sw.toString(16));
console.log("SW1:", response.sw1, "SW2:", response.sw2);
console.log("Data:", response.data);
```

### Error Handling

#### Structured Error System

```typescript
import {
  SmartCardError,
  ResourceError,
  TimeoutError,
  ValidationError,
} from "@aokiapp/jsapdu-interface";

try {
  await card.transmit(command);
} catch (error) {
  if (error instanceof SmartCardError) {
    switch (error.code) {
      case "CARD_NOT_PRESENT":
        console.log("Please insert a card");
        break;
      case "TIMEOUT":
        console.log("Operation timed out");
        break;
      default:
        console.log("Error:", error.getSafeMessage());
    }
  }
}
```

#### Error Codes

- `NOT_INITIALIZED` - Platform not initialized
- `CARD_NOT_PRESENT` - No card in reader
- `TRANSMISSION_ERROR` - APDU transmission failed
- `TIMEOUT` - Operation timed out
- `RESOURCE_LIMIT` - Resource limit reached
- `INVALID_PARAMETER` - Invalid parameter provided
- `UNSUPPORTED_OPERATION` - Operation not supported
- `PLATFORM_ERROR` - Platform-specific error

### Resource Management

#### Automatic Cleanup

```typescript
// Using Symbol.asyncDispose
await using platform = manager.getPlatform();
await using device = await platform.acquireDevice(deviceId);
await using card = await device.startSession();

// Resources automatically cleaned up
```

#### Manual Cleanup

```typescript
try {
  await platform.init();
  const device = await platform.acquireDevice(deviceId);
  const card = await device.startSession();

  // Use card...
} finally {
  await card?.release();
  await device?.release();
  await platform?.release();
}
```

## Constants

```typescript
import { INS } from "@aokiapp/jsapdu-interface";

// Common instruction bytes
const selectCommand = new CommandApdu(0x00, INS.SELECT, 0x04, 0x00, aid);
const readCommand = new CommandApdu(
  0x00,
  INS.READ_BINARY,
  0x00,
  0x00,
  null,
  256,
);
const verifyCommand = new CommandApdu(0x00, INS.VERIFY, 0x00, 0x80, pinData);
```

## Utilities

```typescript
import { toUint8Array } from "@aokiapp/jsapdu-interface";

// Convert various data types to Uint8Array
const bytes1 = toUint8Array("01020304"); // From hex string
const bytes2 = toUint8Array([1, 2, 3, 4]); // From number array
const bytes3 = toUint8Array(existingUint8Array); // Pass through
```

## Implementation Notes

### Platform Implementation

When implementing a new platform:

1. Extend `SmartCardPlatformManager`
2. Implement all abstract methods in `SmartCardPlatform`
3. Create device and card implementations
4. Handle platform-specific errors by converting to `SmartCardError`

### Error Handling Best Practices

- Always use structured error codes
- Provide safe error messages for user display
- Include debug information for development
- Convert platform-specific errors using `fromUnknownError()`

### Resource Management

- Implement `Symbol.asyncDispose` for automatic cleanup
- Ensure proper error handling in release methods
- Track resource state to prevent double-release
- Clean up resources in reverse acquisition order

## Related Packages

- [`@aokiapp/jsapdu-pcsc`](../pcsc) - PC/SC platform implementation
- [`@aokiapp/apdu-utils`](../apdu-utils) - APDU command utilities
- [`@aokiapp/mynacard`](../mynacard) - Japanese MynaCard support

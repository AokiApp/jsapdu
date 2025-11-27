# API Reference

Complete API documentation for all jsapdu packages.

## Core Packages

### [@aokiapp/jsapdu-interface](../../packages/interface/README.md)

Core abstractions and interfaces for platform-agnostic SmartCard communication.

**Key Classes:**

- [abstracts.ts](../../packages/interface/src/abstracts.ts) - Platform and device/card interfaces
- [command-apdu.ts](../../packages/interface/src/apdu/command-apdu.ts) - APDU command construction
- [response-apdu.ts](../../packages/interface/src/apdu/response-apdu.ts) - APDU response parsing
- [errors.ts](../../packages/interface/src/errors.ts) - Structured error handling

### [@aokiapp/jsapdu-pcsc](../../packages/pcsc/README.md)

PC/SC platform implementation for desktop environments.

**Key Classes:**

- [platform-manager.ts](../../packages/pcsc/src/platform-manager.ts) - PC/SC platform manager
- [platform.ts](../../packages/pcsc/src/platform.ts) - PC/SC platform implementation
- [device.ts](../../packages/pcsc/src/device.ts) - PC/SC device implementation
- [card.ts](../../packages/pcsc/src/card.ts) - PC/SC card communication

### [@aokiapp/jsapdu-rn](../../packages/rn/README.md)

Experimental React Native implementation for mobile environments.

## Auxiliary Packages

### [@aokiapp/apdu-utils](../../packages/apdu-utils/README.md)

Utility functions for building common APDU commands.

**Key Functions:**

- [select.ts](../../packages/apdu-utils/src/select.ts) - selectDf, selectEf
- [read-binary.ts](../../packages/apdu-utils/src/read-binary.ts) - readEfBinaryFull, readBinary
- [verify.ts](../../packages/apdu-utils/src/verify.ts) - verify

### [@aokiapp/mynacard](../../packages/mynacard/README.md)

Japanese MynaCard support with specialized functionality.

**Key Constants:**

- [constants.ts](../../packages/mynacard/src/constants.ts) - JPKI_AP, KENHOJO_AP, KENKAKU_AP constants

**Key Schemas:**

- [schema.ts](../../packages/mynacard/src/schema.ts) - TLV schemas (schemaKenhojoBasicFour, schemaCertificate, schemaKenhojoSignature)

## Low-Level Packages

### [@aokiapp/pcsc-ffi-node](../../packages/pcsc-ffi-node/README.md)

Native PC/SC bindings through Foreign Function Interface.

**Key Functions:**

- [SCardEstablishContext()](../../packages/pcsc-ffi-node/README.md) - Initialize PC/SC
- [SCardConnect()](../../packages/pcsc-ffi-node/README.md) - Connect to card
- [SCardTransmit()](../../packages/pcsc-ffi-node/README.md) - Send APDU commands
- [SCardListReaders()](../../packages/pcsc-ffi-node/README.md) - List available readers

## Quick Reference

### Common Usage Patterns

#### Basic Card Connection

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";

const manager = PcscPlatformManager.getInstance();
await using platform = manager.getPlatform();
await platform.init();

const devices = await platform.getDeviceInfo();
await using device = await platform.acquireDevice(devices[0].id);
await using card = await device.startSession();
```

#### APDU Command Construction

```typescript
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import { selectDf, readEfBinaryFull } from "@aokiapp/apdu-utils";

// Manual construction
const cmd1 = new CommandApdu(0x00, 0xa4, 0x04, 0x00, aid);

// Using utilities
const cmd2 = selectDf("A0000000041010");
const cmd3 = readEfBinaryFull(0x01);
```

#### TLV Data Parsing

```typescript
import { SchemaParser, Schema } from "@aokiapp/tlv/parser";

const schema = Schema.constructed("data", [
  Schema.primitive("field1", decoder1),
  Schema.primitive("field2", decoder2),
]);

const parser = new SchemaParser(schema);
const result = parser.parse(buffer);
```

#### MynaCard Operations

```typescript
import {
  KENHOJO_AP,
  KENHOJO_AP_EF,
  schemaKenhojoBasicFour,
} from "@aokiapp/mynacard";
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";

await card.transmit(selectDf(KENHOJO_AP));
await card.transmit(verify(pin, { ef: KENHOJO_AP_EF.PIN }));
const data = await card.transmit(readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR));

const parser = new SchemaParser(schemaKenhojoBasicFour);
const info = parser.parse(data.arrayBuffer());
```

### Error Handling

```typescript
import {
  SmartCardError,
  ResourceError,
  TimeoutError,
} from "@aokiapp/jsapdu-interface";

try {
  await card.transmit(command);
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
        console.error(error.getSafeMessage());
    }
  }
}
```

### Resource Management

```typescript
// Automatic cleanup (recommended)
await using platform = manager.getPlatform();
await using device = await platform.acquireDevice(deviceId);
await using card = await device.startSession();

// Manual cleanup (if needed)
try {
  // Use resources
} finally {
  await card?.release();
  await device?.release();
  await platform?.release();
}
```

## Type Definitions

### Core Types

```typescript
// Platform abstractions
type SmartCardPlatformManager = abstract class;
type SmartCardPlatform = abstract class;
type SmartCardDevice = abstract class;
type SmartCard = abstract class;

// APDU types
type CommandApdu = class;
type ResponseApdu = class;

// Error types
type SmartCardError = class;
type SmartCardErrorCode = string literal union;

// Device information
type SmartCardDeviceInfo = abstract class;
```

### Utility Types

```typescript
// TLV parsing
type BasicTLVParser = class;
type SchemaParser<T> = class;
type TLVResult = interface;
type TagClass = enum;

// APDU utilities
type selectDf = function;
type readBinary = function;
type verify = function;
```

## See Also

- [Getting Started Guide](../getting-started.md)
- [Architecture Documentation](../architecture/README.md)
- [MynaCard Guide](../guides/mynacard.md)

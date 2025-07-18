# API Reference

Complete API documentation for all jsapdu packages.

## Core Packages

### [@aokiapp/jsapdu-interface](./interface.md)

Core abstractions and interfaces for platform-agnostic SmartCard communication.

**Key Classes:**

- [`SmartCardPlatformManager`](./interface.md#smartcardplatformmanager) - Platform manager abstraction
- [`SmartCardPlatform`](./interface.md#smartcardplatform) - Platform interface
- [`SmartCardDevice`](./interface.md#smartcarddevice) - Device abstraction
- [`SmartCard`](./interface.md#smartcard) - Card communication interface
- [`CommandApdu`](./interface.md#commandapdu) - APDU command construction
- [`ResponseApdu`](./interface.md#responseapdu) - APDU response parsing
- [`SmartCardError`](./interface.md#smartcarderror) - Error handling system

### [@aokiapp/jsapdu-pcsc](./pcsc.md)

PC/SC platform implementation for desktop environments.

**Key Classes:**

- [`PcscPlatformManager`](./pcsc.md#pcscplatformmanager) - PC/SC platform manager
- [`PcscPlatform`](./pcsc.md#pcscplatform) - PC/SC platform implementation
- [`PcscDevice`](./pcsc.md#pcscdevice) - PC/SC device implementation
- [`PcscCard`](./pcsc.md#pcsccard) - PC/SC card communication

### [@aokiapp/apdu-utils](./apdu-utils.md)

Utility functions for building common APDU commands.

**Key Functions:**

- [`selectDf()`](./apdu-utils.md#selectdf) - Select directory file (application)
- [`selectEf()`](./apdu-utils.md#selectef) - Select elementary file
- [`readEfBinaryFull()`](./apdu-utils.md#readefbinaryfull) - Read complete file
- [`readBinary()`](./apdu-utils.md#readbinary) - Read binary data with options
- [`verify()`](./apdu-utils.md#verify) - PIN verification

### [@aokiapp/tlv-parser](./tlv-parser.md)

TLV (Tag-Length-Value) data parsing with schema support.

**Key Classes:**

- [`BasicTLVParser`](./tlv-parser.md#basictlvparser) - Basic TLV parsing
- [`SchemaParser`](./tlv-parser.md#schemaparser) - Schema-based parsing
- [`Schema`](./tlv-parser.md#schema) - Schema definition utilities

### [@aokiapp/mynacard](./mynacard.md)

Japanese MynaCard support with specialized functionality.

**Key Constants:**

- [`JPKI_AP`](./mynacard.md#jpki_ap) - JPKI application constants
- [`KENHOJO_AP`](./mynacard.md#kenhojo_ap) - Kenhojo application constants
- [`KENKAKU_AP`](./mynacard.md#kenkaku_ap) - Kenkaku application constants

**Key Schemas:**

- [`schemaKenhojoBasicFour`](./mynacard.md#schemakenhojobasicfour) - Basic four information
- [`schemaCertificate`](./mynacard.md#schemacertificate) - Certificate structure
- [`schemaKenhojoSignature`](./mynacard.md#schemakenhojosignature) - Signature structure

## Low-Level Packages

### [@aokiapp/pcsc-ffi-node](./pcsc-ffi-node.md)

Native PC/SC bindings through Foreign Function Interface.

**Key Functions:**

- [`SCardEstablishContext()`](./pcsc-ffi-node.md#scardestablishcontext) - Initialize PC/SC
- [`SCardConnect()`](./pcsc-ffi-node.md#scardconnect) - Connect to card
- [`SCardTransmit()`](./pcsc-ffi-node.md#scardtransmit) - Send APDU commands
- [`SCardListReaders()`](./pcsc-ffi-node.md#scardlistreaders) - List available readers

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
import { SchemaParser, Schema } from "@aokiapp/tlv-parser";

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
import { verify, readEfBinaryFull } from "@aokiapp/apdu-utils";

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
- [Examples](../examples/README.md)

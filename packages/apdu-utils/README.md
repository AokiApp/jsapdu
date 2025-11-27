# @aokiapp/apdu-utils

Utility functions for building common APDU commands (SELECT, READ BINARY, VERIFY) used in SmartCard communication.

## Overview

This package provides high-level utility functions that simplify the creation of standard ISO 7816 APDU commands. Instead of manually constructing APDU bytes, you can use these utilities to build commands with proper parameter validation and formatting.

## Installation

```bash
npm install @aokiapp/apdu-utils @aokiapp/jsapdu-interface
```

## Quick Start

```typescript
import {
  selectDf,
  selectEf,
  readEfBinaryFull,
  verify,
} from "@aokiapp/apdu-utils";
import { CommandApdu } from "@aokiapp/jsapdu-interface";

// Select application by AID
const selectCmd = selectDf("A0000000041010", true); // Request FCI

// Select elementary file
const selectFileCmd = selectEf("0001");

// Read entire file
const readCmd = readEfBinaryFull(0x01);

// Verify PIN
const verifyCmd = verify("1234", { ef: 0x11 });

// All utilities return CommandApdu objects ready for transmission
await card.transmit(selectCmd);
```

## SELECT Commands

### selectDf() - Select Directory File (Application)

```typescript
import { selectDf } from "@aokiapp/apdu-utils";

// Select by AID string
const cmd1 = selectDf("A0000000041010");

// Select by AID bytes
const cmd2 = selectDf([0xa0, 0x00, 0x00, 0x00, 0x04, 0x10, 0x10]);

// Select by Uint8Array
const aid = new Uint8Array([0xa0, 0x00, 0x00, 0x00, 0x04, 0x10, 0x10]);
const cmd3 = selectDf(aid);

// Request File Control Information (FCI)
const cmd4 = selectDf("A0000000041010", true); // Returns FCI
const cmd5 = selectDf("A0000000041010", false); // No FCI (default)
```

### selectEf() - Select Elementary File

```typescript
import { selectEf } from "@aokiapp/apdu-utils";

// Select EF by file ID (2 bytes)
const cmd1 = selectEf("0001");
const cmd2 = selectEf([0x00, 0x01]);
const cmd3 = selectEf(new Uint8Array([0x00, 0x01]));

// File ID must be exactly 2 bytes
selectEf("00"); // ❌ Error: Invalid EF identifier
selectEf("000102"); // ❌ Error: Invalid EF identifier
```

### select() - Generic Select Command

```typescript
import { select } from "@aokiapp/apdu-utils";

// Full control over SELECT parameters
const cmd = select(
  0x04, // P1: Select by name (AID)
  0x00, // P2: First/only occurrence
  "A0000000041010", // Data: AID
  0x00, // Le: Request response data
);
```

## READ BINARY Commands

### readEfBinaryFull() - Read Complete Elementary File

```typescript
import { readEfBinaryFull } from "@aokiapp/apdu-utils";

// Read entire EF by short file ID (0-31)
const cmd1 = readEfBinaryFull(0x01); // Read EF with ID 1
const cmd2 = readEfBinaryFull(0x1f); // Read EF with ID 31

// Uses maximum Le (65536 bytes) to read complete file
readEfBinaryFull(32); // ❌ Error: Invalid short EF identifier
```

### readCurrentEfBinaryFull() - Read Current Elementary File

```typescript
import { readCurrentEfBinaryFull } from "@aokiapp/apdu-utils";

// Read entire currently selected EF
const cmd = readCurrentEfBinaryFull();

// Equivalent to READ BINARY with P1=00, P2=00, Le=65536
```

### readBinary() - Flexible Read Binary

```typescript
import { readBinary } from "@aokiapp/apdu-utils";

// Read from specific offset and length
const cmd1 = readBinary(0x0000, 256); // Read 256 bytes from start
const cmd2 = readBinary(0x0100, 128); // Read 128 bytes from offset 256

// Extended APDU support
const cmd3 = readBinary(0x0000, 65536, true); // Extended APDU

// Use maximum Le for given APDU type
const cmd4 = readBinary(0x0000, 0, false, true); // Standard max (256)
const cmd5 = readBinary(0x0000, 0, true, true); // Extended max (65536)

// Advanced options
const cmd6 = readBinary(0x0000, 256, false, false, {
  shortEfId: 0x01, // Read from specific EF
  isCurrentEF: true, // Read from current EF
  useRelativeAddress8Bit: true, // Use 8-bit relative addressing
});
```

## VERIFY Commands

### verify() - PIN Verification

```typescript
import { verify } from "@aokiapp/apdu-utils";

// Verify PIN for specific EF
const cmd1 = verify("1234", { ef: 0x11 }); // 4-digit PIN for EF 0x11
const cmd2 = verify("123456", { ef: 0x18 }); // 6-digit PIN for EF 0x18

// Verify PIN for current context
const cmd3 = verify("1234", { isCurrent: true });

// PIN as byte array
const cmd4 = verify([0x31, 0x32, 0x33, 0x34], { ef: 0x11 }); // "1234"

// PIN as Uint8Array
const pinBytes = new Uint8Array([0x31, 0x32, 0x33, 0x34]);
const cmd5 = verify(pinBytes, { ef: 0x11 });
```

## Data Conversion

apdu-utils focuses on APDU builders. If you need general-purpose conversions, use utilities provided by `@aokiapp/jsapdu-interface`:

```typescript
import { toUint8Array } from "@aokiapp/jsapdu-interface";

// Convert hex string to bytes
const bytes1 = toUint8Array("01020304");

// Convert number array to bytes
const bytes2 = toUint8Array([1, 2, 3, 4]);

// Pass through existing Uint8Array
const existing = new Uint8Array([1, 2, 3, 4]);
const bytes3 = toUint8Array(existing);
```

## Common Usage Patterns

### Application Selection and File Reading

```typescript
import { selectDf, selectEf, readEfBinaryFull } from "@aokiapp/apdu-utils";

async function readApplicationFile(card, aid, fileId) {
  // Select application
  const selectApp = selectDf(aid);
  let response = await card.transmit(selectApp);
  if (response.sw !== 0x9000) {
    throw new Error("Failed to select application");
  }

  // Select file
  const selectFile = selectEf(fileId);
  response = await card.transmit(selectFile);
  if (response.sw !== 0x9000) {
    throw new Error("Failed to select file");
  }

  // Read complete file
  const readFile = readEfBinaryFull(0x01);
  response = await card.transmit(readFile);
  if (response.sw !== 0x9000) {
    throw new Error("Failed to read file");
  }

  return response.data;
}
```

### PIN Verification and Protected Operations

```typescript
import { verify, readEfBinaryFull } from "@aokiapp/apdu-utils";

async function readProtectedFile(card, pin, pinEf, fileEf) {
  // Verify PIN
  const verifyCmd = verify(pin, { ef: pinEf });
  let response = await card.transmit(verifyCmd);

  if (response.sw !== 0x9000) {
    const retriesLeft = response.sw2 & 0x0f;
    throw new Error(`PIN verification failed. ${retriesLeft} retries left.`);
  }

  // Read protected file
  const readCmd = readEfBinaryFull(fileEf);
  response = await card.transmit(readCmd);

  return response.data;
}
```

### Japanese MynaCard Pattern

```typescript
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard";

async function readMynaCardBasicInfo(card, pin) {
  // Select Kenhojo application
  await card.transmit(selectDf(KENHOJO_AP));

  // Verify PIN
  await card.transmit(verify(pin, { ef: KENHOJO_AP_EF.PIN }));

  // Read basic four information
  const response = await card.transmit(
    readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
  );

  return response.data;
}
```

## Error Handling

### Command Construction Errors

```typescript
try {
  const cmd = selectEf("0001234"); // Too long
} catch (error) {
  console.log(error.message); // "Invalid EF identifier."
}

try {
  const cmd = readEfBinaryFull(32); // Out of range
} catch (error) {
  console.log(error.message); // "Invalid short EF identifier."
}
```

### APDU Response Handling

```typescript
const cmd = readEfBinaryFull(0x01);
const response = await card.transmit(cmd);

switch (response.sw) {
  case 0x9000:
    console.log("Success");
    break;
  case 0x6a82:
    console.log("File not found");
    break;
  case 0x6982:
    console.log("Security status not satisfied");
    break;
  case 0x6a86:
    console.log("Incorrect parameters");
    break;
  default:
    console.log(`Unexpected status: ${response.sw.toString(16)}`);
}
```

## Parameter Validation

The utilities perform strict parameter validation:

- **AID length**: 1-16 bytes for `selectDf()`
- **File ID length**: Exactly 2 bytes for `selectEf()`
- **Short EF ID**: 0-31 (5 bits) for `readEfBinaryFull()`
- **PIN length**: 1-16 bytes for `verify()`
- **Offset/Length**: Must fit in APDU constraints

## Dependencies

- [`@aokiapp/jsapdu-interface`](../interface) - CommandApdu class and constants

## Related Packages

- [`@aokiapp/mynacard`](../mynacard) - MynaCard-specific constants and schemas
- [`@aokiapp/jsapdu-pcsc`](../pcsc) - PC/SC platform for command transmission

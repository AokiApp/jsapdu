# @aokiapp/apdu-utils

Ready-to-use APDU commands for smart card operations.

## Installation

```bash
npm install @aokiapp/apdu-utils
```

## Quick Start

```typescript
import { selectDf, readBinary, verify } from '@aokiapp/apdu-utils';

// Select an application
const selectCmd = selectDf([0xA0, 0x00, 0x00, 0x01, 0x51]);

// Read 256 bytes from current file
const readCmd = readBinary(0, 256);

// Verify PIN "1234"
const verifyCmd = verify("1234");
```

## Examples

### SELECT Commands

```typescript
import { select, selectDf, selectEf } from '@aokiapp/apdu-utils';

// Select by AID (Application ID)
const selectApp = selectDf([0xA0, 0x00, 0x00, 0x01, 0x51, 0x43, 0x52, 0x53, 0x00]);

// Select MF (Master File)
const selectMF = selectDf([0x3F, 0x00]);

// Select EF (Elementary File) by ID
const selectFile = selectEf([0x2F, 0x01]);

// Select with custom options (return FCI)
const selectWithFCI = select([0xA0, 0x00, 0x00, 0x01, 0x51], {
  p1: 0x04,  // Select by AID
  p2: 0x00   // Return FCI
});
```

### READ BINARY Commands

```typescript
import { readBinary, readEfBinaryFull, readCurrentEfBinaryFull } from '@aokiapp/apdu-utils';

// Read 100 bytes from offset 0
const read1 = readBinary(0, 100);

// Read from offset 256 (uses extended APDU)
const read2 = readBinary(256, 100);

// Read from specific EF with short ID
const read3 = readBinary(0, 100, { shortEf: 0x01 });

// Read entire current EF (auto-detects size)
const readAll = await readCurrentEfBinaryFull(session);

// Read entire specific EF
const readFile = await readEfBinaryFull([0x2F, 0x01], session);
```

### VERIFY Commands (PIN)

```typescript
import { verify } from '@aokiapp/apdu-utils';

// Verify PIN in current DF
const pin1 = verify("1234");

// Verify PIN with specific reference (P2)
const pin2 = verify("123456", { p2: 0x80 });

// Verify PIN for specific EF
const pin3 = verify("1234", { ef: [0x00, 0x18] });

// Using binary PIN data
const pin4 = verify([0x31, 0x32, 0x33, 0x34]);

// Using hex string
const pin5 = verify("31323334");
```

### Complete Example: Reading Protected File

```typescript
import { selectDf, selectEf, verify, readEfBinaryFull } from '@aokiapp/apdu-utils';

async function readProtectedFile(session) {
  // 1. Select application
  const selectAppResp = await session.transmit(
    selectDf([0xA0, 0x00, 0x00, 0x01, 0x51])
  );
  
  if (!selectAppResp.isSuccess()) {
    throw new Error('Failed to select application');
  }

  // 2. Verify PIN
  const verifyResp = await session.transmit(
    verify("1234")
  );
  
  if (!verifyResp.isSuccess()) {
    throw new Error('PIN verification failed');
  }

  // 3. Read entire file
  const data = await readEfBinaryFull([0x2F, 0x01], session);
  
  return data;
}
```

## API Reference

### select(p1, p2, data, le?)

Creates a low-level SELECT command with full control over parameters.

**Parameters:**
- `p1: number` - Selection control byte (0x00-0xFF)
  - `0x00` = Select MF, DF or EF by file identifier
  - `0x01` = Select child DF
  - `0x02` = Select EF under current DF  
  - `0x03` = Select parent DF
  - `0x04` = Select by DF name (AID)
  - `0x08` = Select from MF
  - `0x09` = Select from current DF
- `p2: number` - File control information (0x00-0xFF)
  - `0x00` = Return FCI template
  - `0x04` = Return FCP template
  - `0x08` = Return FMD template
  - `0x0C` = No response data
- `data: Uint8Array | number[] | string` - File identifier or AID
  - File ID: 2 bytes (e.g., [0x3F, 0x00] for MF)
  - AID: 5-16 bytes (e.g., [0xA0, 0x00, 0x00, 0x01, 0x51])
  - Hex string: "3F00" or "A0000001514352530000"
- `le?: number | null` - Expected response length (0-65536)
  - `null` = No response expected (P2=0x0C)
  - `0` = Maximum response length (256 for standard, 65536 for extended)
  - `1-65536` = Specific response length

**Returns:** `CommandApdu` - Constructed SELECT command

**Throws:** 
- `Error` - When P2=0x0C (no response) but le is specified

**Example APDU:**
```typescript
select(0x04, 0x00, [0xA0, 0x00, 0x00, 0x01, 0x51], 0x00)
// → 00 A4 04 00 05 A0 00 00 01 51 00
```

---

### selectDf(data, fciRequested?)

Selects a Dedicated File (DF) by name or AID.

**Parameters:**
- `data: Uint8Array | number[] | string` - DF name or Application ID (AID)
  - **Length**: 1-16 bytes for valid DF identifier
  - **Format**: Byte array, number array, or hex string
  - **Examples**: 
    - MF: [0x3F, 0x00] or "3F00"
    - JPKI: [0xA0, 0x00, 0x00, 0x01, 0x51] or "A0000001514352530000"
- `fciRequested?: boolean` - Whether to return File Control Information
  - `true` = Return FCI template (P2=0x00, Le=0x00)
  - `false` = No response data (P2=0x0C, no Le) - **default**

**Returns:** `CommandApdu` - SELECT DF command (CLA=0x00, INS=0xA4, P1=0x04)

**Throws:** 
- `Error("Invalid DF identifier.")` - When data length < 1 or > 16 bytes

**Generated P1/P2:**
- P1 = 0x04 (select by DF name)
- P2 = 0x00 (return FCI) if fciRequested=true
- P2 = 0x0C (no response) if fciRequested=false

**Example APDUs:**
```typescript
selectDf([0xA0, 0x00, 0x00, 0x01, 0x51], true)
// → 00 A4 04 00 05 A0 00 00 01 51 00

selectDf([0xA0, 0x00, 0x00, 0x01, 0x51], false)  
// → 00 A4 04 0C 05 A0 00 00 01 51
```

---

### selectEf(data)

Selects an Elementary File (EF) by file identifier.

**Parameters:**
- `data: Uint8Array | number[] | string` - EF file identifier
  - **Length**: Must be exactly 2 bytes
  - **Format**: Byte array, number array, or hex string
  - **Examples**: 
    - [0x2F, 0x01], [0x00, 0x11], "2F01", "0011"

**Returns:** `CommandApdu` - SELECT EF command (CLA=0x00, INS=0xA4, P1=0x02, P2=0x0C)

**Throws:** 
- `Error("Invalid EF identifier.")` - When data length ≠ 2 bytes

**Generated P1/P2:**
- P1 = 0x02 (select EF under current DF)
- P2 = 0x0C (no response data)

**Example APDU:**
```typescript
selectEf([0x2F, 0x01])
// → 00 A4 02 0C 02 2F 01
```

---

### readBinary(offset, length, isExtended?, useMaxLe?, options?)

Creates a READ BINARY command for reading data from the current EF.

**Parameters:**
- `offset: number` - Starting byte offset (0-65535)
  - **Standard APDU**: 0-65535 (encoded in P1P2)
  - **Extended APDU**: 0-65535 (uses extended addressing)
- `length: number` - Number of bytes to read (1-65535)
  - **Standard APDU**: 1-255 bytes maximum
  - **Extended APDU**: 1-65535 bytes maximum  
- `isExtended?: boolean` - Use extended APDU format
  - `false` = Standard APDU (default)
  - `true` = Extended APDU for large reads
- `useMaxLe?: boolean` - Request maximum possible response
  - `false` = Request specific length (default)
  - `true` = Request max (256 for standard, 65536 for extended)
- `options?: object` - Advanced addressing options
  - `isCurrentEF?: boolean` - Force P2=0x00 (current EF addressing)
  - `shortEfId?: number` - Use short EF identifier (0-31)
  - `useRelativeAddress15Bit?: boolean` - 15-bit relative addressing
  - `useRelativeAddress8Bit?: boolean` - 8-bit relative addressing

**Returns:** `CommandApdu` - READ BINARY command (CLA=0x00, INS=0xB0)

**Throws:**
- `Error` - When offset or length exceeds APDU limits

**P1/P2 Encoding (Standard Mode):**
- P1 = (offset >> 8) & 0xFF (high byte of offset)
- P2 = offset & 0xFF (low byte of offset)

**P1/P2 Encoding (Short EF Mode):**
- P1 = 0x80 | (shortEfId & 0x1F)
- P2 = 0x00

**Example APDUs:**
```typescript
readBinary(0x0100, 0x50)
// → 00 B0 01 00 50

readBinary(0, 100, false, false, { shortEfId: 0x01 })
// → 00 B0 81 00 64
```

**Response:** Contains requested file data + SW1SW2 status

---

### readCurrentEfBinaryFull()

Creates a READ BINARY command to read the entire currently selected EF.

**Parameters:** None

**Returns:** `CommandApdu` - READ BINARY command requesting maximum data
- Uses P1=0x00, P2=0x00 (current EF, offset 0)
- Uses Le=65536 (extended APDU, read all available data)

**Example APDU:**
```typescript
readCurrentEfBinaryFull()
// → 00 B0 00 00 00 00 00 (extended APDU with Le=65536)
```

**Usage:** Call after selecting an EF to read its complete contents.

---

### readEfBinaryFull(shortEfId)

Creates a READ BINARY command using short EF identifier to read entire file.

**Parameters:**
- `shortEfId: number` - Short EF identifier (0-31)
  - Maps to specific EF within current DF
  - Eliminates need for separate SELECT EF command

**Returns:** `CommandApdu` - READ BINARY with short EF addressing

**Throws:** 
- `Error("Invalid short EF identifier.")` - When shortEfId < 0 or > 31

**P1/P2 Encoding:**
- P1 = 0x80 | shortEfId (bit 7 set + EF ID in bits 4-0)
- P2 = 0x00 (offset 0)
- Le = 65536 (extended APDU, read maximum)

**Example APDU:**
```typescript
readEfBinaryFull(0x01)  
// → 00 B0 81 00 00 00 00 (extended APDU)
```

---

### verify(data, options?)

Creates a VERIFY command for PIN authentication.

**Parameters:**
- `data: string | Uint8Array | number[]` - PIN data (1-16 bytes)
  - **String**: Numeric digits converted to ASCII bytes ("1234" → [0x31, 0x32, 0x33, 0x34])
  - **Uint8Array/number[]**: Raw PIN bytes (pre-formatted)
  - **Length**: 1-16 bytes (card-dependent)
- `options?: object` - PIN verification options
  - `ef?: number | string` - Target EF identifier (0-30)
    - References specific PIN within current DF
    - `undefined` = Use current DF global PIN (default)
  - `isCurrent?: boolean` - Force current DF PIN usage
    - `true` = Use P2=0x80 (current DF)
    - Has no effect if `ef` is specified

**Returns:** `CommandApdu` - VERIFY command (CLA=0x00, INS=0x20, P1=0x00)

**Throws:**
- `Error("Invalid EF identifier.")` - When ef > 30 (0x1E)

**P2 Encoding:**
- `0x80` = Current DF PIN (when ef not specified)
- `0x80 + ef` = Specific EF PIN (when ef specified, range 0x80-0x9E)

**Example APDUs:**
```typescript
verify("1234")
// → 00 20 00 80 04 31 32 33 34

verify("123456", { ef: 0x01 })  
// → 00 20 00 81 06 31 32 33 34 35 36

verify([0x12, 0x34, 0x56, 0x78])
// → 00 20 00 80 04 12 34 56 78
```

**Response Status Words:**
- `9000` = PIN verification successful
- `63CX` = PIN verification failed, X attempts remaining
- `6983` = PIN blocked/authentication method blocked
- `6A86` = Incorrect P1-P2 parameters
- `6A88` = Referenced data not found (invalid PIN reference)

## Input Formats

All functions accept flexible input:
- `Uint8Array` - Direct byte array
- `number[]` - Array of bytes  
- `string` - Hex string (e.g., "A0000001") automatically converted

## Error Handling

Functions validate parameters and throw descriptive errors:

```typescript
try {
  const cmd = selectDf(""); // Empty AID
} catch (error) {
  console.error(error.message); // "Invalid DF identifier."
}

try {
  const cmd = readBinary(70000, 100); // Offset too large
} catch (error) {
  console.error(error.message); // "Offset or length is out of range..."
}
```

## License

MIT
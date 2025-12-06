# Extended APDU Support

The `CommandApdu` class provides comprehensive support for both standard and extended APDU commands, automatically handling the complex encoding rules defined in ISO 7816-4.

## APDU Structure Overview

### Standard APDU Limits
- **Lc (command data)**: 0-255 bytes
- **Le (expected response)**: 0-256 bytes (0x00 = 256)
- **Total command**: ≤ 261 bytes (CLA+INS+P1+P2+Lc+Data+Le)

### Extended APDU Limits
- **Lc**: 0-65535 bytes
- **Le**: 0-65536 bytes (0x0000 = 65536)
- **Total command**: ≤ 65544 bytes

## Automatic Extended APDU Detection

The class automatically switches to extended format when:
```typescript
const isExtended = (this.data && this.data.length > 255) || (this.le && this.le > 256);
```

### Decision Logic
1. **Data length > 255 bytes** → Extended APDU required
2. **Expected response > 256 bytes** → Extended APDU required
3. **Otherwise** → Standard APDU used

## Encoding Formats

### Case 1: Command Only (CLA INS P1 P2)
```typescript
// Standard and Extended: Same encoding
[0x00, 0xA4, 0x04, 0x00]
```

### Case 2: Response Expected (CLA INS P1 P2 Le)

**Standard APDU:**
```typescript
[0x00, 0xB0, 0x00, 0x00, 0xFF]  // Le=255
[0x00, 0xB0, 0x00, 0x00, 0x00]  // Le=256
```

**Extended APDU:**
```typescript
[0x00, 0xB0, 0x00, 0x00, 0x00, 0x01, 0x00]  // Le=256
[0x00, 0xB0, 0x00, 0x00, 0x00, 0x00, 0x00]  // Le=65536
```

### Case 3: Data Only (CLA INS P1 P2 Lc Data)

**Standard APDU:**
```typescript
[0x00, 0xDA, 0x01, 0x01, 0x04, 0x12, 0x34, 0x56, 0x78]  // Lc=4
```

**Extended APDU:**
```typescript
[0x00, 0xDA, 0x01, 0x01, 0x00, 0x01, 0x00, ...data...]  // Lc=256
```

### Case 4: Data + Response (CLA INS P1 P2 Lc Data Le)

**Standard APDU:**
```typescript
[0x00, 0x20, 0x00, 0x80, 0x04, 0x12, 0x34, 0x56, 0x78, 0x00]  // Lc=4, Le=256
```

**Extended APDU:**
```typescript
[0x00, 0x20, 0x00, 0x80, 0x00, 0x01, 0x00, ...data..., 0x01, 0x00]  // Lc=256, Le=256
```

## Implementation Details

### Extended APDU Encoding Logic

```typescript
if (this.data && this.le !== null) {
  if (isExtended) {
    view.setUint8(offset++, 0x00);           // Extended marker
    view.setUint16(offset, this.data.length); // Lc (2 bytes)
    offset += 2;
    new Uint8Array(bodyBuffer).set(this.data, offset);
    offset += this.data.length;
    view.setUint16(offset, this.le);         // Le (2 bytes)
  } else {
    view.setUint8(offset++, this.data.length); // Lc (1 byte)
    new Uint8Array(bodyBuffer).set(this.data, offset);
    offset += this.data.length;
    view.setUint8(offset, this.le);           // Le (1 byte)
  }
}
```

### Parsing Extended APDU

```typescript
const firstIndicator = byteArray[index];
if (firstIndicator !== 0x00) {
  // Standard APDU parsing
  const lc = byteArray[index];
  // ... standard logic
} else {
  // Extended APDU parsing
  index += 1; // Skip 0x00 marker
  const lcOrLe = (byteArray[index] << 8) | byteArray[index + 1];
  // ... extended logic
}
```

## Real-World Usage Examples

### Reading Large Files
```typescript
// Read 4KB file (requires extended APDU for response)
const cmd = new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 4096);
console.log(cmd.toString()); 
// Output: "00B00000000010000" (extended format automatically used)
```

### Sending Large Data
```typescript
// Send 512 bytes (requires extended APDU for command)
const largeData = new Uint8Array(512);
const cmd = new CommandApdu(0x00, 0xDA, 0x01, 0x01, largeData);
console.log(cmd.toString().substring(0, 16)); 
// Output: "00DA010100020000" (extended format with Lc=0x0200)
```

### MynaCard Certificate Reading
```typescript
// Reading large certificate from MynaCard
const selectApp = new CommandApdu(0x00, 0xA4, 0x04, 0x00, JPKI_AP);
const readCert = new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 2048);
// Automatically uses extended APDU for response > 256 bytes
```

## Testing Patterns

### Extended vs Standard Detection
```typescript
describe('Extended APDU detection', () => {
  test('should use extended for large data', () => {
    const largeData = new Uint8Array(300);
    const cmd = new CommandApdu(0x00, 0xDA, 0x01, 0x01, largeData);
    const bytes = cmd.toUint8Array();
    expect(bytes[4]).toBe(0x00); // Extended marker
    expect(bytes[5]).toBe(0x01); // Lc high byte
    expect(bytes[6]).toBe(0x2C); // Lc low byte (300)
  });
  
  test('should use standard for small data', () => {
    const smallData = new Uint8Array(100);
    const cmd = new CommandApdu(0x00, 0xDA, 0x01, 0x01, smallData);
    const bytes = cmd.toUint8Array();
    expect(bytes[4]).toBe(100); // Standard Lc
  });
});
```

## Performance Considerations

- **Memory overhead**: Extended APDUs require 3 extra bytes minimum
- **Parsing cost**: Extended parsing has ~2x complexity due to conditional logic  
- **Network efficiency**: Extended format reduces round-trips for large data
- **Compatibility**: Some legacy readers may not support extended APDUs

## Card Support Matrix

| Card Type | Standard APDU | Extended APDU | Notes |
|-----------|---------------|---------------|--------|
| MynaCard | ✅ | ✅ | Full support |
| ISO 7816-4 | ✅ | ⚠️ | Depends on implementation |
| Legacy cards | ✅ | ❌ | Standard only |
| NFC Type A/B | ✅ | ✅ | Modern NFC chips |
| Contact cards | ✅ | ✅ | Most modern readers |

## Error Handling

```typescript
try {
  const cmd = CommandApdu.fromUint8Array(rawBytes);
} catch (error) {
  if (error.message.includes('Extended APDU structure is invalid')) {
    // Handle malformed extended APDU
  }
}
```

Common parsing errors:
- **Insufficient buffer**: Extended APDU declares Lc but data is truncated
- **Invalid marker**: 0x00 marker present but not followed by valid extended structure
- **Length mismatch**: Declared Lc doesn't match actual data length
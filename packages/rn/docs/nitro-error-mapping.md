# Nitro Error Mapping Strategy

The React Native package uses a sophisticated error mapping system to normalize errors from native Android/iOS platforms into standardized `SmartCardError` codes. This ensures consistent error handling across platforms.

## Architecture Overview

```
Native Platform Error → mapNitroError() → SmartCardError → Application
    ↓                        ↓                ↓
Android Exception      Error Patterns    Normalized Code
iOS NSError           String Matching   + Human Message
```

## Error Mapping Hierarchy

### 1. Pass-through (Highest Priority)
```typescript
if (error instanceof SmartCardError) {
  return error; // Already normalized, return as-is
}
```

### 2. Explicit Code String Mapping
```typescript
if (lowerMessage.includes('not_initialized')) {
  return new SmartCardError('NOT_INITIALIZED', message);
}
```

**Supported Codes:**
- `NOT_INITIALIZED` / `not_initialized`
- `ALREADY_INITIALIZED` / `already_initialized`
- `CARD_NOT_PRESENT` / `card_not_present`
- `TIMEOUT`
- `ALREADY_CONNECTED` / `already_connected`
- `INVALID_PARAMETER` / `invalid_parameter`
- `PROTOCOL_ERROR` / `protocol_error`
- `READER_ERROR` / `reader_error`
- `UNSUPPORTED_OPERATION` / `unsupported_operation`

### 3. Android Exception Pattern Matching
Uses pattern matching against known Android exception types:

```typescript
// TagLostException → PLATFORM_ERROR
if (matchesAnyPattern(lowerMessage, lowerName, ANDROID_ERROR_PATTERNS.TAG_LOST)) {
  return new SmartCardError('PLATFORM_ERROR', 'Card was removed during operation');
}
```

### 4. Fallback (Lowest Priority)
```typescript
return fromUnknownError(error, defaultCode);
```

## Android Exception Patterns

### TagLostException (Card Removal)
**Pattern:** `taglostexception|tag.*lost|card.*removed`
**Mapped to:** `PLATFORM_ERROR`
**Real-world trigger:**
```kotlin
// Android native code
try {
    isoDep.transceive(apduBytes)
} catch (e: TagLostException) {
    throw RuntimeException("TagLostException: Card removed")
}
```

### IOException (Communication Failure)
**Pattern:** `ioexception|i\/o.*error|communication.*failed`
**Mapped to:** `PLATFORM_ERROR`
**Common causes:**
- NFC signal interference
- Card moved during communication
- Reader hardware issues

### SecurityException (Permission Denied)
**Pattern:** `securityexception|permission.*denied|security.*error`
**Mapped to:** `PLATFORM_ERROR`
**Triggers:**
```xml
<!-- Missing in AndroidManifest.xml -->
<uses-permission android:name="android.permission.NFC" />
```

### IllegalStateException (Invalid State)
**Pattern:** `illegalstateexception|illegal.*state|invalid.*state`
**Mapped to:** `PLATFORM_ERROR`
**Example:** Calling `transceive()` on disconnected NFC tag

### IllegalArgumentException (Bad Parameters)
**Pattern:** `illegalargumentexception|illegal.*argument|invalid.*argument`
**Mapped to:** `INVALID_PARAMETER`
**Example:** Passing null APDU bytes to `transceive()`

## Real-World Error Scenarios

### Card Removal During Transaction
```typescript
// Native layer throws TagLostException
// Mapped to: SmartCardError('PLATFORM_ERROR', 'Card was removed during operation')

try {
  const response = await card.transmit(apdu);
} catch (error) {
  if (error.code === 'PLATFORM_ERROR' && error.message.includes('removed')) {
    // Handle card removal gracefully
    showMessage('Please keep card near phone during transaction');
  }
}
```

### NFC Disabled
```typescript
// Native: "NFC is disabled"
// Mapped to: SmartCardError('PLATFORM_ERROR', 'NFC is disabled on this device')

if (error.code === 'PLATFORM_ERROR' && error.message.includes('disabled')) {
  // Guide user to enable NFC
  showNFCEnableDialog();
}
```

### Invalid APDU Format
```typescript
// Native: IllegalArgumentException("APDU must not be null")
// Mapped to: SmartCardError('INVALID_PARAMETER', 'Invalid argument: APDU must not be null')

if (error.code === 'INVALID_PARAMETER') {
  // Developer error - fix APDU construction
  console.error('Fix APDU construction:', error.message);
}
```

## Pattern Matching Implementation

### Pattern Structure
```typescript
interface ErrorPattern {
  TAG_LOST: string[];
  IO_ERROR: string[];
  SECURITY: string[];
  // ... more patterns
}
```

### Matching Logic
```typescript
function matchesAnyPattern(
  message: string,
  name: string, 
  patterns: string[]
): boolean {
  return patterns.some(pattern => 
    message.includes(pattern) || name.includes(pattern)
  );
}
```

### Case Sensitivity
All matching is **case-insensitive**:
```typescript
const lowerMessage = message.toLowerCase();
const lowerName = errorName.toLowerCase();
```

## Testing Error Mapping

### Unit Test Patterns
```typescript
describe('mapNitroError', () => {
  test('should map TagLostException to PLATFORM_ERROR', () => {
    const error = new Error('TagLostException: Card removed');
    error.name = 'TagLostException';
    
    const mapped = mapNitroError(error);
    
    expect(mapped.code).toBe('PLATFORM_ERROR');
    expect(mapped.message).toBe('Card was removed during operation');
  });
  
  test('should preserve SmartCardError instances', () => {
    const original = new SmartCardError('TIMEOUT', 'Custom timeout');
    const mapped = mapNitroError(original);
    
    expect(mapped).toBe(original); // Same instance
  });
});
```

### Mock Native Errors
```typescript
// Simulate Android TagLostException
const mockTagLost = () => {
  const error = new Error('android.nfc.TagLostException: Tag was lost.');
  error.name = 'TagLostException';
  return error;
};

// Simulate iOS CoreNFC error  
const mockIOSError = () => {
  const error = new Error('NFCReaderError Code=202');
  error.name = 'NFCReaderError';
  return error;
};
```

## Performance Considerations

### Pattern Matching Efficiency
- **O(n)** complexity where n = number of patterns
- **Short-circuit evaluation**: Stops at first match
- **Pre-lowercase**: Message conversion done once

### Memory Usage
- **No regex compilation**: Uses simple string matching
- **Constant patterns**: Error patterns are static arrays
- **Single allocation**: Creates one SmartCardError per call

## Error Message Enhancement

### Message Standardization
```typescript
// Before: "TagLostException"
// After:  "Card was removed during operation"

// Before: "IOException: I/O error"  
// After:  "NFC I/O error: I/O error"

// Before: "SecurityException: Permission denied"
// After:  "NFC permission denied or security error"
```

### Preserving Original Context
```typescript
return new SmartCardError('PLATFORM_ERROR', `ISO-DEP error: ${message}`);
//                                            ↑
//                                    Context prefix added
```

## Future Enhancements

### Table-Driven Mapping
```typescript
const ERROR_MAPPING_TABLE = [
  {
    patterns: ['taglost', 'tag.*lost'],
    code: 'PLATFORM_ERROR',
    messageTemplate: 'Card was removed during operation'
  },
  // ... more entries
];
```

### Platform-Specific Mappings
```typescript
const IOS_ERROR_PATTERNS = {
  NFC_READER_ERROR: ['nfcreadererror', 'reader.*session.*invalid']
};

const ANDROID_ERROR_PATTERNS = {
  TAG_LOST: ['taglostexception', 'tag.*lost']
};
```

This would allow platform-specific error handling while maintaining the same interface.
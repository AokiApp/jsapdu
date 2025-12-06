# @aokiapp/jsapdu-interface

Core TypeScript definitions for smart card communication.

## Installation

```bash
npm install @aokiapp/jsapdu-interface
```

## Quick Start

```typescript
import { CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';

// Create an APDU command
const cmd = new CommandApdu(0x00, 0xA4, 0x04, 0x00, [0xA0, 0x00, 0x00, 0x01, 0x51]);

// Parse a response
const resp = ResponseApdu.fromUint8Array([0x90, 0x00]);
console.log(resp.sw === 0x9000); // true - success
```

## Examples

### Working with APDU Commands

```typescript
import { CommandApdu } from '@aokiapp/jsapdu-interface';

// SELECT command
const select = new CommandApdu(0x00, 0xA4, 0x04, 0x00, [0xA0, 0x00, 0x00, 0x01, 0x51]);

// READ BINARY command  
const read = new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 256);

// VERIFY PIN command
const verify = new CommandApdu(0x00, 0x20, 0x00, 0x80, [0x31, 0x32, 0x33, 0x34]);

// Convert to bytes for transmission
const bytes = select.toUint8Array();
```

### Handling Responses

```typescript
import { ResponseApdu } from '@aokiapp/jsapdu-interface';

// Parse response bytes
const response = ResponseApdu.fromUint8Array([0x6F, 0x15, 0x84, 0x09, 0xA0, 0x00, 0x00, 0x01, 0x51, 0x43, 0x52, 0x53, 0x00, 0x90, 0x00]);

// Check status
if (response.sw === 0x9000) {
  // Success - get data without status bytes
  const data = response.data;
  console.log('Response data:', data);
} else if (response.sw1 === 0x63) {
  console.log('PIN verification failed, attempts remaining:', response.sw2 & 0x0F);
}
```

### Implementing a Platform

```typescript
import { SmartCardPlatform, SmartCardDevice, SmartCard } from '@aokiapp/jsapdu-interface';

class MyPlatform extends SmartCardPlatform {
  async init(): Promise<void> {
    // Initialize your platform
    this.emit('PLATFORM_INITIALIZED', {});
  }

  async getDeviceInfo(): Promise<DeviceInfo[]> {
    // Return available devices
    return [{
      id: 'device-1',
      friendlyName: 'My Reader',
      supportsApdu: true,
      supportsHce: false,
      isIntegratedDevice: false,
      isRemovableDevice: true,
      d2cProtocol: 'iso7816',
      p2dProtocol: 'usb',
      apduApi: ['pcsc']
    }];
  }

  async acquireDevice(deviceId: string): Promise<SmartCardDevice> {
    // Return your device implementation
    return new MyDevice(deviceId);
  }
}
```

## API Reference

### CommandApdu

Creates APDU commands for smart card communication with automatic standard/extended APDU detection.

#### Constructor
```typescript
new CommandApdu(cla: number, ins: number, p1: number, p2: number, data?: Uint8Array | null, le?: number | null)
```

**Parameters:**
- `cla: number` - Class byte (0x00-0xFF)
  - `0x00` = ISO 7816-4 standard class
  - `0x80-0xFF` = Proprietary classes  
  - `0x10-0x7F` = Reserved for future use
- `ins: number` - Instruction byte (0x00-0xFF)
  - `0xA4` = SELECT file
  - `0xB0` = READ BINARY
  - `0x20` = VERIFY PIN
  - See ISO 7816-4 for standard instructions
- `p1: number` - Parameter 1 (0x00-0xFF) - instruction-specific
- `p2: number` - Parameter 2 (0x00-0xFF) - instruction-specific  
- `data?: Uint8Array | null` - Command data payload
  - `null` = No data (Case 1/2 APDU)
  - `1-255 bytes` = Standard APDU data
  - `256-65535 bytes` = Extended APDU data (automatic)
- `le?: number | null` - Expected response length
  - `null` = No response expected (Case 1/3 APDU)
  - `0` = Maximum response (256 for standard, 65536 for extended)
  - `1-65536` = Specific response length expected

**Returns:** `CommandApdu` instance

**Throws:**
- `RangeError` - When CLA, INS, P1, or P2 values are not 0x00-0xFF
- `TypeError` - When parameters are not numbers

#### Methods

##### `toUint8Array(): Uint8Array`
Serializes the command to byte array for transmission.

**Returns:** `Uint8Array` - Complete APDU command bytes
- Automatically uses extended APDU format when data > 255 bytes or le > 256
- Follows ISO 7816-4 APDU structure exactly

**Example:**
```typescript
const cmd = new CommandApdu(0x00, 0xA4, 0x04, 0x00, [0xA0, 0x00, 0x00, 0x01, 0x51]);
const bytes = cmd.toUint8Array();
// → [0x00, 0xA4, 0x04, 0x00, 0x05, 0xA0, 0x00, 0x00, 0x01, 0x51]
```

##### `toHexString(): string`
Converts command to uppercase hexadecimal string representation.

**Returns:** `string` - Hex representation (e.g., "00A4040005A0000001514352530000")

##### `toString(): string`
Alias for `toHexString()` - returns hex string representation.

#### Static Methods

##### `CommandApdu.fromUint8Array(byteArray: Uint8Array): CommandApdu`
Parses byte array into CommandApdu instance with automatic standard/extended detection.

**Parameters:**
- `byteArray: Uint8Array` - Raw APDU command bytes (minimum 4 bytes)

**Returns:** `CommandApdu` - Parsed command instance

**Throws:**
- `TypeError` - When input is not Uint8Array
- `RangeError` - When input < 4 bytes or has invalid APDU structure
- `RangeError` - When extended APDU structure is malformed

**Supported APDU Cases:**
- Case 1: CLA INS P1 P2 (4 bytes)
- Case 2: CLA INS P1 P2 Le (5 bytes)  
- Case 3: CLA INS P1 P2 Lc Data (5+ bytes)
- Case 4: CLA INS P1 P2 Lc Data Le (6+ bytes)
- Extended cases with 0x00 marker and 2-byte length fields

---

### ResponseApdu

Parses APDU responses from smart cards with automatic status word extraction.

#### Constructor
```typescript
new ResponseApdu(data: Uint8Array, sw1: number, sw2: number)
```

**Parameters:**
- `data: Uint8Array` - Response data (without status words)
- `sw1: number` - Status word 1 (0x00-0xFF)  
- `sw2: number` - Status word 2 (0x00-0xFF)

#### Properties

##### `data: Uint8Array` (readonly)
Response data bytes without the trailing SW1SW2 status words.

**Usage:** Contains the actual response payload from the card.

##### `sw1: number` (readonly)  
First status word byte (0x00-0xFF).

**Common Values:**
- `0x90` = Success (when SW2=0x00)
- `0x61` = More data available (SW2 = remaining bytes)
- `0x63` = Authentication failed (SW2 = remaining attempts)
- `0x67` = Wrong length (Lc or Le incorrect)
- `0x6A` = File/record not found or parameters incorrect
- `0x6E` = Class not supported
- `0x6F` = No precise diagnosis

##### `sw2: number` (readonly)
Second status word byte (0x00-0xFF).

**Usage:** Provides additional status information, meaning depends on SW1.

##### `sw: number` (readonly, computed)
Combined 16-bit status word (sw1 << 8 | sw2).

**Common Values:**
- `0x9000` = Success  
- `0x6283` = Selected file invalidated
- `0x6300` = Authentication failed (no attempts remaining)
- `0x6700` = Wrong length
- `0x6982` = Security status not satisfied
- `0x6A82` = File not found
- `0x6A86` = Incorrect parameters P1-P2

#### Methods

##### `arrayBuffer(): ArrayBuffer`
Returns the response data as ArrayBuffer for compatibility with crypto APIs.

**Returns:** `ArrayBuffer` - Response data buffer

**Usage:** 
```typescript
const response = ResponseApdu.fromUint8Array([0x01, 0x02, 0x03, 0x90, 0x00]);
const buffer = response.arrayBuffer(); // Contains [0x01, 0x02, 0x03]
```

##### `toUint8Array(): Uint8Array`
Reconstructs the complete response including status words.

**Returns:** `Uint8Array` - Complete response (data + SW1 + SW2)

#### Static Methods

##### `ResponseApdu.fromUint8Array(byteArray: Uint8Array): ResponseApdu`
Parses raw response bytes into ResponseApdu instance.

**Parameters:**
- `byteArray: Uint8Array` - Complete response including SW1SW2 (minimum 2 bytes)

**Returns:** `ResponseApdu` - Parsed response instance

**Throws:**
- `TypeError` - When input is not Uint8Array
- `RangeError` - When input < 2 bytes

**Example:**
```typescript
const raw = new Uint8Array([0x6F, 0x15, 0x84, 0x09, 0xA0, 0x00, 0x00, 0x01, 0x51, 0x90, 0x00]);
const response = ResponseApdu.fromUint8Array(raw);
// response.data → [0x6F, 0x15, 0x84, 0x09, 0xA0, 0x00, 0x00, 0x01, 0x51]  
// response.sw1 → 0x90
// response.sw2 → 0x00
// response.sw → 0x9000
```

---

### SmartCardPlatform

Abstract base class for smart card platform implementations (PC/SC, NFC, etc.).

#### Methods

##### `abstract init(force?: boolean): Promise<void>`
Initialize the platform and prepare for device operations.

**Parameters:**
- `force?: boolean` - Force initialization even if already initialized

**Throws:**
- `SmartCardError("ALREADY_INITIALIZED")` - Platform already initialized
- `SmartCardError("PLATFORM_ERROR")` - Initialization failed

**Events Emitted:**
- `PLATFORM_INITIALIZED` - Platform ready for use

##### `abstract release(force?: boolean): Promise<void>`
Release platform resources and acquired devices.

**Parameters:**
- `force?: boolean` - Force release even if devices are active

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized
- `SmartCardError("PLATFORM_ERROR")` - Release failed

**Events Emitted:**
- `PLATFORM_RELEASED` - Platform resources released

##### `isInitialized(): boolean`
Check if platform is currently initialized.

**Returns:** `boolean` - True if initialized, false otherwise

##### `abstract getDeviceInfo(): Promise<SmartCardDeviceInfo[]>`
List available smart card devices.

**Returns:** `Promise<SmartCardDeviceInfo[]>` - Array of device information

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized
- `SmartCardError("NO_READERS")` - No devices available

##### `abstract acquireDevice(deviceId: string): Promise<SmartCardDevice>`
Acquire exclusive access to a specific device.

**Parameters:**
- `deviceId: string` - Unique device identifier from `getDeviceInfo()`

**Returns:** `Promise<SmartCardDevice>` - Device instance for further operations

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized
- `SmartCardError("READER_ERROR")` - Device not found or unavailable
- `SmartCardError("ALREADY_CONNECTED")` - Device already acquired

**Events Emitted:**
- `DEVICE_ACQUIRED` - Device successfully acquired

##### `on<K>(event: K, callback: Events[K]): () => void`
Subscribe to platform events.

**Parameters:**
- `event: string` - Event name
- `callback: function` - Event handler function

**Returns:** `() => void` - Unsubscribe function

**Available Events:**
- `PLATFORM_INITIALIZED` - Platform ready
- `PLATFORM_RELEASED` - Platform shutdown  
- `DEVICE_ACQUIRED` - Device acquired
- `DEBUG_INFO` - Debug information

---

### SmartCardDevice

Abstract base class for smart card reader device implementations.

#### Methods

##### `abstract getDeviceInfo(): SmartCardDeviceInfo`
Get device information and capabilities.

**Returns:** `SmartCardDeviceInfo` - Device details and supported features

##### `abstract isSessionActive(): boolean`
Check if a card session is currently active.

**Returns:** `boolean` - True if session active, false otherwise

##### `abstract isDeviceAvailable(): Promise<boolean>`  
Check if device is available for operations.

**Returns:** `Promise<boolean>` - True if device accessible

**Usage:** Can be called regardless of card presence or session state.

##### `abstract isCardPresent(): Promise<boolean>`
Check if a smart card is currently inserted/detected.

**Returns:** `Promise<boolean>` - True if card detected

**Throws:**
- `SmartCardError("READER_ERROR")` - Device communication failed

##### `abstract waitForCardPresence(timeout: number): Promise<void>`
Block until a card is detected or timeout occurs.

**Parameters:**  
- `timeout: number` - Maximum wait time in milliseconds

**Throws:**
- `SmartCardError("TIMEOUT")` - No card detected within timeout
- `SmartCardError("READER_ERROR")` - Device error during wait

**Events Emitted:**
- `CARD_FOUND` - Card detected
- `WAIT_TIMEOUT` - Timeout reached

##### `abstract startSession(): Promise<SmartCard>`
Begin communication session with the detected card.

**Returns:** `Promise<SmartCard>` - Active card session for APDU exchange

**Throws:**
- `SmartCardError("CARD_NOT_PRESENT")` - No card detected
- `SmartCardError("ALREADY_CONNECTED")` - Session already active
- `SmartCardError("PROTOCOL_ERROR")` - Card communication setup failed

**Events Emitted:**
- `CARD_SESSION_STARTED` - Session established

##### `abstract release(): Promise<void>`
Release device and end any active card session.

**Throws:**
- `SmartCardError("PLATFORM_ERROR")` - Release failed

**Events Emitted:**
- `DEVICE_RELEASED` - Device released

---

### SmartCard

Abstract base class for active smart card communication sessions.

#### Methods

##### `abstract getAtr(): Promise<Uint8Array>`
Get Answer To Reset (ATR) or Answer To Select (ATS) from the card.

**Returns:** `Promise<Uint8Array>` - Card identification and capability data

**Throws:**
- `SmartCardError("TRANSMISSION_ERROR")` - Communication failed
- `SmartCardError("CARD_NOT_PRESENT")` - Card removed during operation

##### `abstract transmit(apdu: CommandApdu): Promise<ResponseApdu>`
Send APDU command and receive structured response.

**Parameters:**
- `apdu: CommandApdu` - Structured APDU command

**Returns:** `Promise<ResponseApdu>` - Parsed response with status words

**Throws:**
- `SmartCardError("TRANSMISSION_ERROR")` - Communication failed
- `SmartCardError("PROTOCOL_ERROR")` - Invalid APDU or protocol error
- `ValidationError` - Malformed command
- `SmartCardError("CARD_NOT_PRESENT")` - Card removed during transmission

**Events Emitted:**
- `APDU_SENT` - Command transmitted successfully
- `APDU_FAILED` - Command transmission failed

##### `abstract transmit(apdu: Uint8Array): Promise<Uint8Array>`  
Send raw bytes and receive raw response.

**Parameters:**
- `apdu: Uint8Array` - Raw command bytes

**Returns:** `Promise<Uint8Array>` - Raw response bytes including status

**Usage:** For non-APDU protocols or custom command formats.

##### `abstract reset(): Promise<void>`
Perform card reset (warm reset).

**Throws:**
- `SmartCardError("TRANSMISSION_ERROR")` - Reset failed
- `SmartCardError("CARD_NOT_PRESENT")` - Card not available

**Events Emitted:**
- `CARD_SESSION_RESET` - Card reset completed

##### `abstract release(): Promise<void>`  
End the card session and release resources.

**Throws:**
- `SmartCardError("PLATFORM_ERROR")` - Release failed

## Error Handling

All methods throw `SmartCardError` with specific error codes:

```typescript
import { SmartCardError } from '@aokiapp/jsapdu-interface';

try {
  await platform.init();
} catch (error) {
  if (error instanceof SmartCardError) {
    switch (error.code) {
      case 'ALREADY_INITIALIZED':
        console.log('Platform already initialized');
        break;
      case 'PLATFORM_ERROR':  
        console.error('Platform initialization failed:', error.message);
        break;
      default:
        console.error('Unexpected error:', error.code);
    }
  }
}
```

**Common Error Codes:**
- `NOT_INITIALIZED` - Platform not initialized
- `ALREADY_INITIALIZED` - Platform already initialized  
- `CARD_NOT_PRESENT` - No card detected
- `ALREADY_CONNECTED` - Device/session already active
- `TIMEOUT` - Operation timed out
- `TRANSMISSION_ERROR` - Communication failed
- `PROTOCOL_ERROR` - Protocol violation
- `READER_ERROR` - Device malfunction
- `PLATFORM_ERROR` - Platform-specific error

## Resource Management

All classes support automatic resource cleanup:

```typescript
// Using await using (ES2022)
await using platform = manager.getPlatform();
await platform.init();

await using device = await platform.acquireDevice('reader-id');
await using session = await device.startSession();

// Resources automatically released when scope ends
```

Or manual cleanup:

```typescript
let platform, device, session;
try {
  platform = manager.getPlatform();
  await platform.init();
  
  device = await platform.acquireDevice('reader-id');
  session = await device.startSession();
  
  // Use session...
  
} finally {
  await session?.release();
  await device?.release();  
  await platform?.release();
}
```

## License

MIT
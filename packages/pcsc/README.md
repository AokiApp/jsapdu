# @aokiapp/jsapdu-pcsc

PC/SC smart card reader support for Node.js.

## Installation

```bash
npm install @aokiapp/jsapdu-pcsc
```

## Prerequisites

- Windows: Built-in WinSCard support
- macOS: Built-in SmartCard services
- Linux: Install `pcscd` and `libpcsclite-dev`
  ```bash
  sudo apt-get install pcscd libpcsclite-dev  # Debian/Ubuntu
  sudo yum install pcsc-lite pcsc-lite-devel   # RHEL/CentOS
  ```

## Quick Start

```typescript
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';

// Get the platform instance
const platform = PcscPlatformManager.getInstance().getPlatform();

// Initialize and use
await platform.init();
const devices = await platform.getDeviceInfo();
const device = await platform.acquireDevice(devices[0].id);
const session = await device.startSession();

// Send APDU
const response = await session.transmit([0x00, 0xA4, 0x04, 0x00]);
console.log('Response:', response);

// Cleanup
await session.release();
await device.release();
await platform.release();
```

## Examples

### List Available Readers

```typescript
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';

async function listReaders() {
  const platform = PcscPlatformManager.getInstance().getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  
  for (const device of devices) {
    console.log(`Reader: ${device.name}`);
    console.log(`  Type: ${device.isContactless ? 'Contactless' : 'Contact'}`);
    console.log(`  Card present: ${device.isCardPresent}`);
  }
  
  await platform.release();
}
```

### Wait for Card and Read ATR

```typescript
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';

async function waitAndReadATR() {
  const platform = PcscPlatformManager.getInstance().getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  if (devices.length === 0) {
    throw new Error('No readers found');
  }
  
  const device = await platform.acquireDevice(devices[0].id);
  
  console.log('Waiting for card...');
  await device.waitForCardPresence(30000); // 30 second timeout
  
  const session = await device.startSession();
  const atr = await session.getAtr();
  
  console.log('ATR:', Array.from(atr).map(b => 
    b.toString(16).padStart(2, '0')
  ).join(' '));
  
  await session.release();
  await device.release();
  await platform.release();
}
```

### Send APDU Commands

```typescript
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import { CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';

async function sendCommands() {
  const platform = PcscPlatformManager.getInstance().getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  const device = await platform.acquireDevice(devices[0].id);
  const session = await device.startSession();
  
  // Using CommandApdu class
  const selectCmd = new CommandApdu(0x00, 0xA4, 0x04, 0x00, 
    [0xA0, 0x00, 0x00, 0x01, 0x51]
  );
  const response1 = await session.transmit(selectCmd);
  console.log('Select response:', response1.isSuccess());
  
  // Using raw bytes
  const readCmd = new Uint8Array([0x00, 0xB0, 0x00, 0x00, 0x10]);
  const response2 = await session.transmit(readCmd);
  console.log('Read response:', response2);
  
  await session.release();
  await device.release();
  await platform.release();
}
```

### Handle Multiple Readers

```typescript
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';

async function useMultipleReaders() {
  const platform = PcscPlatformManager.getInstance().getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  
  // Connect to all readers with cards
  const sessions = [];
  
  for (const deviceInfo of devices) {
    if (deviceInfo.isCardPresent) {
      const device = await platform.acquireDevice(deviceInfo.id);
      const session = await device.startSession();
      sessions.push({
        name: deviceInfo.name,
        session
      });
    }
  }
  
  // Read ATR from all cards
  for (const { name, session } of sessions) {
    const atr = await session.getAtr();
    console.log(`${name}: ATR = ${atr.toString('hex')}`);
  }
  
  // Cleanup
  for (const { session } of sessions) {
    await session.release();
  }
  await platform.release();
}
```

### Complete Transaction Example

```typescript
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import { selectDf, verify, readBinary } from '@aokiapp/apdu-utils';

async function performTransaction() {
  const platform = PcscPlatformManager.getInstance().getPlatform();
  
  try {
    await platform.init();
    const devices = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(devices[0].id);
    
    // Wait for card if not present
    if (!devices[0].isCardPresent) {
      console.log('Please insert card...');
      await device.waitForCardPresence();
    }
    
    const session = await device.startSession();
    
    try {
      // Select application
      const selectResp = await session.transmit(
        selectDf([0xA0, 0x00, 0x00, 0x01, 0x51])
      );
      
      if (!selectResp.isSuccess()) {
        throw new Error('Failed to select application');
      }
      
      // Verify PIN
      const verifyResp = await session.transmit(verify("1234"));
      
      if (!verifyResp.isSuccess()) {
        throw new Error('PIN verification failed');
      }
      
      // Read data
      const dataResp = await session.transmit(readBinary(0, 256));
      
      if (dataResp.isSuccess()) {
        console.log('Data:', dataResp.data);
      }
      
    } finally {
      await session.release();
    }
    
  } finally {
    await platform.release();
  }
}
```

## API Reference

### PcscPlatformManager

Singleton manager for the PC/SC platform.

#### `static getInstance(): PcscPlatformManager`
Returns the global singleton instance of the PC/SC platform manager.

**Returns:** `PcscPlatformManager` - Singleton instance

#### `getPlatform(): PcscPlatform`
Returns the PC/SC platform instance for smart card operations.

**Returns:** `PcscPlatform` - Platform instance

---

### PcscPlatform

Main platform interface for PC/SC operations. Extends `SmartCardPlatform`.

#### `async init(force?: boolean): Promise<void>`
Initializes the PC/SC context using `SCardEstablishContext`.

**Parameters:**
- `force?: boolean` - Skip initialization check if true (default: false)

**Throws:**
- `SmartCardError("ALREADY_INITIALIZED")` - Platform already initialized (when force=false)
- `SmartCardError("PLATFORM_ERROR")` - PC/SC context establishment failed

**Events Emitted:**
- `PLATFORM_INITIALIZED` - After successful initialization

#### `async release(force?: boolean): Promise<void>`
Releases the PC/SC context and all acquired devices using `SCardReleaseContext`.

**Parameters:**
- `force?: boolean` - Skip precondition checks if true (default: false)

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized (when force=false)
- `SmartCardError("PLATFORM_ERROR")` - Failed to release devices or context

**Events Emitted:**
- `PLATFORM_RELEASED` - After successful release

**Behavior:**
- Releases all acquired devices first
- Releases PC/SC context even if device release fails
- Sets `initialized` to false regardless of errors

#### `async getDeviceInfo(): Promise<PcscDeviceInfo[]>`
Lists all available PC/SC readers using `SCardListReaders`.

**Returns:** `Promise<PcscDeviceInfo[]>` - Array of reader information
- Each element contains: id, friendlyName, d2cProtocol, p2dProtocol, etc.
- Empty array if no readers connected

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized
- `SmartCardError("PLATFORM_ERROR")` - Failed to list readers

#### `async acquireDevice(deviceId: string): Promise<PcscDevice>`
Acquires exclusive access to a specific PC/SC reader.

**Parameters:**
- `deviceId: string` - Reader name from `getDeviceInfo()` (e.g., "ACS ACR122U 00 00")

**Returns:** `Promise<PcscDevice>` - Device instance for card operations

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized
- `SmartCardError("READER_ERROR")` - Reader not found
- `SmartCardError("ALREADY_CONNECTED")` - Device already acquired or in use by another process
- `SmartCardError("PLATFORM_ERROR")` - PC/SC connection failed

**Events Emitted:**
- `DEVICE_ACQUIRED` - After successful acquisition

**Behavior:**
- Tests reader connectivity with `SCardConnect`
- Immediately disconnects test connection
- Tracks acquired devices to prevent double acquisition

---

### PcscDevice

Represents a PC/SC smart card reader. Extends `SmartCardDevice`.

#### `getDeviceInfo(): PcscDeviceInfo`
Returns device information for this reader.

**Returns:** `PcscDeviceInfo` - Device capabilities and status

#### `isSessionActive(): boolean`
Checks if a card session is currently active.

**Returns:** `boolean` - True if session active, false otherwise

#### `async isDeviceAvailable(): Promise<boolean>`
Checks if the reader is accessible (independent of card presence).

**Returns:** `Promise<boolean>` - True if reader available

**Throws:** Never throws - returns false on errors

#### `async isCardPresent(): Promise<boolean>`
Checks if a smart card is currently inserted/detected.

**Returns:** `Promise<boolean>` - True if card detected, false otherwise

**Throws:**
- `SmartCardError` - On reader communication failure (rare)

**Implementation:** Uses `SCardGetStatusChange` with zero timeout for instant check

#### `async waitForCardPresence(timeout: number): Promise<void>`
Blocks until a card is detected or timeout occurs.

**Parameters:**
- `timeout: number` - Maximum wait time in milliseconds

**Throws:**
- `SmartCardError("TIMEOUT")` - No card detected within timeout period
- `SmartCardError("READER_ERROR")` - Reader communication failed

**Events Emitted:**
- `CARD_FOUND` - When card detected
- `WAIT_TIMEOUT` - When timeout reached

**Implementation:** Polls every 300ms using `isCardPresent()`

#### `async startSession(): Promise<PcscCard>`
Begins card communication session using `SCardConnect`.

**Returns:** `Promise<PcscCard>` - Active card session

**Throws:**
- `SmartCardError("CARD_NOT_PRESENT")` - No card in reader
- `SmartCardError("ALREADY_CONNECTED")` - Session already active
- `SmartCardError("PLATFORM_ERROR")` - Connection failed

**Events Emitted:**
- `CARD_SESSION_STARTED` - After successful session start

**Behavior:**
- Reuses existing connection if already established
- Negotiates T=0 or T=1 protocol automatically
- Thread-safe using internal mutex

#### `async release(): Promise<void>`
Releases the device and ends any active card session.

**Throws:**
- `SmartCardError("PLATFORM_ERROR")` - Release failed

**Events Emitted:**
- `DEVICE_RELEASED` - After successful release

**Behavior:**
- Releases card session first if active
- Disconnects from card using `SCardDisconnect`
- Calls onReleaseCallback to remove from platform's device map

---

### PcscCard

Active card session for APDU communication. Extends `SmartCard`.

#### `async getAtr(): Promise<Uint8Array>`
Retrieves the Answer To Reset (ATR) from the card.

**Returns:** `Promise<Uint8Array>` - ATR bytes (typically 2-33 bytes)
- Cached after first call for performance

**Throws:**
- `SmartCardError("TRANSMISSION_ERROR")` - Failed to read ATR
- `SmartCardError("CARD_NOT_PRESENT")` - Card removed

**Implementation:** Uses `SCardStatus` to query card state and ATR

#### `async transmit(apdu: CommandApdu): Promise<ResponseApdu>`
Sends structured APDU command and receives parsed response.

**Parameters:**
- `apdu: CommandApdu` - Structured command with CLA, INS, P1, P2, data, Le

**Returns:** `Promise<ResponseApdu>` - Parsed response with data and status words

**Throws:**
- `SmartCardError("NOT_CONNECTED")` - Session not active
- `SmartCardError("TRANSMISSION_ERROR")` - PC/SC transmission failed
- `SmartCardError("CARD_NOT_PRESENT")` - Card removed during transmission

**Events Emitted:**
- `APDU_SENT` - After successful transmission
- `APDU_FAILED` - On transmission error

**Implementation:**
- Automatically selects T=0 or T=1 protocol
- Allocates response buffer based on Le field
- Uses `SCardTransmit` for actual communication

#### `async transmit(apdu: Uint8Array): Promise<Uint8Array>`
Sends raw byte frame and receives raw response.

**Parameters:**
- `apdu: Uint8Array` - Raw command bytes

**Returns:** `Promise<Uint8Array>` - Raw response bytes including SW1SW2

**Usage:** For non-APDU protocols or raw frame transmission

#### `async reset(): Promise<void>`
Performs warm reset on the card using `SCardEndTransaction`.

**Throws:**
- `SmartCardError("NOT_CONNECTED")` - Session not active
- `SmartCardError("TRANSMISSION_ERROR")` - Reset failed

**Events Emitted:**
- `CARD_SESSION_RESET` - After successful reset

**Behavior:**
- Clears cached ATR (may change after reset)
- Card remains connected after reset

#### `async release(): Promise<void>`
Ends the card session and marks it inactive.

**Throws:** Never throws

**Events Emitted:**
- Card event listeners are notified via parent device

**Behavior:**
- Does not disconnect from card (handled by device.release())
- Sets session to inactive state
- Safe to call multiple times

---

### PcscDeviceInfo

Reader information and capabilities. Extends `SmartCardDeviceInfo`.

**Properties:**
- `id: string` - Reader name (e.g., "ACS ACR122U 00 00")
  - Used as unique identifier and for `SCardConnect`
- `friendlyName: string` - Display name (same as id for PC/SC)
- `description: string` - Reader description
- `supportsApdu: boolean` - Always true for PC/SC readers
- `isIntegratedDevice: boolean` - Always false (PC/SC readers are external)
- `isRemovableDevice: boolean` - Always true
- `d2cProtocol: string` - "iso7816" or "nfc" (detected from reader name)
- `p2dProtocol: string` - "usb" (standard PC/SC readers)
- `apduApi: string[]` - ["pcsc"] (PC/SC API identifier)

## Error Handling

```typescript
import { SmartCardError } from '@aokiapp/jsapdu-interface';

try {
  await session.transmit(apdu);
} catch (error) {
  if (error instanceof SmartCardError) {
    console.error('Smart card error:', error.code, error.message);
    
    switch (error.code) {
      case 'CARD_REMOVED':
        // Handle card removal
        break;
      case 'TIMEOUT':
        // Handle timeout
        break;
      default:
        // Handle other errors
    }
  }
}
```

## License

ANAL-Tight-1.0.1 - See [LICENSE](../../LICENSE.md)
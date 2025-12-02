# @aokiapp/pcsc-ffi-node

Low-level PC/SC bindings for Node.js using FFI.

## Installation

```bash
npm install @aokiapp/pcsc-ffi-node
```

## Prerequisites

- Windows: Built-in (winscard.dll)
- macOS: Built-in (PCSC.framework)
- Linux: Install PC/SC lite
  ```bash
  sudo apt-get install libpcsclite1  # Debian/Ubuntu
  sudo yum install pcsc-lite-libs    # RHEL/CentOS
  ```

## Quick Start

```typescript
import { 
  SCardEstablishContext, 
  SCardListReaders,
  SCardConnect,
  SCardTransmit,
  SCARD_SCOPE_SYSTEM,
  SCARD_SHARE_SHARED,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1
} from '@aokiapp/pcsc-ffi-node';

// Establish context
const hContext = [0];
SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);

// List readers
const readersBuffer = Buffer.alloc(256);
const size = [256];
SCardListReaders(hContext[0], null, readersBuffer, size);

// Connect to card
const hCard = [0];
const protocol = [0];
SCardConnect(hContext[0], "Reader Name", SCARD_SHARE_SHARED, 
  SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, hCard, protocol);

// Send APDU
const apdu = Buffer.from([0x00, 0xA4, 0x04, 0x00]);
const recv = Buffer.alloc(256);
const recvLen = [256];
SCardTransmit(hCard[0], SCARD_PCI_T1, apdu, apdu.length, 
  null, recv, recvLen);
```

## Examples

### List All Readers

```typescript
import { 
  SCardEstablishContext, 
  SCardListReaders,
  SCardReleaseContext,
  SCARD_SCOPE_SYSTEM,
  PcscErrorCode,
  pcsc_stringify_error
} from '@aokiapp/pcsc-ffi-node';

function listReaders(): string[] {
  const hContext = [0];
  
  // Establish context
  let ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
  if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
    throw new Error(`Failed to establish context: ${pcsc_stringify_error(ret)}`);
  }
  
  try {
    // Get required buffer size
    const size = [0];
    ret = SCardListReaders(hContext[0], null, null, size);
    
    if (ret === PcscErrorCode.SCARD_E_NO_READERS_AVAILABLE) {
      return [];
    }
    
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      throw new Error(`Failed to query readers: ${pcsc_stringify_error(ret)}`);
    }
    
    // Get reader names
    const buffer = Buffer.alloc(size[0]);
    ret = SCardListReaders(hContext[0], null, buffer, size);
    
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      throw new Error(`Failed to list readers: ${pcsc_stringify_error(ret)}`);
    }
    
    // Parse null-terminated strings
    const readers = buffer.toString('utf8')
      .split('\0')
      .filter(r => r.length > 0);
    
    return readers;
    
  } finally {
    SCardReleaseContext(hContext[0]);
  }
}
```

### Connect and Send APDU

```typescript
import {
  SCardEstablishContext,
  SCardConnect,
  SCardTransmit,
  SCardDisconnect,
  SCARD_SCOPE_SYSTEM,
  SCARD_SHARE_SHARED,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_PCI_T0,
  SCARD_PCI_T1,
  SCARD_LEAVE_CARD,
  PcscErrorCode
} from '@aokiapp/pcsc-ffi-node';

async function sendApdu(readerName: string, apduBytes: number[]): Promise<number[]> {
  const hContext = [0];
  const hCard = [0];
  const protocol = [0];
  
  // Establish context
  let ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
  if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
    throw new Error('Failed to establish context');
  }
  
  try {
    // Connect to card
    ret = SCardConnect(
      hContext[0],
      readerName,
      SCARD_SHARE_SHARED,
      SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
      hCard,
      protocol
    );
    
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      throw new Error('Failed to connect to card');
    }
    
    try {
      // Prepare APDU
      const apdu = Buffer.from(apduBytes);
      const recv = Buffer.alloc(260); // Max response size
      const recvLen = [recv.length];
      
      // Select correct protocol
      const pci = protocol[0] === SCARD_PROTOCOL_T0 ? 
        SCARD_PCI_T0 : SCARD_PCI_T1;
      
      // Transmit
      ret = SCardTransmit(
        hCard[0],
        pci,
        apdu,
        apdu.length,
        null,
        recv,
        recvLen
      );
      
      if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
        throw new Error('Failed to transmit APDU');
      }
      
      // Return response bytes
      return Array.from(recv.subarray(0, recvLen[0]));
      
    } finally {
      SCardDisconnect(hCard[0], SCARD_LEAVE_CARD);
    }
  } finally {
    SCardReleaseContext(hContext[0]);
  }
}

// Usage
const response = await sendApdu("ACS ACR122U", 
  [0x00, 0xA4, 0x04, 0x00, 0x07, 0xA0, 0x00, 0x00, 0x01, 0x51, 0x00, 0x00]
);
console.log('Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
```

### Get Card Status

```typescript
import {
  SCardEstablishContext,
  SCardGetStatusChange,
  SCARD_SCOPE_SYSTEM,
  SCARD_STATE_UNAWARE,
  SCARD_STATE_PRESENT,
  SCARD_STATE_EMPTY,
  PcscErrorCode
} from '@aokiapp/pcsc-ffi-node';

function getCardStatus(readerName: string): {present: boolean, atr?: string} {
  const hContext = [0];
  
  SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
  
  try {
    const state = {
      szReader: readerName,
      pvUserData: null,
      dwCurrentState: SCARD_STATE_UNAWARE,
      dwEventState: 0,
      cbAtr: 0,
      rgbAtr: Buffer.alloc(36)
    };
    
    const ret = SCardGetStatusChange(hContext[0], 0, [state], 1);
    
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      throw new Error('Failed to get status');
    }
    
    const isPresent = (state.dwEventState & SCARD_STATE_PRESENT) !== 0;
    
    if (isPresent && state.cbAtr > 0) {
      const atr = state.rgbAtr.subarray(0, state.cbAtr)
        .toString('hex')
        .toUpperCase();
      return { present: true, atr };
    }
    
    return { present: false };
    
  } finally {
    SCardReleaseContext(hContext[0]);
  }
}
```

## API Reference

### Context Functions

#### `SCardEstablishContext(scope, reserved1, reserved2, context): number`
Establishes a PC/SC resource manager context.

**Parameters:**
- `scope: number` - Context scope
  - `SCARD_SCOPE_USER` (0) - Operations under user domain
  - `SCARD_SCOPE_SYSTEM` (2) - Operations under system domain (recommended)
- `reserved1: null` - Reserved, must be null
- `reserved2: null` - Reserved, must be null
- `context: number[]` - Output array [0] receives context handle

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` (0x00000000) = Success
- `SCARD_E_NO_SERVICE` (0x8010001D) = PC/SC service not running

**Example:**
```typescript
const hContext = [0];
const ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
if (ret === PcscErrorCode.SCARD_S_SUCCESS) {
  console.log('Context:', hContext[0]); // Use this handle
}
```

#### `SCardReleaseContext(context): number`
Releases a PC/SC resource manager context.

**Parameters:**
- `context: number` - Context handle from `SCardEstablishContext`

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` = Success
- `SCARD_E_INVALID_HANDLE` = Invalid context handle

**Behavior:** Automatically disconnects all cards connected through this context.

#### `SCardIsValidContext(context): number`
Checks if a context handle is still valid.

**Parameters:**
- `context: number` - Context handle to validate

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` = Valid context
- `SCARD_E_INVALID_HANDLE` = Invalid context

---

### Reader Functions

#### `SCardListReaders(context, groups, readers, size): number`
Lists available smart card readers. Call twice: first with `readers=null` to get size, then with allocated buffer.

**Parameters:**
- `context: number` - Context handle from `SCardEstablishContext`
- `groups: string | null` - Reader groups filter (usually null for all)
- `readers: Buffer | null` - Buffer to receive reader names (null-terminated strings)
  - First call: null to query size
  - Second call: Buffer.alloc(size[0] * charSize)
- `size: number[]` - In/out parameter for buffer size
  - Input: Maximum buffer size (characters, not bytes)
  - Output: Actual size required/used

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` = Success
- `SCARD_E_NO_READERS_AVAILABLE` (0x8010002E) = No readers found
- `SCARD_E_INSUFFICIENT_BUFFER` = Buffer too small

**Platform Encoding:**
- Windows: UTF-16LE (2 bytes per char)
- Linux/macOS: UTF-8 (1 byte per char)

**Example:**
```typescript
const pcchReaders = [0];
let ret = SCardListReaders(context, null, null, pcchReaders); // Get size

const charSize = process.platform === 'win32' ? 2 : 1;
const buffer = Buffer.alloc(pcchReaders[0] * charSize);
ret = SCardListReaders(context, null, buffer, pcchReaders); // Get names

const encoding = process.platform === 'win32' ? 'utf16le' : 'utf8';
const readers = buffer.toString(encoding).split('\0').filter(r => r);
```

#### `SCardGetStatusChange(context, timeout, states, count): number`
Waits for reader state changes.

**Parameters:**
- `context: number` - Context handle
- `timeout: number` - Timeout in milliseconds (0 = immediate, 0xFFFFFFFF = infinite)
- `states: ReaderState[]` - Array of reader state structures (in/out)
  - Input: Current known state
  - Output: New event state
- `count: number` - Number of elements in states array

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` = State change detected
- `SCARD_E_TIMEOUT` = No change within timeout

**ReaderState Structure:**
- `szReader: string` - Reader name
- `pvUserData: any` - Application-defined data
- `dwCurrentState: number` - Current known state flags
- `dwEventState: number` - New state flags (output)
- `cbAtr: number` - ATR length (output)
- `rgbAtr: Buffer` - ATR bytes (output)

---

### Card Functions

#### `SCardConnect(context, reader, shareMode, protocols, card, protocol): number`
Establishes a connection to a smart card.

**Parameters:**
- `context: number` - Context handle from `SCardEstablishContext`
- `reader: string` - Reader name from `SCardListReaders`
- `shareMode: number` - Access mode
  - `SCARD_SHARE_EXCLUSIVE` (1) = Exclusive access
  - `SCARD_SHARE_SHARED` (2) = Shared access (recommended)
  - `SCARD_SHARE_DIRECT` (3) = Direct access (no card interaction)
- `protocols: number` - Acceptable protocols (bitfield)
  - `SCARD_PROTOCOL_T0` (0x01) = T=0 protocol
  - `SCARD_PROTOCOL_T1` (0x02) = T=1 protocol
  - `SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1` = Accept either (recommended)
- `card: number[]` - Output array [0] receives card handle
- `protocol: number[]` - Output array [0] receives active protocol

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` = Connected
- `SCARD_E_NO_SMARTCARD` (0x8010000C) = No card in reader
- `SCARD_W_REMOVED_CARD` (0x80100069) = Card removed
- `SCARD_E_SHARING_VIOLATION` (0x8010000B) = Card in use

**Example:**
```typescript
const hCard = [0];
const activeProtocol = [0];
const ret = SCardConnect(
  context,
  "ACS ACR122U 00 00",
  SCARD_SHARE_SHARED,
  SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
  hCard,
  activeProtocol
);
// hCard[0] = card handle for transmit
// activeProtocol[0] = SCARD_PROTOCOL_T0 or SCARD_PROTOCOL_T1
```

#### `SCardDisconnect(card, disposition): number`
Terminates a connection to a smart card.

**Parameters:**
- `card: number` - Card handle from `SCardConnect`
- `disposition: number` - Action to perform
  - `SCARD_LEAVE_CARD` (0) = Do nothing (recommended)
  - `SCARD_RESET_CARD` (1) = Reset card
  - `SCARD_UNPOWER_CARD` (2) = Power down card
  - `SCARD_EJECT_CARD` (3) = Eject card (if reader supports)

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` = Disconnected
- `SCARD_E_INVALID_HANDLE` = Invalid card handle

#### `SCardTransmit(card, sendPci, sendBuffer, sendLen, recvPci, recvBuffer, recvLen): number`
Sends an APDU to the smart card and receives the response.

**Parameters:**
- `card: number` - Card handle from `SCardConnect`
- `sendPci: SCARD_IO_REQUEST` - Protocol control info for send
  - Use `SCARD_PCI_T0` for T=0 protocol
  - Use `SCARD_PCI_T1` for T=1 protocol
- `sendBuffer: Buffer` - APDU command bytes
- `sendLen: number` - Length of sendBuffer
- `recvPci: SCARD_IO_REQUEST | null` - Protocol control info for receive (can be null)
- `recvBuffer: Buffer` - Buffer to receive response (pre-allocated)
- `recvLen: number[]` - In/out buffer size
  - Input: recvBuffer.length
  - Output: Actual response length

**Returns:** `number` - Status code
- `SCARD_S_SUCCESS` = Success
- `SCARD_E_INSUFFICIENT_BUFFER` = Response too large
- `SCARD_W_REMOVED_CARD` = Card removed during transmission

**Example:**
```typescript
const apdu = Buffer.from([0x00, 0xA4, 0x04, 0x00, 0x05, 0xA0, 0x00, 0x00, 0x01, 0x51]);
const recv = Buffer.alloc(256);
const recvLen = [256];

const ret = SCardTransmit(
  cardHandle,
  SCARD_PCI_T1,
  apdu,
  apdu.length,
  null,
  recv,
  recvLen
);

if (ret === SCARD_S_SUCCESS) {
  const response = recv.subarray(0, recvLen[0]);
  console.log('Response:', response.toString('hex'));
}
```

#### `SCardStatus(card, reader, readerLen, state, protocol, atr, atrLen): number`
Retrieves the current status of a smart card.

**Parameters:**
- `card: number` - Card handle
- `reader: Buffer | null` - Buffer to receive reader name (or null)
- `readerLen: number[]` - In/out reader name buffer size
- `state: number[]` - Output [0] receives card state flags
- `protocol: number[]` - Output [0] receives active protocol
- `atr: Buffer` - Buffer to receive ATR (typically 36 bytes)
- `atrLen: number[]` - In/out ATR buffer size

**Returns:** `number` - Status code

**State Flags (output in state[0]):**
- `SCARD_STATE_PRESENT` (0x00020) = Card present
- `SCARD_STATE_UNPOWERED` (0x00400) = Card unpowered
- `SCARD_STATE_EXCLUSIVE` (0x00080) = Card in exclusive use
- `SCARD_STATE_INUSE` (0x00040) = Card in use

---

### Transaction Functions

#### `SCardBeginTransaction(card): number`
Begins an exclusive transaction with the card.

**Parameters:**
- `card: number` - Card handle

**Returns:** `number` - Status code

**Usage:** Locks card for exclusive access until `SCardEndTransaction`.

#### `SCardEndTransaction(card, disposition): number`
Ends an exclusive transaction.

**Parameters:**
- `card: number` - Card handle
- `disposition: number` - Action (same as `SCardDisconnect`)

**Returns:** `number` - Status code

### Constants

```typescript
// Scopes
SCARD_SCOPE_USER    // User context
SCARD_SCOPE_SYSTEM  // System context

// Share Modes  
SCARD_SHARE_EXCLUSIVE  // Exclusive access
SCARD_SHARE_SHARED     // Shared access
SCARD_SHARE_DIRECT     // Direct access

// Protocols
SCARD_PROTOCOL_T0   // T=0 protocol
SCARD_PROTOCOL_T1   // T=1 protocol
SCARD_PROTOCOL_RAW  // Raw protocol

// Dispositions
SCARD_LEAVE_CARD    // Leave card as-is
SCARD_RESET_CARD    // Reset card
SCARD_UNPOWER_CARD  // Power down
SCARD_EJECT_CARD    // Eject card

// States
SCARD_STATE_UNAWARE     // App unaware of state
SCARD_STATE_PRESENT     // Card present
SCARD_STATE_EMPTY       // No card
SCARD_STATE_UNAVAILABLE // Reader unavailable
```

### Error Handling

```typescript
import { PcscErrorCode, pcsc_stringify_error } from '@aokiapp/pcsc-ffi-node';

const ret = SCardConnect(...);

if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
  const errorMessage = pcsc_stringify_error(ret);
  console.error(`Error: ${errorMessage} (0x${ret.toString(16)})`);
  
  // Check specific errors
  switch (ret) {
    case PcscErrorCode.SCARD_E_NO_SMARTCARD:
      console.log('No card in reader');
      break;
    case PcscErrorCode.SCARD_E_TIMEOUT:
      console.log('Operation timed out');
      break;
    case PcscErrorCode.SCARD_W_REMOVED_CARD:
      console.log('Card was removed');
      break;
  }
}
```

## Platform Differences

### Windows
- Uses `winscard.dll`
- Reader names in UTF-16LE
- Use `SCARD_AUTOALLOCATE` for dynamic allocation

### Linux
- Uses `libpcsclite.so.1`
- Reader names in UTF-8
- Requires `pcscd` service running

### macOS
- Uses `PCSC.framework`
- Reader names in UTF-8
- Built into the OS

## License

ANAL-Tight-1.0.1 - See [LICENSE](../../LICENSE.md)
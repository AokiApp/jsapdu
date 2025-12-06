# PC/SC FFI Examples (Node.js)

Low-level examples demonstrating direct Foreign Function Interface (FFI) access to PC/SC native libraries for maximum control over smart card operations.

## Overview

This directory contains Node.js scripts that directly call PC/SC native functions using `@aokiapp/pcsc-ffi-node`. These examples bypass high-level abstractions to provide:

- **Direct control** over PC/SC API calls
- **Platform-specific behavior** access (Windows, macOS, Linux)
- **Low-level debugging** capabilities
- **Custom reader operations** not exposed by higher-level packages

## Prerequisites

### Hardware

- PC/SC-compatible smart card reader (any model)
- Smart card (optional for some examples)

### Software

- Node.js 18.0+ or compatible runtime
- PC/SC middleware:
  - **Windows**: winscard.dll (built-in)
  - **macOS**: PCSC.framework (built-in)
  - **Linux**: libpcsclite.so.1 (install pcscd)
    ```bash
    sudo apt-get install pcscd libpcsclite1  # Debian/Ubuntu
    sudo yum install pcsc-lite-libs          # RHEL/CentOS
    ```

## Installation

```bash
cd examples/pcsc-ffi
npm install
npm run build
```

## Available Examples

### 1. List Readers

Enumerates all connected PC/SC smart card readers with proper character encoding handling.

**File:** [`src/list_readers.ts`](./src/list_readers.ts)

**Purpose:** Demonstrates PC/SC context establishment and reader enumeration with platform-specific string encoding.

**Usage:**
```bash
npm run build
node dist/src/list_readers.js
```

**Example Output:**
```
Starting list_readers demo...
Context establishing...
Context established.
Reader buffer size needed: 54 characters (~54 bytes)
Readers found: 2
  Reader 1: "ACS ACR122U 00 00"
  Reader 2: "Sony RC-S380/P 01 00"
Releasing context...
Context released.
```

**Key Concepts:**
- `SCardEstablishContext()` - Initialize PC/SC subsystem
- `SCardListReaders()` - Two-phase call pattern (size query, then data retrieval)
- Platform-specific encoding:
  - Windows: UTF-16LE (2 bytes per character)
  - macOS/Linux: UTF-8 (1 byte per character)
- `SCardReleaseContext()` - Clean resource release

**Code Pattern:**
```typescript
// 1. Establish context
const hContext = [0];
SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);

// 2. Get buffer size (first call)
const pcchReaders = [0];
SCardListReaders(hContext[0], null, null, pcchReaders);

// 3. Allocate buffer with correct size
const charSize = process.platform === 'win32' ? 2 : 1;
const buffer = Buffer.alloc(pcchReaders[0] * charSize);

// 4. Get reader names (second call)
SCardListReaders(hContext[0], null, buffer, pcchReaders);

// 5. Parse multi-string buffer
const encoding = process.platform === 'win32' ? 'utf16le' : 'utf8';
const readers = buffer.toString(encoding).split('\0').filter(r => r.length > 0);

// 6. Release context
SCardReleaseContext(hContext[0]);
```

### 2. Send APDU

Connects to a card and sends raw APDU commands with protocol negotiation.

**File:** [`src/send_apdu.ts`](./src/send_apdu.ts)

**Purpose:** Demonstrates card connection, protocol selection (T=0 or T=1), and APDU transmission.

**Required:** Card must be present in reader

**Usage:**
```bash
node dist/src/send_apdu.js
```

**Example Output:**
```
Context established.
Readers: [ 'ACS ACR122U 00 00' ]
Attempting to connect to reader: ACS ACR122U 00 00
Connected to card. Handle: 12345678, Protocol: 2
Sending APDU: 00a4000002 3f00
APDU Response: 6f15840...9000
Disconnected from card.
Context released.
```

**Commands Demonstrated:**
- `SCardConnect()` - Establish card connection with protocol negotiation
- `SCardTransmit()` - Send APDU and receive response
- `SCardDisconnect()` - Gracefully disconnect from card

**APDU Sent:** `00 A4 00 00 02 3F 00` (SELECT Master File)

**Code Pattern:**
```typescript
// 1. Connect to card
const hCard = [0];
const protocol = [0];
SCardConnect(
  context,
  readerName,
  SCARD_SHARE_SHARED,
  SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
  hCard,
  protocol
);

// 2. Select PCI based on active protocol
const pci = protocol[0] === SCARD_PROTOCOL_T0 ? SCARD_PCI_T0 : SCARD_PCI_T1;

// 3. Prepare APDU
const apdu = Buffer.from([0x00, 0xA4, 0x00, 0x00, 0x02, 0x3F, 0x00]);
const recv = Buffer.alloc(256);
const recvLen = [256];

// 4. Transmit
SCardTransmit(hCard[0], pci, apdu, apdu.length, null, recv, recvLen);

// 5. Extract response
const response = recv.subarray(0, recvLen[0]);

// 6. Disconnect
SCardDisconnect(hCard[0], SCARD_LEAVE_CARD);
```

### 3. Card Status

Queries card presence, state, active protocol, and ATR (Answer To Reset).

**File:** [`src/card_status.ts`](./src/card_status.ts)

**Purpose:** Demonstrates `SCardStatus()` for retrieving detailed card information.

**Required:** Card must be present in reader

**Usage:**
```bash
node dist/src/card_status.js
```

**Example Output:**
```
Starting card_status demo...
Establishing context...
Context established.
Reader buffer size needed: 27 characters (~27 bytes)
Readers found: 1
  Reader 1: "ACS ACR122U 00 00"
Attempting to connect to first reader: ACS ACR122U 00 00
Connected to card. Handle: 12345678, Protocol: 2
Getting card status...
Card Status:
  Reader Name: ACS ACR122U 00 00
  State: 4
  Protocol: 2
  ATR: 3b8f8001804f0ca0000003060300030000000068
Disconnecting from card...
Disconnected from card.
Releasing context...
Context released.
```

**Information Retrieved:**
- **Reader name** - Confirms connected reader
- **State flags** - Card presence, powered state, exclusive access
- **Protocol** - Active protocol (T=0 = 1, T=1 = 2)
- **ATR** - Card identification and capability data

**Code Pattern:**
```typescript
// Prepare buffers for SCardStatus
const readerName = Buffer.alloc(MAX_READERNAME * charSize);
const readerLen = [MAX_READERNAME];
const state = [0];
const protocol = [0];
const atr = Buffer.alloc(MAX_ATR_SIZE);
const atrLen = [MAX_ATR_SIZE];

// Query status
SCardStatus(cardHandle, readerName, readerLen, state, protocol, atr, atrLen);

// Parse results
const readerStr = readerName.toString(encoding, 0, readerLen[0] * charSize);
const atrHex = atr.toString('hex', 0, atrLen[0]);
```

### 4. Transaction

Demonstrates atomic transaction blocks for exclusive card access.

**File:** [`src/transaction.ts`](./src/transaction.ts)

**Purpose:** Shows how to use `SCardBeginTransaction()` and `SCardEndTransaction()` for exclusive card access.

**Required:** Card must be present in reader

**Usage:**
```bash
node dist/src/transaction.js
```

**Example Output:**
```
Context established.
Readers: [ 'ACS ACR122U 00 00' ]
Attempting to connect to reader: ACS ACR122U 00 00
Connected to card. Handle: 12345678
Transaction started.
Performing card operations within transaction...
Transaction ended.
Disconnected from card.
Context released.
```

**Use Cases:**
- **Multi-APDU sequences** that must not be interrupted
- **File updates** requiring atomic commits
- **PIN verification** followed by protected operations
- **Preventing race conditions** with concurrent applications

**Code Pattern:**
```typescript
// Begin exclusive transaction
SCardBeginTransaction(cardHandle);

try {
  // Perform multiple operations atomically
  // - No other application can access the card
  // - Card state is preserved between operations
  
  // Example: SELECT + VERIFY + READ
  transmitApdu(selectCommand);
  transmitApdu(verifyCommand);
  transmitApdu(readCommand);
  
} finally {
  // Always end transaction
  SCardEndTransaction(cardHandle, SCARD_LEAVE_CARD);
}
```

## Running All Examples

Use the provided scripts to run all examples in sequence:

### Windows (PowerShell)
```powershell
.\run-all.ps1
```

### Linux/macOS (Bash)
```bash
chmod +x run-all.sh
./run-all.sh
```

## Platform-Specific Considerations

### Windows (winscard.dll)

**Character Encoding:** UTF-16LE (wide characters)
```typescript
const charSize = 2;
const encoding = 'utf16le';
```

**Library Loading:**
```typescript
// Automatically loads from System32/winscard.dll
```

**Service Management:**
```powershell
# Check service status
Get-Service SCardSvr

# Restart if needed
Restart-Service SCardSvr
```

### macOS (PCSC.framework)

**Character Encoding:** UTF-8
```typescript
const charSize = 1;
const encoding = 'utf8';
```

**Library Loading:**
```typescript
// Automatically loads from /System/Library/Frameworks/PCSC.framework
```

**No service management required** - framework is always available.

### Linux (libpcsclite.so.1)

**Character Encoding:** UTF-8
```typescript
const charSize = 1;
const encoding = 'utf8';
```

**Library Loading:**
```typescript
// Loads from /usr/lib/x86_64-linux-gnu/libpcsclite.so.1
// Or /usr/lib/libpcsclite.so.1
```

**Service Management:**
```bash
# Check pcscd service
sudo systemctl status pcscd

# Start if not running
sudo systemctl start pcscd

# Enable on boot
sudo systemctl enable pcscd
```

## Error Handling

All examples demonstrate proper error handling:

```typescript
import { PcscErrorCode, pcsc_stringify_error } from '@aokiapp/pcsc-ffi-node';

const ret = SCardConnect(...);

if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
  const errorMessage = pcsc_stringify_error(ret);
  console.error(`Operation failed: ${errorMessage} (0x${ret.toString(16)})`);
  
  // Handle specific errors
  switch (ret) {
    case PcscErrorCode.SCARD_E_NO_SMARTCARD:
      // No card in reader
      break;
    case PcscErrorCode.SCARD_W_REMOVED_CARD:
      // Card was removed
      break;
    case PcscErrorCode.SCARD_E_SHARING_VIOLATION:
      // Another app has exclusive access
      break;
    case PcscErrorCode.SCARD_E_TIMEOUT:
      // Operation timed out
      break;
  }
}
```

### Common Error Codes

| Code | Value | Meaning |
|------|-------|---------|
| `SCARD_S_SUCCESS` | 0x00000000 | Success |
| `SCARD_E_NO_SERVICE` | 0x8010001D | PC/SC service not running |
| `SCARD_E_NO_READERS_AVAILABLE` | 0x8010002E | No readers connected |
| `SCARD_E_NO_SMARTCARD` | 0x8010000C | No card in reader |
| `SCARD_W_REMOVED_CARD` | 0x80100069 | Card removed during operation |
| `SCARD_E_SHARING_VIOLATION` | 0x8010000B | Card in exclusive use |
| `SCARD_E_TIMEOUT` | 0x8010000A | Operation timed out |

## Resource Management

All examples follow this pattern:

```typescript
const hContext = [0];
let ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);

try {
  const hCard = [0];
  const protocol = [0];
  ret = SCardConnect(context, reader, SCARD_SHARE_SHARED, 
    SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, hCard, protocol);
  
  try {
    // Card operations...
  } finally {
    SCardDisconnect(hCard[0], SCARD_LEAVE_CARD);
  }
} finally {
  SCardReleaseContext(hContext[0]);
}
```

**Key Principles:**
1. Always establish context before operations
2. Use `try/finally` for guaranteed cleanup
3. Disconnect before releasing context
4. Check return codes for every operation

## Troubleshooting

### "Failed to establish context"

**Symptoms:** `SCardEstablishContext()` returns error

**Causes & Solutions:**
- **Windows:** Smart Card service stopped
  ```powershell
  Start-Service SCardSvr
  ```
- **Linux:** pcscd not running
  ```bash
  sudo systemctl start pcscd
  ```
- **All platforms:** PC/SC library not found (check installation)

### "No readers found"

**Symptoms:** `SCardListReaders()` returns `SCARD_E_NO_READERS_AVAILABLE`

**Solutions:**
- Connect reader via USB
- Install reader drivers (usually automatic)
- Check `lsusb` (Linux) or Device Manager (Windows) for reader recognition

### "Failed to connect to card"

**Symptoms:** `SCardConnect()` returns `SCARD_E_NO_SMARTCARD`

**Solutions:**
- Insert card into reader
- Verify card is seated properly (contact readers)
- Hold card steady on reader (NFC readers)
- Check card is not damaged

### String Encoding Issues

**Symptoms:** Garbled reader names or mojibake

**Solution:** Ensure correct encoding for platform:
```typescript
const isWindows = process.platform === 'win32';
const charSize = isWindows ? 2 : 1;
const encoding: BufferEncoding = isWindows ? 'utf16le' : 'utf8';
```

## Advanced Patterns

### Polling for Card Events

```typescript
import { SCARD_STATE_UNAWARE, SCardGetStatusChange } from '@aokiapp/pcsc-ffi-node';

const state = {
  szReader: readerName,
  pvUserData: null,
  dwCurrentState: SCARD_STATE_UNAWARE,
  dwEventState: 0,
  cbAtr: 0,
  rgbAtr: Buffer.alloc(36)
};

// Wait for state change (e.g., card insertion)
SCardGetStatusChange(context, 5000, [state], 1);

if (state.dwEventState & SCARD_STATE_PRESENT) {
  console.log('Card detected!');
  console.log('ATR:', state.rgbAtr.toString('hex', 0, state.cbAtr));
}
```

### Multi-Reader Operations

```typescript
// Get all readers
const readers = listAllReaders(context);

// Connect to all cards in parallel
const connections = await Promise.all(
  readers.map(async reader => {
    const hCard = [0];
    const protocol = [0];
    const ret = SCardConnect(context, reader, SCARD_SHARE_SHARED, 
      SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, hCard, protocol);
    return ret === SCARD_S_SUCCESS ? { reader, hCard: hCard[0] } : null;
  })
);

// Filter successful connections
const activeCards = connections.filter(c => c !== null);
```

## Related Documentation

- **[Examples Overview](../README.md)** - All available examples
- **[@aokiapp/pcsc-ffi-node Package](../../packages/pcsc-ffi-node/README.md)** - Complete FFI API reference
- **[@aokiapp/jsapdu-pcsc Package](../../packages/pcsc-pcsc/README.md)** - Higher-level PC/SC wrapper
- **[PC/SC Specification](https://pcscworkgroup.com/)** - Official PC/SC standards

## Next Steps

1. **For beginners**: Start with `list_readers.ts` to understand context establishment
2. **For APDU operations**: See `send_apdu.ts` for basic communication
3. **For state management**: Study `card_status.ts` for card information
4. **For atomic operations**: Use `transaction.ts` patterns for multi-APDU sequences
5. **For high-level APIs**: Explore `@aokiapp/jsapdu-pcsc` package for easier development

## Contributing

When adding new FFI examples:
1. Follow the established error handling pattern
2. Use proper resource cleanup with `try/finally`
3. Document platform-specific behavior
4. Include example output
5. Test on Windows, macOS, and Linux

## License

ANAL-Tight-1.0.1 - See [LICENSE](../../LICENSE.md)
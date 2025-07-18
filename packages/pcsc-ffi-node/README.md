# @aokiapp/pcsc-ffi-node

PC/SC Foreign Function Interface (FFI) library for Node.js using Koffi.

## Overview

This package provides low-level PC/SC bindings for Node.js through Foreign Function Interface (FFI) using the Koffi library. It directly interfaces with native PC/SC libraries (WinSCard.dll on Windows, PC/SC framework on macOS/Linux) to enable SmartCard communication at the system level.

**Note**: This is a low-level package primarily used internally by [`@aokiapp/jsapdu-pcsc`](../pcsc). Most developers should use the higher-level abstractions instead.

## Installation

```bash
npm install @aokiapp/pcsc-ffi-node
```

## Platform Support

### Supported Architectures

- **x64** (AMD64) - Intel/AMD 64-bit processors
- **arm64** (AArch64) - ARM 64-bit processors (Apple Silicon, ARM servers)

### Supported Operating Systems

- **Windows**: Uses `WinSCard.dll`
- **macOS**: Uses PC/SC framework
- **Linux**: Uses `libpcsclite`

Unsupported platforms will throw an error on import.

## Core Functions

### Context Management

#### SCardEstablishContext

```typescript
import {
  SCardEstablishContext,
  SCARD_SCOPE_SYSTEM,
} from "@aokiapp/pcsc-ffi-node";

// Establish PC/SC resource manager context
const hContext = [0]; // Output parameter
const ret = SCardEstablishContext(
  SCARD_SCOPE_SYSTEM, // Scope
  null, // Reserved
  null, // Reserved
  hContext, // Output: context handle
);

if (ret === 0) {
  // SCARD_S_SUCCESS
  console.log("Context established:", hContext[0]);
}
```

#### SCardReleaseContext

```typescript
import { SCardReleaseContext } from "@aokiapp/pcsc-ffi-node";

// Release PC/SC context
const ret = SCardReleaseContext(hContext[0]);
if (ret === 0) {
  console.log("Context released");
}
```

### Reader Management

#### SCardListReaders

```typescript
import { SCardListReaders } from "@aokiapp/pcsc-ffi-node";

// Get required buffer size
const pcchReaders = [0];
let ret = SCardListReaders(hContext[0], null, null, pcchReaders);

if (ret === 0) {
  // Allocate buffer and get reader names
  const readersBuffer = Buffer.alloc(pcchReaders[0]);
  ret = SCardListReaders(hContext[0], null, readersBuffer, pcchReaders);

  if (ret === 0) {
    // Parse null-separated reader names
    const readerNames = readersBuffer
      .toString("utf8", 0, pcchReaders[0] - 1)
      .split("\0")
      .filter((name) => name.length > 0);
    console.log("Readers:", readerNames);
  }
}
```

### Card Communication

#### SCardConnect

```typescript
import {
  SCardConnect,
  SCARD_SHARE_SHARED,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
} from "@aokiapp/pcsc-ffi-node";

// Connect to card in reader
const hCard = [0];
const activeProtocol = [0];
const ret = SCardConnect(
  hContext[0], // Context
  "ACS CCID USB Reader 0", // Reader name
  SCARD_SHARE_SHARED, // Share mode
  SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, // Preferred protocols
  hCard, // Output: card handle
  activeProtocol, // Output: active protocol
);

if (ret === 0) {
  console.log("Connected to card:", hCard[0]);
  console.log("Protocol:", activeProtocol[0]);
}
```

#### SCardTransmit

```typescript
import {
  SCardTransmit,
  SCARD_PCI_T0,
  SCARD_PCI_T1,
  SCARD_PROTOCOL_T0,
} from "@aokiapp/pcsc-ffi-node";

// Send APDU command
const commandBuffer = Buffer.from([
  0x00, 0xa4, 0x04, 0x00, 0x07, 0xa0, 0x00, 0x00, 0x00, 0x04, 0x10, 0x10,
]);
const responseBuffer = Buffer.alloc(258); // Max response size
const responseLength = [responseBuffer.length];

// Select appropriate PCI based on protocol
const pioSendPci =
  activeProtocol[0] === SCARD_PROTOCOL_T0 ? SCARD_PCI_T0 : SCARD_PCI_T1;
const pioRecvPci = { dwProtocol: 0, cbPciLength: 8 };

const ret = SCardTransmit(
  hCard[0], // Card handle
  pioSendPci, // Send PCI
  commandBuffer, // Command data
  commandBuffer.length, // Command length
  pioRecvPci, // Receive PCI
  responseBuffer, // Response buffer
  responseLength, // Response length (in/out)
);

if (ret === 0) {
  const response = responseBuffer.slice(0, responseLength[0]);
  console.log("Response:", response.toString("hex"));
}
```

#### SCardDisconnect

```typescript
import { SCardDisconnect, SCARD_LEAVE_CARD } from "@aokiapp/pcsc-ffi-node";

// Disconnect from card
const ret = SCardDisconnect(hCard[0], SCARD_LEAVE_CARD);
if (ret === 0) {
  console.log("Disconnected from card");
}
```

### Card Status and Information

#### SCardStatus

```typescript
import { SCardStatus } from "@aokiapp/pcsc-ffi-node";

// Get card status and ATR
const readerNamesLen = [256];
const readerNamesBuffer = Buffer.alloc(256);
const state = [0];
const protocol = [0];
const atr = Buffer.alloc(33); // Max ATR length
const atrLen = [33];

const ret = SCardStatus(
  hCard[0], // Card handle
  readerNamesBuffer, // Reader names buffer
  readerNamesLen, // Reader names length
  state, // Card state
  protocol, // Protocol
  atr, // ATR buffer
  atrLen, // ATR length
);

if (ret === 0) {
  const cardAtr = atr.slice(0, atrLen[0]);
  console.log("ATR:", cardAtr.toString("hex"));
  console.log("State:", state[0]);
  console.log("Protocol:", protocol[0]);
}
```

## Constants

### Scopes

```typescript
SCARD_SCOPE_USER; // User scope
SCARD_SCOPE_TERMINAL; // Terminal scope
SCARD_SCOPE_SYSTEM; // System scope (most common)
```

### Share Modes

```typescript
SCARD_SHARE_EXCLUSIVE; // Exclusive access
SCARD_SHARE_SHARED; // Shared access (most common)
SCARD_SHARE_DIRECT; // Direct access (raw mode)
```

### Protocols

```typescript
SCARD_PROTOCOL_T0; // T=0 protocol
SCARD_PROTOCOL_T1; // T=1 protocol
SCARD_PROTOCOL_RAW; // Raw protocol
```

### Dispositions

```typescript
SCARD_LEAVE_CARD; // Leave card as-is
SCARD_RESET_CARD; // Reset card on disconnect
SCARD_UNPOWER_CARD; // Unpower card on disconnect
SCARD_EJECT_CARD; // Eject card on disconnect
```

### Error Codes

```typescript
// Success
SCARD_S_SUCCESS; // 0x00000000

// Common errors
SCARD_E_INVALID_HANDLE; // Invalid handle
SCARD_E_INVALID_PARAMETER; // Invalid parameter
SCARD_E_NO_MEMORY; // Out of memory
SCARD_E_NO_SERVICE; // PC/SC service not running
SCARD_E_NO_SMARTCARD; // No SmartCard in reader
SCARD_E_UNKNOWN_CARD; // Unknown card type
SCARD_E_CARD_UNSUPPORTED; // Card not supported
SCARD_E_READER_UNAVAILABLE; // Reader not available
SCARD_E_SHARING_VIOLATION; // Reader in use by another process
SCARD_E_NOT_TRANSACTED; // No transaction in progress
SCARD_E_TIMEOUT; // Operation timed out
```

## Type Definitions

### Core Types

```typescript
// Basic types
type DWORD = number;
type LONG = number;
type SCARDCONTEXT = number;
type SCARDHANDLE = number;

// Protocol Control Information
interface SCARD_IO_REQUEST {
  dwProtocol: number;
  cbPciLength: number;
}

// Reader state for monitoring
interface SCARD_READERSTATE {
  szReader: string;
  pvUserData: any;
  dwCurrentState: number;
  dwEventState: number;
  cbAtr: number;
  rgbAtr: Buffer;
}
```

## Error Handling

### Checking Return Values

```typescript
import { PcscErrorCode } from "@aokiapp/pcsc-ffi-node";

function checkResult(ret: number, operation: string) {
  if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
    // Handle unsigned 32-bit return values
    const errorCode = ret < 0 ? ret + 0x100000000 : ret;
    throw new Error(
      `${operation} failed with code: 0x${errorCode.toString(16)}`,
    );
  }
}

// Usage
try {
  const ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
  checkResult(ret, "SCardEstablishContext");
} catch (error) {
  console.error("PC/SC error:", error.message);
}
```

### Common Error Scenarios

```typescript
// Service not running
if (ret === PcscErrorCode.SCARD_E_NO_SERVICE) {
  console.error("PC/SC service is not running");
}

// No card present
if (ret === PcscErrorCode.SCARD_E_NO_SMARTCARD) {
  console.error("No SmartCard found in reader");
}

// Reader in use
if (ret === PcscErrorCode.SCARD_E_SHARING_VIOLATION) {
  console.error("Reader is being used by another application");
}
```

## Platform-Specific Notes

### Windows

- Uses `WinSCard.dll` from the system
- Functions use `__stdcall` calling convention
- Unicode variants used automatically (`SCardListReadersW`, `SCardConnectW`, etc.)

### macOS

- Uses PC/SC.framework
- Standard C calling convention
- Built-in PC/SC service (no separate installation needed)

### Linux

- Requires `libpcsclite` installation:

  ```bash
  # Ubuntu/Debian
  sudo apt-get install libpcsclite1 libpcsclite-dev

  # CentOS/RHEL
  sudo yum install pcsc-lite pcsc-lite-devel
  ```

- PC/SC daemon must be running:
  ```bash
  sudo systemctl start pcscd
  sudo systemctl enable pcscd
  ```

## Advanced Usage

### Transaction Management

```typescript
import {
  SCardBeginTransaction,
  SCardEndTransaction,
} from "@aokiapp/pcsc-ffi-node";

// Begin exclusive transaction
let ret = SCardBeginTransaction(hCard[0]);
checkResult(ret, "SCardBeginTransaction");

try {
  // Perform multiple operations atomically
  ret = SCardTransmit(/* ... */);
  checkResult(ret, "SCardTransmit");

  ret = SCardTransmit(/* ... */);
  checkResult(ret, "SCardTransmit");
} finally {
  // End transaction
  ret = SCardEndTransaction(hCard[0], SCARD_LEAVE_CARD);
  checkResult(ret, "SCardEndTransaction");
}
```

### Reader State Monitoring

```typescript
import {
  SCardGetStatusChange,
  SCARD_STATE_UNAWARE,
} from "@aokiapp/pcsc-ffi-node";

// Monitor reader state changes
const readerStates = [
  {
    szReader: "ACS CCID USB Reader 0",
    pvUserData: null,
    dwCurrentState: SCARD_STATE_UNAWARE,
    dwEventState: 0,
    cbAtr: 0,
    rgbAtr: Buffer.alloc(33),
  },
];

const ret = SCardGetStatusChange(
  hContext[0], // Context
  1000, // Timeout (ms)
  readerStates, // Reader states array
  1, // Number of readers
);

if (ret === 0) {
  console.log("State changed:", readerStates[0].dwEventState);
}
```

## Integration with Higher-Level Packages

This package is designed to be used by [`@aokiapp/jsapdu-pcsc`](../pcsc):

```typescript
// Don't use directly - use @aokiapp/jsapdu-pcsc instead
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";

const manager = PcscPlatformManager.getInstance();
const platform = manager.getPlatform();
// High-level API handles all FFI complexity
```

## Debugging

### Enable PC/SC Logging

```bash
# Linux - Debug PC/SC daemon
sudo pcscd -f -d

# Check PC/SC service status
# Windows
sc query SCardSvr

# Linux
systemctl status pcscd

# macOS
ps aux | grep pcscd
```

### Common Issues

- **Library not found**: Install PC/SC development packages
- **Service not running**: Start PC/SC service/daemon
- **Permission denied**: Run with appropriate privileges
- **Architecture mismatch**: Ensure matching Node.js and system architecture

## Dependencies

- **koffi**: ^2.6.1 - Foreign Function Interface library for Node.js

## Related Packages

- [`@aokiapp/jsapdu-pcsc`](../pcsc) - High-level PC/SC platform implementation
- [`@aokiapp/jsapdu-interface`](../interface) - Core SmartCard abstractions

## References

- [PC/SC Workgroup Specifications](https://pcscworkgroup.com/)
- [Microsoft WinSCard API](https://docs.microsoft.com/en-us/windows/win32/secauthn/smart-card-functions)
- [PC/SC Lite Documentation](https://pcsclite.apdu.fr/)
- [Koffi FFI Library](https://github.com/Koromix/koffi)

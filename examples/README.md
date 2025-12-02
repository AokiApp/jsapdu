# jsapdu Examples

Practical examples demonstrating how to use jsapdu packages across different platforms and use cases.

## FOR AI AGENTS / MACHINE-MADE READERS

You must read this file and all linked example READMEs to understand the usage patterns and best practices.

## Overview

This directory contains working examples organized by platform and complexity level:

- **[mynacard/](./mynacard/README.md)** - Node.js CLI examples for reading Japanese MynaCard
- **[pcsc-ffi/](./pcsc-ffi/README.md)** - Low-level PC/SC FFI bindings usage
- **[rn/](./rn/README.md)** - React Native mobile NFC application
- **[mynacard-e2e/](./mynacard-e2e/)** - End-to-end hardware tests (see [E2E Testing Patterns](../docs/testing/e2e-testing-patterns.md))

## Quick Start Guide

### For Node.js Development

Start with the MynaCard CLI examples to understand basic card operations:

```bash
cd examples/mynacard
npm install
npm run build

# Read health insurance basic info (requires PIN)
npm run read:kenhojo:basic-four

# Read residence certificate entries (requires PIN-A)
npm run read:kenkaku:entries
```

See **[mynacard/README.md](./mynacard/README.md)** for detailed instructions.

### For Low-Level PC/SC Operations

Explore direct FFI bindings for maximum control:

```bash
cd examples/pcsc-ffi
npm install
npm run build

# List all connected readers
npm run list-readers

# Send APDU to first reader
npm run send-apdu
```

See **[pcsc-ffi/README.md](./pcsc-ffi/README.md)** for FFI patterns.

### For React Native Mobile Apps

Run the full-featured NFC mobile app:

```bash
cd examples/rn
npm install

# iOS
bundle install
bundle exec pod install
npm run ios

# Android
npm run android
```

See **[rn/README.md](./rn/README.md)** for mobile setup.

## Example Categories

### 1. MynaCard Operations (Node.js)

**Purpose:** Read and parse Japanese government Individual Number Card (MynaCard) data.

**Technologies:** 
- `@aokiapp/jsapdu-pcsc` - PC/SC reader access
- `@aokiapp/mynacard` - MynaCard constants and schemas
- `@aokiapp/apdu-utils` - APDU command builders

**Key Examples:**
- **[read-basic-four.ts](./mynacard/src/kenhojo/read-basic-four.ts)** - Read name, address, birth, gender from health insurance application
- **[read-entries.ts](./mynacard/src/kenkaku/read-entries.ts)** - Read residence certificate with embedded images
- **[read-certificate.ts](./mynacard/src/kenhojo/read-certificate.ts)** - Read digital certificate
- **[read-my-number.ts](./mynacard/src/kenhojo/read-my-number.ts)** - Read Individual Number

**Common Pattern:**
```typescript
// 1. Initialize platform and device
const platform = await getPlatform();
await platform.init();
const device = await platform.acquireDevice(deviceInfo[0].id);
const session = await device.startSession();

// 2. Select application
await session.transmit(selectDf(KENHOJO_AP));

// 3. Verify PIN
await session.transmit(verify(pin, { ef: KENHOJO_AP_EF.PIN }));

// 4. Read data
const response = await session.transmit(readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR));

// 5. Parse TLV data
const parser = new SchemaParser(schemaKenhojoBasicFour);
const parsed = parser.parse(response.arrayBuffer());

// 6. Cleanup
await session.release();
await device.release();
await platform.release();
```

### 2. PC/SC FFI Bindings (Node.js)

**Purpose:** Direct low-level access to PC/SC native libraries for custom reader operations.

**Technologies:**
- `@aokiapp/pcsc-ffi-node` - FFI bindings to winscard.dll/PCSC.framework/libpcsclite

**Key Examples:**
- **[list_readers.ts](./pcsc-ffi/src/list_readers.ts)** - Enumerate connected smart card readers
- **[send_apdu.ts](./pcsc-ffi/src/send_apdu.ts)** - Send raw APDU commands
- **[card_status.ts](./pcsc-ffi/src/card_status.ts)** - Query card presence and ATR
- **[transaction.ts](./pcsc-ffi/src/transaction.ts)** - Atomic transaction blocks

**Common Pattern:**
```typescript
// 1. Establish context
const hContext = [0];
SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);

// 2. List readers
const pcchReaders = [0];
SCardListReaders(hContext[0], null, null, pcchReaders);
const buffer = Buffer.alloc(pcchReaders[0] * charSize);
SCardListReaders(hContext[0], null, buffer, pcchReaders);

// 3. Connect to card
const hCard = [0];
const protocol = [0];
SCardConnect(hContext[0], readerName, SCARD_SHARE_SHARED, 
  SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1, hCard, protocol);

// 4. Transmit APDU
const recv = Buffer.alloc(256);
const recvLen = [256];
SCardTransmit(hCard[0], SCARD_PCI_T1, apdu, apdu.length, null, recv, recvLen);

// 5. Cleanup
SCardDisconnect(hCard[0], SCARD_LEAVE_CARD);
SCardReleaseContext(hContext[0]);
```

### 3. React Native NFC (Mobile)

**Purpose:** Full-featured mobile app demonstrating NFC card reading on iOS and Android.

**Technologies:**
- `@aokiapp/jsapdu-rn` - React Native NFC platform
- React Navigation - Multi-screen navigation
- Custom NFC UI components

**Key Screens:**
- **[MenuScreen.tsx](./rn/src/screens/MenuScreen.tsx)** - Example selection menu
- **[MynaPinScreen.tsx](./rn/src/screens/MynaPinScreen.tsx)** - PIN entry with hex keyboard
- **[MynaReadScreen.tsx](./rn/src/screens/MynaReadScreen.tsx)** - Card reading with progress UI
- **[MynaShowScreen.tsx](./rn/src/screens/MynaShowScreen.tsx)** - Display parsed card data
- **[NfcAntennaScreen.tsx](./rn/src/screens/NfcAntennaScreen.tsx)** - NFC antenna visualization

**Common Pattern:**
```typescript
// 1. Get platform
const platform = platformManager.getPlatform();
await platform.init();

// 2. Acquire NFC device
const devices = await platform.getDeviceInfo();
const device = await platform.acquireDevice(devices[0].id);

// 3. Wait for card presence
await device.waitForCardPresence(30000);

// 4. Start session
const session = await device.startSession();

// 5. Send APDUs
const response = await session.transmit(selectDf(KENHOJO_AP));

// 6. Cleanup (auto-released when card removed)
await session.release();
await device.release();
await platform.release();
```

### 4. E2E Hardware Tests

**Purpose:** Comprehensive hardware testing with real MynaCard.

**Location:** `examples/mynacard-e2e/`

**Documentation:** See [E2E Testing Patterns](../docs/testing/e2e-testing-patterns.md)

**Key Test Suites:**
- **[mynacard.e2e.test.ts](./mynacard-e2e/mynacard.e2e.test.ts)** - Core platform functionality
- **[jpki_ap.test.ts](./mynacard-e2e/jpki_ap.test.ts)** - JPKI application tests
- **[kenhojo_ap.test.ts](./mynacard-e2e/kenhojo_ap.test.ts)** - Health insurance tests
- **[kenkaku_ap.test.ts](./mynacard-e2e/kenkaku_ap.test.ts)** - Residence certificate tests
- **[randr.e2e.test.ts](./mynacard-e2e/randr.e2e.test.ts)** - R&D claims verification

## Prerequisites

### All Examples

- Node.js 18+ or compatible runtime
- TypeScript 5.0+

### MynaCard & PC/SC FFI Examples

**Hardware:**
- PC/SC-compatible smart card reader (e.g., ACS ACR122U, Sony RC-S380)
- Japanese MynaCard (マイナンバーカード) for MynaCard examples

**Software:**
- **Windows:** Built-in WinSCard
- **macOS:** Built-in SmartCard services  
- **Linux:** `pcscd` and `libpcsclite-dev`
  ```bash
  sudo apt-get install pcscd libpcsclite-dev
  ```

### React Native Example

**Development Environment:**
- Complete [React Native environment setup](https://reactnative.dev/docs/environment-setup)
- Xcode 14+ (iOS)
- Android Studio with SDK 31+ (Android)

**Hardware:**
- iPhone 7+ with NFC capability (iOS)
- Android device with NFC support

**Configuration:**
- iOS: Update `Info.plist` with NFC usage description and AIDs
- Android: Add NFC permissions to `AndroidManifest.xml`

## Running Examples

### Option 1: Direct Execution (Recommended)

```bash
# MynaCard examples
cd examples/mynacard
npm install && npm run build
npm run read:kenhojo:basic-four

# PC/SC FFI examples  
cd examples/pcsc-ffi
npm install && npm run build
npm run list-readers

# React Native example
cd examples/rn
npm install
npm run ios  # or npm run android
```

### Option 2: From Workspace Root

```bash
# Build all packages first
npm run build

# Then run examples
cd examples/mynacard && npm run read:kenhojo:basic-four
cd examples/pcsc-ffi && npm run list-readers
cd examples/rn && npm run ios
```

## Example Structure

Each example directory follows this structure:

```
example-name/
├── README.md           # Detailed documentation
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── src/                # Source code
    ├── index.ts        # Entry point (CLI examples)
    └── ...             # Feature-specific files
```

## Common Patterns

### Resource Management

All examples demonstrate proper resource lifecycle:

```typescript
let platform, device, session;
try {
  platform = await getPlatform();
  await platform.init();
  
  device = await platform.acquireDevice(deviceId);
  session = await device.startSession();
  
  // Operations...
  
} catch (error) {
  console.error('Error:', error);
} finally {
  await session?.release();
  await device?.release();
  await platform?.release();
}
```

### Error Handling

```typescript
import { SmartCardError } from '@aokiapp/jsapdu-interface';

try {
  await session.transmit(command);
} catch (error) {
  if (error instanceof SmartCardError) {
    switch (error.code) {
      case 'CARD_NOT_PRESENT':
        console.error('Card removed during operation');
        break;
      case 'TIMEOUT':
        console.error('Operation timed out');
        break;
      default:
        console.error('Smart card error:', error.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Event-Driven Operations

```typescript
const platform = platformManager.getPlatform();

// Subscribe to events
const unsubscribe = platform.on('CARD_FOUND', (event) => {
  console.log('Card detected:', event);
});

// Cleanup
unsubscribe();
```

## Troubleshooting

### PC/SC Examples

**"No readers found"**
- Ensure reader is connected and drivers installed
- Check PC/SC service is running (Linux: `sudo systemctl start pcscd`)

**"Failed to establish context"**
- Windows: Restart Smart Card service
- macOS: Check System Preferences → Security & Privacy
- Linux: `sudo systemctl restart pcscd`

### React Native Example

**iOS: "NFC not available"**
- Requires iPhone 7 or later
- Check NFC entitlements in Xcode
- Verify Info.plist has NFCReaderUsageDescription

**Android: "NFC disabled"**
- Enable NFC in device settings
- Verify NFC permissions in AndroidManifest.xml
- Check device supports ISO-DEP (most modern devices do)

### MynaCard Examples

**"PIN verification failed"**
- Default PIN is 4 digits (health insurance) or 6-16 characters (signature)
- Check remaining attempts before card locks
- Wrong PIN type for the selected application

**"Application not found"**
- Ensure MynaCard is genuine (not test card)
- Some applications require specific card versions

## Next Steps

1. **For beginners**: Start with [mynacard/README.md](./mynacard/README.md) - simplest Node.js examples
2. **For low-level control**: See [pcsc-ffi/README.md](./pcsc-ffi/README.md) - direct FFI access
3. **For mobile development**: Check [rn/README.md](./rn/README.md) - full NFC mobile app
4. **For testing**: Read [E2E Testing Patterns](../docs/testing/e2e-testing-patterns.md) - hardware test methodology

## Related Documentation

- **[Architecture Overview](../docs/architecture/package-interactions.md)** - How packages work together
- **[E2E Testing Patterns](../docs/testing/e2e-testing-patterns.md)** - Hardware testing methodology
- **[@aokiapp/jsapdu-pcsc](../packages/pcsc/README.md)** - PC/SC platform API
- **[@aokiapp/jsapdu-rn](../packages/rn/README.md)** - React Native NFC API
- **[@aokiapp/mynacard](../packages/mynacard/README.md)** - MynaCard constants and schemas

## Contributing

When adding new examples:
1. Follow the existing directory structure
2. Include a detailed README.md
3. Add error handling and resource cleanup
4. Document hardware/software requirements
5. Test on multiple platforms when applicable
6. Update this README.md with links

## License

ANAL-Tight-1.0.1 - See [LICENSE](../LICENSE.md)
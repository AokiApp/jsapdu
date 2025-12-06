# Package Architecture & Interactions

This document explains how the jsapdu packages work together to provide a complete smart card communication stack from low-level FFI bindings to high-level application APIs.

## Package Dependency Graph

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  @aokiapp/      │    │    @aokiapp/     │    │   @aokiapp/     │
│  jsapdu-rn      │    │   jsapdu-pcsc    │    │  mynacard       │
│  (React Native) │    │   (Node.js)      │    │ (Card-specific) │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                   ┌─────────────▼────────────┐
                   │   jsapdu-interface       │
                   │      @aokiapp/           │
                   │   (Core abstractions)    │
                   └─────────────┬────────────┘
                                 │
                   ┌─────────────▼────────────┐
                   │      @aokiapp/           │
                   │    apdu-utils            │
                   │ (Command builders)       │
                   └──────────────────────────┘

                    ┌──────────────────────────┐
                    │      @aokiapp/           │
                    │  pcsc-ffi-node           │
                    │  (FFI bindings)          │
                    └─────────────┬────────────┘
                                  │
                    ┌─────────────▼────────────┐
                    │   Native PC/SC           │
                    │ (winscard.dll,           │
                    │  PCSC.framework,         │
                    │  libpcsclite)            │
                    └──────────────────────────┘
```

## Abstraction Layers

### Layer 1: Native Platform
**Responsibility:** Raw PC/SC API access
**Package:** System libraries (winscard.dll, PCSC.framework, libpcsclite)

### Layer 2: FFI Bindings  
**Responsibility:** Node.js ↔ Native PC/SC bridge
**Package:** `@aokiapp/pcsc-ffi-node`
**Key exports:**
- `SCardEstablishContext`, `SCardConnect`, `SCardTransmit`
- `PcscErrorCode`, `pcsc_stringify_error`
- Platform-specific constants and structures

### Layer 3: Core Abstractions
**Responsibility:** Platform-agnostic smart card interfaces
**Package:** `@aokiapp/jsapdu-interface`  
**Key exports:**
- `CommandApdu`, `ResponseApdu` - APDU command/response classes
- `SmartCardPlatform`, `SmartCardDevice`, `SmartCard` - Abstract base classes
- `SmartCardError` - Unified error handling

### Layer 4: Command Utilities
**Responsibility:** Ready-to-use APDU command builders
**Package:** `@aokiapp/apdu-utils`
**Key exports:**
- `select`, `selectDf`, `selectEf` - File selection commands
- `readBinary`, `readEfBinaryFull` - Data reading commands  
- `verify` - PIN verification commands

### Layer 5: Platform Implementations
**Responsibility:** Concrete platform integrations
**Packages:** 
- `@aokiapp/jsapdu-pcsc` (Node.js via PC/SC)
- `@aokiapp/jsapdu-rn` (React Native via NFC)

### Layer 6: Card-Specific Logic
**Responsibility:** Card type specializations
**Package:** `@aokiapp/mynacard`
**Key exports:**
- Application identifiers (`JPKI_AP`, `KENHOJO_AP`, `KENKAKU_AP`)
- File identifiers (`JPKI_AP_EF`, `KENHOJO_AP_EF`, etc.)
- TLV schemas for parsing card data

## Data Flow Examples

### Example 1: Reading MynaCard Certificate (Node.js)

```typescript
// Layer 6: Card-specific constants
import { JPKI_AP, JPKI_AP_EF } from '@aokiapp/mynacard';

// Layer 4: Command builders  
import { selectDf, readEfBinaryFull } from '@aokiapp/apdu-utils';

// Layer 5: Platform implementation
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';

async function readJpkiCert() {
  // Platform → Device → Card session
  const platform = PcscPlatformManager.getInstance().getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  const device = await platform.acquireDevice(devices[0].id);
  const card = await device.startSession();
  
  // Layer 6 → Layer 4: Card constants → APDU commands
  const selectCmd = selectDf(JPKI_AP);
  await card.transmit(selectCmd);
  
  // Layer 4: Utility function uses Layer 3 abstractions
  const certData = await readEfBinaryFull(JPKI_AP_EF.AUTH_CERT, card);
  
  return certData;
}
```

**Flow breakdown:**
1. **Layer 6** provides `JPKI_AP` constant
2. **Layer 4** `selectDf()` creates `CommandApdu` (Layer 3)
3. **Layer 5** `PcscCard.transmit()` converts to bytes
4. **Layer 2** `SCardTransmit()` sends to native
5. **Layer 1** Native PC/SC communicates with card
6. Response flows back up through all layers

### Example 2: React Native NFC Transaction

```typescript
import { platformManager } from '@aokiapp/jsapdu-rn';
import { CommandApdu } from '@aokiapp/jsapdu-interface';
import { KENHOJO_AP } from '@aokiapp/mynacard';
import { selectDf, verify } from '@aokiapp/apdu-utils';

async function nfcTransaction() {
  // Layer 5: RN platform
  const platform = platformManager.getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  const device = await platform.acquireDevice(devices[0].id);
  
  await device.waitForCardPresence(10000);
  const card = await device.startSession();
  
  // Layer 6 + 4: Card constant + command builder
  await card.transmit(selectDf(KENHOJO_AP));
  
  // Layer 4 + 3: Utility creates CommandApdu
  await card.transmit(verify("1234"));
  
  // Layer 3: Direct APDU creation
  const readCmd = new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 256);
  const response = await card.transmit(readCmd);
  
  return response.data;
}
```

## Error Propagation

Errors flow upward through the layers with increasing abstraction:

```
Layer 1: Native error (e.g., SCARD_W_REMOVED_CARD)
    ↓
Layer 2: PcscErrorCode enum + pcsc_stringify_error()  
    ↓
Layer 3: SmartCardError("CARD_NOT_PRESENT", "PC/SC Error: ...")
    ↓
Layer 5: Platform catches, may wrap with additional context
    ↓
Layer 6: Application handles with user-friendly messaging
```

### Error Mapping Chain

**PC/SC Platform:**
```typescript
// Layer 2: FFI returns native error code
const ret = SCardTransmit(cardHandle, ...);

// Layer 2→3: Map to SmartCardError
if (ret !== SCARD_S_SUCCESS) {
  throw pcscErrorToSmartCardError(ret);
}
```

**React Native Platform:**
```typescript
// Layer 5: Catch native exceptions
try {
  await hybridObject.transmit(cardHandle, apdu);
} catch (error) {
  // Layer 5→3: Map Android/iOS errors to SmartCardError
  throw mapNitroError(error);
}
```

## Cross-Package Integration Patterns

### 1. Plugin Architecture
Each platform package implements the same interface:

```typescript
// All platforms implement these base classes
class SomePlatform extends SmartCardPlatform {
  async init(): Promise<void> { /* platform-specific */ }
  async getDeviceInfo(): Promise<DeviceInfo[]> { /* platform-specific */ }
  async acquireDevice(id: string): Promise<SmartCardDevice> { /* platform-specific */ }
}

class SomeDevice extends SmartCardDevice {
  async startSession(): Promise<SmartCard> { /* platform-specific */ }
}

class SomeCard extends SmartCard {
  async transmit(apdu: CommandApdu): Promise<ResponseApdu> { /* platform-specific */ }
}
```

### 2. Shared Command Logic
APDU utilities work across all platforms:

```typescript
// Same command builder works for PC/SC and React Native
const cmd = selectDf(JPKI_AP);

// PC/SC usage
await pcscCard.transmit(cmd);

// React Native usage  
await rnCard.transmit(cmd);
```

### 3. Card-Agnostic Parsing
MynaCard schemas work with data from any transport:

```typescript
// Data from PC/SC or NFC - parsing is identical
const parser = new SchemaParser(schemaKenhojoBasicFour);
const parsed = parser.parse(rawBytes.buffer);
```

## Event System Architecture

Events bubble up through the layers to provide real-time feedback:

```typescript
// Layer 5: Platform events
platform.on('PLATFORM_INITIALIZED', () => { });
platform.on('DEVICE_ACQUIRED', () => { });

// Layer 5: Device events  
device.on('CARD_FOUND', () => { });
device.on('CARD_LOST', () => { });

// Layer 5: Card events
card.on('APDU_SENT', (apdu) => { });
card.on('APDU_FAILED', (error) => { });
```

Events are emitted by platform implementations and can be consumed by applications for UI updates, logging, analytics, etc.

## Testing Strategy by Layer

### Layer 2 (FFI): Integration Tests
```typescript
// Test actual PC/SC communication
test('should list real readers', () => {
  const readers = callSCardListReaders(context);
  expect(readers).toBeInstanceOf(Array);
});
```

### Layer 3 (Interface): Unit Tests  
```typescript
// Test APDU parsing/construction
test('should create valid extended APDU', () => {
  const cmd = new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 4096);
  expect(cmd.toUint8Array()).toEqual([0x00, 0xB0, 0x00, 0x00, 0x00, 0x10, 0x00]);
});
```

### Layer 4 (Utils): Unit + Integration Tests
```typescript
// Test command builders + real card interaction
test('should select DF successfully', async () => {
  const cmd = selectDf(JPKI_AP);
  const response = await card.transmit(cmd);
  expect(response.isSuccess()).toBe(true);
});
```

### Layer 5 (Platforms): E2E Tests
```typescript
// Test complete workflows
test('should read MynaCard certificate end-to-end', async () => {
  const platform = PcscPlatformManager.getInstance().getPlatform();
  // ... full workflow test
});
```

### Layer 6 (Card-specific): Schema Tests
```typescript
// Test TLV schema parsing with real data
test('should parse Kenhojo BasicFour correctly', () => {
  const parser = new SchemaParser(schemaKenhojoBasicFour);
  const result = parser.parse(realCardData);
  expect(result.name).toMatch(/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/); // Japanese characters
});
```

This layered architecture ensures clean separation of concerns while allowing each package to focus on its specific domain expertise.
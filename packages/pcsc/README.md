# @aokiapp/jsapdu-pcsc

PC/SC Smart Card Platform Implementation for Windows, macOS, and Linux desktop environments.

## Overview

This package provides a complete PC/SC implementation of the jsapdu SmartCard abstractions, enabling communication with USB SmartCard readers and contactless readers on desktop platforms.

## Installation

```bash
npm install @aokiapp/jsapdu-pcsc @aokiapp/jsapdu-interface
```

## Quick Start

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { CommandApdu } from "@aokiapp/jsapdu-interface";

async function example() {
  // Get platform instance (singleton)
  const manager = PcscPlatformManager.getInstance();
  const platform = manager.getPlatform();

  // Initialize PC/SC context
  await platform.init();

  try {
    // List available readers
    const devices = await platform.getDeviceInfo();
    console.log(
      "Available readers:",
      devices.map((d) => d.friendlyName),
    );

    // Connect to first reader
    const device = await platform.acquireDevice(devices[0].id);

    // Check card presence
    if (await device.isCardPresent()) {
      // Start card session
      const card = await device.startSession();

      // Get card ATR
      const atr = await card.getAtr();
      console.log("ATR:", Buffer.from(atr).toString("hex"));

      // Send APDU command
      const command = new CommandApdu(
        0x00,
        0xa4,
        0x04,
        0x00,
        Buffer.from("A0000000041010", "hex"),
      );
      const response = await card.transmit(command);

      console.log("Response SW:", response.sw.toString(16));

      await card.release();
    }

    await device.release();
  } finally {
    await platform.release();
  }
}
```

## Platform Manager

### PcscPlatformManager

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";

// Singleton pattern - always get the same instance
const manager = PcscPlatformManager.getInstance();
const platform = manager.getPlatform();
```

## Platform Operations

### Initialization

```typescript
// Initialize PC/SC context (required before any operations)
await platform.init();

// Check if initialized
if (platform.isInitialized()) {
  // Platform is ready
}
```

### Device Discovery

```typescript
// Get all available card readers
const deviceInfos = await platform.getDeviceInfo();

for (const info of deviceInfos) {
  console.log("Reader:", info.friendlyName);
  console.log("Path:", info.devicePath);
  console.log("Supports APDU:", info.supportsApdu);
  console.log("Protocol:", info.d2cProtocol, "over", info.p2dProtocol);
}
```

### Device Acquisition

```typescript
// Acquire exclusive access to a reader
const device = await platform.acquireDevice(deviceInfo.id);

// Check device availability
const isAvailable = await device.isDeviceAvailable();

// Check card presence
const hasCard = await device.isCardPresent();
```

## Device Operations

### Session Management

```typescript
// Start card communication session
const card = await device.startSession();

// Check if session is active
if (device.isSessionActive()) {
  // Session is running
}

// Wait for card insertion (blocking)
await device.waitForCardPresence(30000); // 30 second timeout
```

### Card Communication

```typescript
// Get Answer To Reset (ATR)
const atr = await card.getAtr();

// Send APDU commands
const command = new CommandApdu(0x00, 0xb0, 0x00, 0x00, null, 256);
const response = await card.transmit(command);

// Reset card
await card.reset();
```

## Resource Management

### Automatic Cleanup

```typescript
async function withAutoCleanup() {
  const manager = PcscPlatformManager.getInstance();

  // Automatic resource cleanup with Symbol.asyncDispose
  await using platform = manager.getPlatform();
  await platform.init();

  await using device = await platform.acquireDevice(deviceId);
  await using card = await device.startSession();

  // Use card...
  // Resources automatically released when scope exits
}
```

### Manual Cleanup

```typescript
async function withManualCleanup() {
  let platform, device, card;

  try {
    platform = manager.getPlatform();
    await platform.init();

    device = await platform.acquireDevice(deviceId);
    card = await device.startSession();

    // Use card...
  } finally {
    // Clean up in reverse order
    await card?.release();
    await device?.release();
    await platform?.release();
  }
}
```

## Error Handling

### PC/SC Specific Errors

```typescript
import { SmartCardError } from "@aokiapp/jsapdu-interface";

try {
  await card.transmit(command);
} catch (error) {
  if (error instanceof SmartCardError) {
    switch (error.code) {
      case "NO_READERS":
        console.log("No card readers found - check hardware connection");
        break;
      case "READER_ERROR":
        console.log("Card reader error - check driver installation");
        break;
      case "CARD_NOT_PRESENT":
        console.log("Please insert a SmartCard");
        break;
      case "ALREADY_CONNECTED":
        console.log("Reader is already in use");
        break;
      case "PLATFORM_ERROR":
        console.log("PC/SC system error:", error.message);
        break;
    }
  }
}
```

### Common Issues

- **"Platform not initialized"**: Call `await platform.init()` first
- **"No card readers found"**: Check hardware connection and drivers
- **"Already connected"**: Another process is using the reader
- **"Card not present"**: Insert a SmartCard into the reader

## Platform Details

### Supported Systems

- **Windows**: Uses WinSCard.dll via PC/SC
- **macOS**: Uses PC/SC framework
- **Linux**: Uses libpcsclite via PC/SC

### Supported Readers

- USB CCID-compliant readers
- Built-in contactless readers (NFC)
- External contactless readers
- Multi-slot readers

### Protocol Support

- **Contact**: ISO 7816 T=0, T=1
- **Contactless**: ISO 14443 Type A/B via PC/SC
- **Protocols**: Automatic protocol negotiation

## Advanced Usage

### Reader State Monitoring

```typescript
// Check detailed reader state
const readerState = await getReaderCurrentState(context, readerName);
console.log("State flags:", readerState.state);
console.log("ATR changed:", readerState.atrChanged);
```

### Transaction Control

```typescript
// Manual transaction management (advanced)
await card.beginTransaction();
try {
  await card.transmit(command1);
  await card.transmit(command2);
} finally {
  await card.endTransaction();
}
```

### Multiple Readers

```typescript
// Work with multiple readers simultaneously
const devices = await platform.getDeviceInfo();
const sessions = [];

for (const deviceInfo of devices) {
  if (await deviceInfo.isCardPresent()) {
    const device = await platform.acquireDevice(deviceInfo.id);
    const card = await device.startSession();
    sessions.push({ deviceInfo, device, card });
  }
}

// Use all cards...

// Cleanup
for (const session of sessions) {
  await session.card.release();
  await session.device.release();
}
```

## Debugging

### Enable PC/SC Logging

```bash
# Windows - Enable PC/SC logging
sc config SCardSvr depend= EventLog

# Linux - Install PC/SC daemon with debug
sudo apt-get install pcscd pcsc-tools
sudo pcscd -f -d  # Run in foreground with debug
```

### Common Diagnostics

```typescript
// Check PC/SC service status
try {
  await platform.init();
  console.log("PC/SC service is running");
} catch (error) {
  console.log("PC/SC service issue:", error.message);
}

// List readers from command line
// Windows: certlm.msc -> Personal -> Certificates
// Linux: pcsc_scan
// macOS: system_profiler SPUSBDataType
```

## Dependencies

- [`@aokiapp/jsapdu-interface`](../interface) - Core abstractions
- [`@aokiapp/pcsc-ffi-node`](../pcsc-ffi-node) - Native PC/SC bindings

## Related Packages

- [`@aokiapp/apdu-utils`](../apdu-utils) - APDU command utilities
- [`@aokiapp/mynacard`](../mynacard) - Japanese MynaCard support

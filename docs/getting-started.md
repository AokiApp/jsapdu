# Getting Started with jsapdu

## Installation

```bash
npm install @aokiapp/jsapdu-interface @aokiapp/jsapdu-pcsc @aokiapp/apdu-utils @aokiapp/mynacard
```

## Basic Usage

Here's a simple example of using jsapdu to communicate with a smart card:

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { selectDf } from "@aokiapp/apdu-utils";

async function main() {
  // Initialize the platform
  const manager = PcscPlatformManager.getInstance();
  const platform = manager.getPlatform();
  await platform.init();

  try {
    // Get available devices
    const deviceInfos = await platform.getDeviceInfo();
    if (deviceInfos.length === 0) {
      console.log("No card readers found");
      return;
    }

    // Acquire the first device
    const device = await platform.acquireDevice(deviceInfos[0].id);

    // Start a session with the card
    const card = await device.startSession();

    // Get card ATR
    const atr = await card.getAtr();
    console.log(
      "Card ATR:",
      Array.from(atr).map((b) => b.toString(16).padStart(2, "0")).join(""),
    );

    // Send a command to select an application
    const response = await card.transmit(selectDf("A0000000041010", true));
    console.log("Status Word:", response.sw.toString(16));
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
  } finally {
    // Clean up resources
    await platform.release();
  }
}

main();
```

## Key Concepts

### Platform Manager

The platform manager is responsible for creating platform instances. Each supported platform (PC/SC, NFC, etc.) has its own manager:

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";

const manager = PcscPlatformManager.getInstance();
```

### Platform

The platform represents the smart card communication system:

```typescript
const platform = manager.getPlatform();
await platform.init();
```

### Device

A device represents a card reader:

```typescript
const infos = await platform.getDeviceInfo();
const device = await platform.acquireDevice(infos[0].id);
```

### Card Session

A card session represents an active connection to a smart card:

```typescript
const card = await device.startSession();
```

### APDU Commands

APDU (Application Protocol Data Unit) commands are used to communicate with the card:

```typescript
import { CommandApdu } from "@aokiapp/jsapdu-interface";

const command = new CommandApdu({
  cla: 0x00, // Class byte
  ins: 0xa4, // Instruction byte
  p1: 0x04, // Parameter 1
  p2: 0x00, // Parameter 2
  data: Buffer.from("A0000000041010", "hex"), // Command data
});
```

## Resource Management

jsapdu supports modern resource management using `Symbol.asyncDispose`:

```typescript
async function example() {
  const manager = PcscPlatformManager.getInstance();

  await using platform = manager.getPlatform();
  await platform.init();

  const infos = await platform.getDeviceInfo();
  await using device = await platform.acquireDevice(infos[0].id);
  await using card = await device.startSession();

  // Resources will be automatically released
}
```

## Error Handling

jsapdu provides structured error handling:

```typescript
try {
  const devices = await platform.getDeviceInfo();
  // ...
} catch (error) {
  if (error instanceof SmartCardError) {
    switch (error.code) {
      case "NO_READERS":
        console.error("No card readers found");
        break;
      case "CARD_NOT_PRESENT":
        console.error("Please insert a card");
        break;
      default:
        console.error("Error:", error.message);
    }
  }
}
```

## Next Steps

- Read the [Architecture Guide](./architecture/README.md) for a deeper understanding
- Check out repository examples under ../examples/mynacard and ../examples/mynacard-e2e
- See the [API Reference](./api/README.md) for detailed API documentation

# Getting Started with jsapdu

## Installation

```bash
npm install @aokiapp/jsapdu
```

## Basic Usage

Here's a simple example of using jsapdu to communicate with a smart card:

```typescript
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";

async function main() {
  // Initialize the platform
  const manager = new PcscPlatformManager();
  const platform = manager.getPlatform();
  await platform.init();

  try {
    // Get available devices
    const devices = await platform.getDevices();
    if (devices.length === 0) {
      console.log("No card readers found");
      return;
    }

    // Connect to the first device
    const device = await devices[0].acquireDevice();

    // Start a session with the card
    const card = await device.startSession();

    // Get card ATR
    const atr = await card.getAtr();
    console.log("Card ATR:", Buffer.from(atr).toString("hex"));

    // Send a command to select an application
    const selectCommand = new CommandApdu({
      cla: 0x00,
      ins: 0xa4,
      p1: 0x04,
      p2: 0x00,
      data: Buffer.from("A0000000041010", "hex"),
    });

    const response = await card.transmit(selectCommand);
    console.log("Response:", response.toString());
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

const manager = new PcscPlatformManager();
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
const devices = await platform.getDevices();
const device = await devices[0].acquireDevice();
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
  const manager = new PcscPlatformManager();

  await using platform = manager.getPlatform();
  await platform.init();

  await using device = (await platform.getDevices())[0].acquireDevice();
  await using card = await device.startSession();

  // Resources will be automatically released
}
```

## Error Handling

jsapdu provides structured error handling:

```typescript
try {
  const devices = await platform.getDevices();
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
- Check out the [Examples](./examples/README.md) for more usage patterns
- See the [API Reference](./api/README.md) for detailed API documentation

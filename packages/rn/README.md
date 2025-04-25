# @aokiapp/rn

Android NFC implementation for jsapdu using Expo Modules API (EMA).

## Features

- Android NFC support for the jsapdu library
- Uses the New Architecture with Expo Modules API (EMA)
- Implements the abstract classes defined in the interface package
- Supports both APDU communication and Host Card Emulation (HCE)

## Installation

```bash
npm install @aokiapp/rn
```

## Usage

```typescript
import { AndroidPlatformManager } from "@aokiapp/rn";

// Create a platform manager
const platformManager = new AndroidPlatformManager();

// Get the platform
const platform = platformManager.getPlatform();

// Initialize the platform
await platform.init();

// Get available devices
const devices = await platform.getDevices();

// Acquire a device
const device = await devices[0].acquireDevice();

// Check if a card is present
const isCardPresent = await device.isCardPresent();

// Start a session with the card
const card = await device.startSession();

// Get the ATR
const atr = await card.getAtr();

// Transmit an APDU command
const response = await card.transmit(
  new CommandApdu(0x00, 0xa4, 0x04, 0x00, [0x01, 0x02, 0x03, 0x04]),
);

// Release resources
await card.release();
await device.release();
await platform.release();
```

## Host Card Emulation (HCE)

```typescript
import { AndroidPlatformManager } from "@aokiapp/rn";

// Create a platform manager
const platformManager = new AndroidPlatformManager();

// Get the platform
const platform = platformManager.getPlatform();

// Initialize the platform
await platform.init();

// Get available devices
const devices = await platform.getDevices();

// Acquire a device
const device = await devices[0].acquireDevice();

// Start an HCE session
const emulatedCard = await device.startHceSession();

// Set an APDU handler
await emulatedCard.setApduHandler(async (command) => {
  // Process the command and return a response
  return new Uint8Array([0x90, 0x00]); // SW_SUCCESS
});

// Set a state change handler
await emulatedCard.setStateChangeHandler((state) => {
  console.log("HCE state changed:", state);
});

// Release resources when done
await emulatedCard.release();
await device.release();
await platform.release();
```

## Requirements

- Android API level 21+ (Android 5.0 Lollipop or higher)
- NFC-enabled device
- React Native with New Architecture enabled
- Expo SDK 48 or higher

## License

[License Type] - See LICENSE file for details

# React Native NFC Example App

Full-featured React Native application demonstrating NFC smart card reading on iOS and Android using `@aokiapp/jsapdu-rn`.

## Overview

This example is a complete mobile app showcasing:

- **NFC card detection** with visual feedback
- **MynaCard reading** with PIN entry using custom hex keyboard
- **Multi-screen navigation** with React Navigation
- **Event-driven architecture** for card lifecycle management
- **Production-ready UI** with animated overlays and status indicators
- **Cross-platform support** (iOS 7+ and Android with NFC)

## Features

### Core Functionality

1. **Smart Card Platform Test** - Test NFC device availability and basic operations
2. **NFC Antenna Visualization** - Visual guide for optimal card positioning
3. **MynaCard Reader** - Complete flow for reading Japanese Individual Number Cards:
   - PIN entry with custom hex keyboard
   - Card reading with progress indicators
   - Data parsing and display
4. **Real-time Events** - Card found/lost detection with UI updates

### UI Components

- **[MenuScreen](./src/screens/MenuScreen.tsx)** - Example selection menu
- **[MynaPinScreen](./src/screens/MynaPinScreen.tsx)** - PIN entry with masked input and hex keyboard
- **[MynaReadScreen](./src/screens/MynaReadScreen.tsx)** - Card reading with animated bottom sheet and status overlay
- **[MynaShowScreen](./src/screens/MynaShowScreen.tsx)** - Display parsed card data
- **[NfcAntennaScreen](./src/screens/NfcAntennaScreen.tsx)** - NFC antenna position visualization
- **[SmartCardTestScreen](./src/screens/SmartCardTestScreen.tsx)** - Platform capability testing
- **[HexTextInput](./src/components/HexTextInput/)** - Custom hex keyboard for PIN entry

## Prerequisites

### Development Environment

Complete the [React Native environment setup](https://reactnative.dev/docs/environment-setup) for your platform:

**For iOS:**
- macOS with Xcode 14+
- CocoaPods via Ruby bundler
- iOS Simulator or iPhone 7+ physical device

**For Android:**
- Android Studio with SDK 31+
- Android Emulator or physical device with NFC

### Hardware Requirements

**iOS:**
- iPhone 7 or later (NFC capability)
- iOS 13.0+ for Core NFC support

**Android:**
- Device with NFC hardware
- Android 5.0+ (API level 21+)
- NFC must be enabled in device settings

### Software Dependencies

- Node.js 18.0+
- React Native 0.74+
- TypeScript 5.0+

## Installation

### 1. Install Dependencies

```bash
cd examples/rn
npm install
```

### 2. iOS Setup

Install Ruby dependencies and CocoaPods:

```bash
# First time only: install bundler dependencies
bundle install

# Install or update iOS native dependencies
bundle exec pod install --project-directory=ios
```

**Configure Info.plist:**

Add to `ios/JsapduRnExample/Info.plist`:

```xml
<!-- NFC Permission -->
<key>NFCReaderUsageDescription</key>
<string>This app uses NFC to read smart cards</string>

<!-- Allowed AIDs (Application IDs) -->
<key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
<array>
  <string>A0000001514352530000</string>  <!-- Example AID -->
  <string>D392F000260100000001</string>  <!-- JPKI Application -->
  <string>D392F000260100000002</string>  <!-- KENHOJO Application -->
  <string>D392F000260100000003</string>  <!-- KENKAKU Application -->
</array>
```

**Enable NFC Capability in Xcode:**

1. Open `ios/JsapduRnExample.xcworkspace` in Xcode
2. Select project → Signing & Capabilities
3. Click "+ Capability" → Add "Near Field Communication Tag Reading"
4. Ensure provisioning profile supports NFC

### 3. Android Setup

**Add Permissions to AndroidManifest.xml:**

File: `android/app/src/main/AndroidManifest.xml`

```xml
<!-- NFC Permissions -->
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

## Running the App

### iOS

```bash
# Start Metro bundler
npm start

# In another terminal, build and run iOS app
npm run ios

# Or run on specific device
npm run ios -- --device "Your iPhone Name"
```

**Troubleshooting iOS:**
- If build fails, try: `cd ios && pod deintegrate && pod install && cd ..`
- For signing issues, open Xcode and configure signing settings
- Ensure NFC capability is enabled in project settings

### Android

```bash
# Start Metro bundler
npm start

# In another terminal, build and run Android app
npm run android

# Or run on specific device
npm run android -- --deviceId YOUR_DEVICE_ID
```

**Troubleshooting Android:**
- Ensure NFC is enabled: Settings → Connected devices → Connection preferences → NFC
- If build fails, try: `cd android && ./gradlew clean && cd ..`
- Check USB debugging is enabled for physical devices

## App Structure

```
rn/
├── android/                 # Android native code
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       └── java/aokiapp/jsapdurn/example/
├── ios/                     # iOS native code
│   └── JsapduRnExample/
│       ├── Info.plist
│       └── AppDelegate.swift
├── src/
│   ├── App.tsx             # Root navigation setup
│   ├── components/         # Reusable UI components
│   │   └── HexTextInput/   # Custom hex keyboard
│   ├── screens/            # Screen components
│   │   ├── MenuScreen.tsx
│   │   ├── MynaPinScreen.tsx
│   │   ├── MynaReadScreen.tsx
│   │   ├── MynaShowScreen.tsx
│   │   ├── NfcAntennaScreen.tsx
│   │   └── SmartCardTestScreen.tsx
│   └── types/              # TypeScript type definitions
│       └── myna.ts
├── package.json
└── tsconfig.json
```

## Key Implementation Patterns

### 1. Platform Initialization

```typescript
import { platformManager } from '@aokiapp/jsapdu-rn';

// Get singleton platform instance
const platform = platformManager.getPlatform();

// Initialize NFC
await platform.init();

// Get available NFC devices (usually one integrated NFC)
const devices = await platform.getDeviceInfo();

// Acquire device
const device = await platform.acquireDevice(devices[0].id);
```

### 2. Event-Driven Card Detection

```typescript
// Subscribe to device events
const unsubscribe = device.on('CARD_FOUND', (event) => {
  console.log('Card detected!', event);
  // Start reading...
});

// Wait for card presence
await device.waitForCardPresence(30000); // 30 second timeout

// Cleanup
unsubscribe();
```

### 3. Card Reading Flow

```typescript
// Start session when card is present
const session = await device.startSession();

// Send APDU commands
const response = await session.transmit(
  selectDf(KENHOJO_AP)
);

// Verify PIN
const verifyResp = await session.transmit(
  verify(pin, { ef: KENHOJO_AP_EF.PIN })
);

// Read data
const dataResp = await session.transmit(
  readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR)
);

// Parse TLV data
const parser = new SchemaParser(schemaKenhojoBasicFour);
const parsed = parser.parse(dataResp.arrayBuffer());

// Cleanup
await session.release();
await device.release();
await platform.release();
```

### 4. Resource Cleanup Pattern

```typescript
let platform, device, session;

try {
  platform = platformManager.getPlatform();
  await platform.init();
  
  device = await platform.acquireDevice(deviceId);
  session = await device.startSession();
  
  // Operations...
  
} catch (error) {
  console.error('Error:', error);
} finally {
  // Always cleanup in reverse order
  await session?.release();
  await device?.release();
  await platform?.release();
}
```

### 5. Navigation with Cleanup

```typescript
// Add navigation listener for back button
navigation.addListener('beforeRemove', (e) => {
  if (isReadingCard) {
    // Prevent navigation and cleanup first
    e.preventDefault();
    cleanupResources().then(() => {
      navigation.dispatch(e.data.action);
    });
  }
});
```

## Screen Implementations

### MynaReadScreen - Complete Card Reading Flow

**File:** [`src/screens/MynaReadScreen.tsx`](./src/screens/MynaReadScreen.tsx)

**Features:**
- Phase-based state machine (INITIALIZING → ACQUIRING_DEVICE → WAITING_FOR_CARD → READING → COMPLETED)
- Animated bottom sheet with glow effects
- Real-time status updates
- Automatic navigation after card removal
- Comprehensive error handling
- Event-driven card lifecycle management

**Key States:**
```typescript
type Phase = 
  | 'IDLE'
  | 'INITIALIZING'
  | 'ACQUIRING_DEVICE'
  | 'WAITING_FOR_CARD'
  | 'STARTING_SESSION'
  | 'READING'
  | 'COMPLETED';
```

**Event Handling:**
```typescript
// Platform events
platform.on('PLATFORM_INITIALIZED', handler);
platform.on('DEVICE_ACQUIRED', handler);

// Device events
device.on('CARD_FOUND', handler);
device.on('CARD_LOST', handler);
device.on('CARD_SESSION_STARTED', handler);

// Card events
card.on('APDU_SENT', handler);
card.on('APDU_FAILED', handler);
```

### MynaPinScreen - PIN Entry with Hex Keyboard

**File:** [`src/screens/MynaPinScreen.tsx`](./src/screens/MynaPinScreen.tsx)

**Features:**
- Custom hex keyboard (0-9, A-F)
- Masked PIN display (asterisks)
- Backspace support
- Clear button
- Auto-submission on 4-digit entry
- Context-aware keyboard provider

### NfcAntennaScreen - Positioning Guide

**File:** [`src/screens/NfcAntennaScreen.tsx`](./src/screens/NfcAntennaScreen.tsx)

**Features:**
- Visual guide for NFC antenna location
- Device-specific antenna positions
- Animated card placement indicator
- Helps users understand optimal card positioning

## Troubleshooting

### iOS Issues

**"NFC not available"**
- Requires iPhone 7 or later
- iOS 13.0+ for Core NFC
- Check NFC capability in Xcode signing settings

**"NFC Session Failed"**
- Verify Info.plist has `NFCReaderUsageDescription`
- Ensure AIDs are listed in `com.apple.developer.nfc.readersession.iso7816.select-identifiers`
- Check NFC capability is enabled in provisioning profile

**"Build Failed"**
```bash
# Clean and rebuild
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### Android Issues

**"NFC is disabled"**
- Enable NFC: Settings → Connected devices → NFC
- Verify NFC permission in AndroidManifest.xml

**"Reader Mode Not Working"**
- Requires Android 5.0+ (API 21+)
- Some devices have limited ISO-DEP support
- Try with different card or reader app

**"Build Failed"**
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npm run android
```

### Common Runtime Errors

**"Platform already initialized"**
```typescript
// Always release before re-initializing
await platform.release();
await platform.init();
```

**"Card removed during operation"**
```typescript
// Handle CARD_LOST event
device.on('CARD_LOST', () => {
  // Update UI, cleanup session
});
```

**"PIN verification failed"**
- Check PIN is correct (4 digits for MynaCard)
- Monitor remaining attempts to avoid lockout
- Parse SW1SW2 for retry count: `(sw & 0xFFF0) === 0x63C0 ? sw2 & 0x0F : null`

## Development Tips

### Hot Reload

- Save file → Metro automatically reloads
- Shake device or press Cmd+D (iOS) / Cmd+M (Android) for dev menu
- Use "Reload" for state reset

### Debugging

**React Native Debugger:**
```bash
# Install globally
npm install -g react-native-debugger

# Start debugger
react-native-debugger
```

**Chrome DevTools:**
- Open dev menu → "Debug"
- Navigate to `chrome://inspect`

**Native Logs:**
```bash
# iOS
npx react-native log-ios

# Android
npx react-native log-android
```

### Testing on Physical Devices

**iOS:**
1. Connect iPhone via USB
2. Trust computer on device
3. Run: `npm run ios -- --device`

**Android:**
1. Enable Developer Options + USB Debugging
2. Connect via USB
3. Run: `adb devices` to verify
4. Run: `npm run android`

## Related Documentation

- **[Examples Overview](../README.md)** - All available examples
- **[@aokiapp/jsapdu-rn Package](../../packages/rn/README.md)** - React Native NFC API reference
- **[@aokiapp/mynacard Package](../../packages/mynacard/README.md)** - MynaCard constants and schemas
- **[Nitro Error Mapping](../../packages/rn/docs/nitro-error-mapping.md)** - Error handling strategy
- **[React Native Docs](https://reactnative.dev/docs/getting-started)** - Official React Native documentation

## Contributing

When modifying this example:
1. Follow React Native best practices
2. Use TypeScript for type safety
3. Implement proper resource cleanup
4. Handle both iOS and Android platforms
5. Test on physical devices with NFC
6. Document new screens or components

## License

ANAL-Tight-1.0.1 - See [LICENSE](../../LICENSE.md)
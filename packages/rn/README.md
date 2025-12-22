# @aokiapp/jsapdu-rn

React Native NFC smart card library for iOS and Android.

## Installation

```bash
npm install @aokiapp/jsapdu-rn
```

### iOS Setup

```bash
cd ios && pod install
```

Add to `Info.plist`:
```xml
<key>NFCReaderUsageDescription</key>
<string>This app uses NFC to read smart cards</string>
<key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
<array>
  <string>A0000001514352530000</string>
  <string>D392F000260100000001</string>
</array>
```

### Android Setup

Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

## Quick Start

```typescript
import { platformManager } from '@aokiapp/jsapdu-rn';

// Get platform and initialize
const platform = platformManager.getPlatform();
await platform.init();

// Get NFC device
const devices = await platform.getDeviceInfo();
const device = await platform.acquireDevice(devices[0].id);

// Wait for card
await device.waitForCardPresence();

// Start session and send APDU
const session = await device.startSession();
const response = await session.transmit([0x00, 0xA4, 0x04, 0x00]);

// Cleanup
await session.release();
await device.release();
await platform.release();
```

## Examples

### Basic NFC Reading

```typescript
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
import { platformManager } from '@aokiapp/jsapdu-rn';

function NFCReader() {
  const [status, setStatus] = useState('Ready');
  const [data, setData] = useState(null);

  const readNFC = async () => {
    const platform = platformManager.getPlatform();
    
    try {
      setStatus('Initializing...');
      await platform.init();
      
      const devices = await platform.getDeviceInfo();
      const device = await platform.acquireDevice(devices[0].id);
      
      setStatus('Hold card near phone...');
      await device.waitForCardPresence(30000);
      
      setStatus('Reading...');
      const session = await device.startSession();
      
      // Get ATR
      const atr = await session.getAtr();
      
      // Send SELECT command
      const selectCmd = new Uint8Array([
        0x00, 0xA4, 0x04, 0x00, 0x07,
        0xA0, 0x00, 0x00, 0x01, 0x51, 0x00, 0x00
      ]);
      const response = await session.transmit(selectCmd);
      
      setData({
        atr: Array.from(atr).map(b => 
          b.toString(16).padStart(2, '0')
        ).join(' '),
        response: response
      });
      
      await session.release();
      await device.release();
      
      setStatus('Success!');
      
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      await platform.release();
    }
  };

  return (
    <View>
      <Text>{status}</Text>
      <Button title="Read NFC" onPress={readNFC} />
      {data && (
        <View>
          <Text>ATR: {data.atr}</Text>
          <Text>Response: {JSON.stringify(data.response)}</Text>
        </View>
      )}
    </View>
  );
}
```

### Event-Driven Card Detection

```typescript
import { useEffect, useRef } from 'react';
import { platformManager } from '@aokiapp/jsapdu-rn';

function useNFCEvents() {
  const platformRef = useRef(null);
  const deviceRef = useRef(null);
  const unsubscribers = useRef([]);

  useEffect(() => {
    const setup = async () => {
      platformRef.current = platformManager.getPlatform();
      await platformRef.current.init();
      
      const devices = await platformRef.current.getDeviceInfo();
      deviceRef.current = await platformRef.current.acquireDevice(devices[0].id);
      
      // Listen for card events
      unsubscribers.current.push(
        deviceRef.current.on('CARD_FOUND', (event) => {
          console.log('Card detected!', event);
          handleCardFound();
        })
      );
      
      unsubscribers.current.push(
        deviceRef.current.on('CARD_LOST', (event) => {
          console.log('Card removed', event);
        })
      );
      
      // Start waiting for cards
      deviceRef.current.waitForCardPresence().catch(console.error);
    };
    
    setup();
    
    return () => {
      // Cleanup
      unsubscribers.current.forEach(unsub => unsub());
      deviceRef.current?.release();
      platformRef.current?.release();
    };
  }, []);
  
  const handleCardFound = async () => {
    try {
      const session = await deviceRef.current.startSession();
      const atr = await session.getAtr();
      console.log('Card ATR:', atr);
      await session.release();
      
      // Wait for next card
      deviceRef.current.waitForCardPresence().catch(console.error);
    } catch (error) {
      console.error('Session error:', error);
    }
  };
}
```

### Reading Japanese MynaCard

```typescript
import { platformManager } from '@aokiapp/jsapdu-rn';
import { CommandApdu } from '@aokiapp/jsapdu-interface';
import { JPKI_AP, JPKI_AP_EF } from '@aokiapp/mynacard';
import { selectDf, readEfBinaryFull } from '@aokiapp/apdu-utils';

async function readMynaCard() {
  const platform = platformManager.getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  const device = await platform.acquireDevice(devices[0].id);
  
  console.log('Place MynaCard on phone...');
  await device.waitForCardPresence();
  
  const session = await device.startSession();
  
  try {
    // Select JPKI application
    const selectResp = await session.transmit(selectDf(JPKI_AP));
    
    if (!selectResp.isSuccess()) {
      throw new Error('Failed to select JPKI application');
    }
    
    // Read public certificate (no PIN required)
    const certData = await readEfBinaryFull(JPKI_AP_EF.AUTH_CERT_CA, session);
    
    console.log('Certificate size:', certData.length);
    
    return certData;
    
  } finally {
    await session.release();
    await device.release();
    await platform.release();
  }
}
```

### Multiple Device Support

```typescript
import { platformManager } from '@aokiapp/jsapdu-rn';

async function getAvailableDevices() {
  const platform = platformManager.getPlatform();
  await platform.init();
  
  const devices = await platform.getDeviceInfo();
  
  devices.forEach(device => {
    console.log(`Device: ${device.friendlyName}`);
    console.log(`  ID: ${device.id}`);
    console.log(`  Type: ${device.d2cProtocol}`);
    console.log(`  Supports APDU: ${device.supportsApdu}`);
  });
  
  // Use specific device
  const nfcDevice = devices.find(d => d.d2cProtocol === 'NFC');
  
  if (nfcDevice) {
    const device = await platform.acquireDevice(nfcDevice.id);
    // Use device...
  }
  
  await platform.release();
}
```

### Complete Transaction with Error Handling

```typescript
import { useState } from 'react';
import { platformManager } from '@aokiapp/jsapdu-rn';
import { SmartCardError } from '@aokiapp/jsapdu-interface';

function useSmartCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const performTransaction = async (commands) => {
    setLoading(true);
    setError(null);
    
    const platform = platformManager.getPlatform();
    let device = null;
    let session = null;
    
    try {
      await platform.init();
      
      const devices = await platform.getDeviceInfo();
      if (devices.length === 0) {
        throw new Error('No NFC device available');
      }
      
      device = await platform.acquireDevice(devices[0].id);
      
      // Wait with timeout
      await device.waitForCardPresence(10000);
      
      session = await device.startSession();
      
      const results = [];
      
      for (const cmd of commands) {
        try {
          const response = await session.transmit(cmd);
          results.push(response);
          
          if (!response.isSuccess()) {
            console.warn(`Command failed: SW=${response.sw.toString(16)}`);
          }
        } catch (error) {
          if (error instanceof SmartCardError) {
            // Handle specific card errors
            if (error.code === 'CARD_REMOVED') {
              throw new Error('Card was removed during operation');
            }
          }
          throw error;
        }
      }
      
      return results;
      
    } catch (error) {
      setError(error.message);
      throw error;
      
    } finally {
      if (session) await session.release();
      if (device) await device.release();
      await platform.release();
      setLoading(false);
    }
  };
  
  return { performTransaction, loading, error };
}
```

## API Reference

### platformManager

Singleton manager for the React Native NFC platform.

#### `getPlatform(): RnSmartCardPlatform`
Returns the platform instance for NFC operations.

**Returns:** `RnSmartCardPlatform` - Platform instance (always the same instance)

**Usage:** Call once at app startup and reuse the instance.

---

### RnSmartCardPlatform

Main NFC platform interface. Extends `SmartCardPlatform`.

#### `async init(force?: boolean): Promise<void>`
Initializes the NFC platform and prepares for card detection.

**Parameters:**
- `force?: boolean` - Skip initialization check if true (default: false)

**Throws:**
- `SmartCardError("ALREADY_INITIALIZED")` - Platform already initialized (when force=false)
- `SmartCardError("PLATFORM_ERROR")` - NFC not supported, disabled, or initialization failed

**Events Emitted:**
- `PLATFORM_INITIALIZED` - Platform ready for device operations

**Android Behavior:**
- Checks NFC hardware availability
- Verifies NFC is enabled
- Prepares Reader Mode activation

**iOS Behavior:**
- Validates NFC session support (iPhone 7+)
- Checks Info.plist configuration
- Prepares Core NFC session

#### `async release(force?: boolean): Promise<void>`
Releases NFC resources and all acquired devices.

**Parameters:**
- `force?: boolean` - Skip precondition checks if true (default: false)

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized (when force=false)
- `SmartCardError("PLATFORM_ERROR")` - Release failed

**Events Emitted:**
- `PLATFORM_RELEASED` - After successful release

**Behavior:**
- Releases all acquired devices first
- Disables Reader Mode (Android) or ends NFC session (iOS)
- Clears all device tracking maps

#### `async getDeviceInfo(): Promise<RnDeviceInfo[]>`
Lists available NFC devices (typically 1 integrated NFC reader).

**Returns:** `Promise<RnDeviceInfo[]>` - Array of device information
- Usually contains single element for integrated NFC
- Empty array if NFC unavailable

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized
- `SmartCardError("PLATFORM_ERROR")` - Failed to enumerate devices

**Device Info Contents:**
- `id`: Device identifier (e.g., "integrated-nfc-0")
- `friendlyName`: Display name (e.g., "Integrated NFC")
- `supportsApdu`: Always true for NFC
- `d2cProtocol`: "nfc"
- `p2dProtocol`: "integrated"

#### `async acquireDevice(deviceId: string): Promise<RnSmartCardDevice>`
Acquires an NFC device and enables card detection.

**Parameters:**
- `deviceId: string` - Device ID from `getDeviceInfo()`

**Returns:** `Promise<RnSmartCardDevice>` - Device instance for card operations

**Throws:**
- `SmartCardError("NOT_INITIALIZED")` - Platform not initialized
- `SmartCardError("ALREADY_CONNECTED")` - Device already acquired
- `SmartCardError("READER_ERROR")` - Invalid device ID
- `SmartCardError("PLATFORM_ERROR")` - Reader Mode activation failed (Android) or session start failed (iOS)

**Events Emitted:**
- `DEVICE_ACQUIRED` - After successful acquisition

**Android Behavior:**
- Enables NFC Reader Mode with ISO-DEP flag
- Starts listening for NFC tags

**iOS Behavior:**
- Prepares Core NFC reader session
- Validates AID list from Info.plist

---

### RnSmartCardDevice

NFC device interface. Extends `SmartCardDevice`.

#### `getDeviceInfo(): RnDeviceInfo`
Returns device information for this NFC reader.

**Returns:** `RnDeviceInfo` - Device capabilities and identification

#### `isSessionActive(): boolean`
Checks if a card session is currently active.

**Returns:** `boolean` - True if session active

#### `async isDeviceAvailable(): Promise<boolean>`
Checks if the NFC device is accessible.

**Returns:** `Promise<boolean>` - True if NFC available

#### `async isCardPresent(): Promise<boolean>`
Checks if an NFC card/tag is currently detected.

**Returns:** `Promise<boolean>` - True if card detected

**Note:** May not be reliable on iOS due to session-based architecture.

#### `async waitForCardPresence(timeout: number): Promise<void>`
Blocks until an NFC card is detected or timeout occurs.

**Parameters:**
- `timeout: number` - Maximum wait time in milliseconds

**Throws:**
- `SmartCardError("TIMEOUT")` - No card detected within timeout
- `SmartCardError("PLATFORM_ERROR")` - NFC error or user cancelled

**Events Emitted:**
- `CARD_FOUND` - When card detected
- `WAIT_TIMEOUT` - When timeout reached

**Android Behavior:**
- Activates Reader Mode if not active
- Returns when ISO-DEP tag discovered

**iOS Behavior:**
- Presents NFC scanning UI
- Returns when compatible tag found

#### `async startSession(): Promise<RnSmartCard>`
Begins card communication session.

**Returns:** `Promise<RnSmartCard>` - Active card session

**Throws:**
- `SmartCardError("CARD_NOT_PRESENT")` - No card detected
- `SmartCardError("ALREADY_CONNECTED")` - Session already active
- `SmartCardError("PLATFORM_ERROR")` - ISO-DEP connection failed

**Events Emitted:**
- `CARD_SESSION_STARTED` - After successful session start

**Android Behavior:**
- Calls `IsoDep.connect()` on detected tag
- Negotiates ISO-DEP parameters

**iOS Behavior:**
- Connects to NFCISO7816Tag
- Prepares for APDU exchange

#### `async release(): Promise<void>`
Releases the device and ends any active session.

**Throws:**
- `SmartCardError("PLATFORM_ERROR")` - Release failed

**Events Emitted:**
- `DEVICE_RELEASED` - After successful release

**Android Behavior:**
- Closes ISO-DEP connection if active
- May disable Reader Mode

**iOS Behavior:**
- Invalidates NFC reader session
- Dismisses scanning UI

---

### RnSmartCard

Active NFC card session. Extends `SmartCard`.

#### `async getAtr(): Promise<Uint8Array>`
Retrieves the Answer To Select (ATS) from the NFC card.

**Returns:** `Promise<Uint8Array>` - ATS/ATR bytes (typically 4-20 bytes)

**Throws:**
- `SmartCardError("TRANSMISSION_ERROR")` - Failed to read ATS
- `SmartCardError("CARD_NOT_PRESENT")` - Card moved away

**Note:** For NFC, this returns ATS (Answer To Select), not ATR. ATS is the ISO-DEP equivalent of ATR for contactless cards.

#### `async transmit(apdu: CommandApdu): Promise<ResponseApdu>`
Sends structured APDU command to the card.

**Parameters:**
- `apdu: CommandApdu` - Structured APDU command

**Returns:** `Promise<ResponseApdu>` - Parsed response with data and status

**Throws:**
- `SmartCardError("TRANSMISSION_ERROR")` - Communication failed
- `SmartCardError("PLATFORM_ERROR")` - Card removed (TagLostException on Android)
- `SmartCardError("PROTOCOL_ERROR")` - Invalid APDU format
- `SmartCardError("TIMEOUT")` - NFC timeout (typically 2-3 seconds)

**Events Emitted:**
- `APDU_SENT` - After successful transmission
- `APDU_FAILED` - On transmission error

**Android Implementation:**
- Uses `IsoDep.transceive()`
- Supports Extended APDU automatically
- Typical frame size: up to 261 bytes (standard) or 65538 bytes (extended)

**iOS Implementation:**
- Uses `NFCISO7816Tag.sendCommand()`
- Extended APDU support depends on card
- Maximum response: 65536 bytes

#### `async transmit(apdu: Uint8Array): Promise<Uint8Array>`
Sends raw bytes to the card (for non-APDU protocols).

**Parameters:**
- `apdu: Uint8Array` - Raw command bytes

**Returns:** `Promise<Uint8Array>` - Raw response bytes

#### `async reset(): Promise<void>`
Resets the card session.

**Throws:**
- `SmartCardError("TRANSMISSION_ERROR")` - Reset failed

**Events Emitted:**
- `CARD_SESSION_RESET` - After reset

**Platform Support:**
- Android: Supported (reconnect ISO-DEP)
- iOS: Limited support (may require new session)

#### `async release(): Promise<void>`
Ends the card session.

**Throws:** Rarely throws - benign errors suppressed

**Events Emitted:**
- Session end notified via parent device

**Behavior:**
- Safe to call multiple times
- Parent device handles actual disconnection

---

### RnDeviceInfo

NFC device information and capabilities. Extends `SmartCardDeviceInfo`.

**Properties:**

#### `id: string`
Unique device identifier (e.g., "integrated-nfc-0").

**Usage:** Pass to `acquireDevice()` to get device access.

#### `friendlyName: string`
Human-readable device name (e.g., "Integrated NFC").

**Usage:** Display in UI for device selection.

#### `description: string`
Detailed device description.

#### `supportsApdu: boolean`
Whether device supports APDU communication.

**Value:** Always `true` for NFC devices in this package.

#### `isIntegratedDevice: boolean`
Whether device is built into the phone.

**Value:** Always `true` for phone NFC.

#### `isRemovableDevice: boolean`
Whether device is external (USB, Bluetooth).

**Value:** Always `false` for integrated NFC.

#### `d2cProtocol: string`
Device-to-Card communication protocol.

**Values:**
- `"nfc"` - NFC contactless (ISO-DEP)
- `"iso7816"` - Contact card protocol

#### `p2dProtocol: string`
Platform-to-Device communication protocol.

**Values:**
- `"integrated"` - Built-in NFC antenna
- `"usb"` - External USB reader
- `"ble"` - Bluetooth reader

#### `apduApi: string[]`
API layers used for APDU communication.

**Values:** `["nfc", "androidnfc"]` or `["nfc", "corenfc"]`

**Usage:** Identifies the underlying native API stack.

## Platform Notes

### iOS
- Requires iPhone 7 or later
- Only works with ISO7816-4 compatible cards
- Session timeout: 60 seconds
- Must specify AIDs in Info.plist

### Android
- Requires NFC hardware
- Supports both NFC-A and NFC-B
- Can use OMAPI for SIM/eSE access
- Background NFC reading possible

## License

ANAL-Tight-1.0.1 - See [LICENSE](../../LICENSE.md)
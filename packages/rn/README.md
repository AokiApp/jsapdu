# @aokiapp/jsapdu-rn

SmartCard NFC platform for React Native (Android implementation) built on Nitro Modules. Provides APDU communication via ISO-DEP following jsapdu interface abstractions.

## Installation

```sh
npm install @aokiapp/jsapdu-rn @aokiapp/jsapdu-interface @aokiapp/apdu-utils @aokiapp/mynacard react-native-nitro-modules
```

Additional setup:
- Enable Nitro Modules per official guide
- AndroidManifest NFC permission and feature

AndroidManifest example required=true vs false:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.NFC" />
  <uses-feature android:name="android.hardware.nfc" android:required="true" />
</manifest>
```

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.NFC" />
  <uses-feature android:name="android.hardware.nfc" android:required="false" />
</manifest>
```

## Quick Start

```typescript
import { platformManager } from "@aokiapp/jsapdu-rn";
import { selectDf } from "@aokiapp/apdu-utils";
import { KENHOJO_AP } from "@aokiapp/mynacard";

async function run() {
  const platform = platformManager.getPlatform();
  await platform.init();

  try {
    const infos = await platform.getDeviceInfo();
    if (infos.length === 0) {
      console.log("No NFC device detected");
      return;
    }

    const device = await platform.acquireDevice(infos[0].id);
    await device.waitForCardPresence(15000);

    const card = await device.startSession();
    const response = await card.transmit(selectDf(KENHOJO_AP));
    console.log("SW:", response.sw.toString(16));

    await card.release();
    await device.release();
  } finally {
    await platform.release();
  }
}
```

## API Overview

Public API aligns with jsapdu interfaces:

- Platform: getDeviceInfo(), acquireDevice(id), init(force?), release(force?)
- Device: getDeviceInfo(), isSessionActive(), isDeviceAvailable(), isCardPresent(), waitForCardPresence(timeoutMs), startSession(), release()
- Card: getAtr(), transmit(CommandApdu|Uint8Array), reset(), release()

See:
- Interface definitions: packages/interface/src/abstracts.ts
- Platform impl: packages/rn/src/platform/rn-smart-card-platform.ts
- Device impl: packages/rn/src/device/rn-smart-card-device.ts
- Card impl: packages/rn/src/card/rn-smart-card.ts

## Notes

- await using resource cleanup is a Node 22 feature and not used in RN apps; use try/finally.
- APDU extended length is assumed; unsupported devices map to PLATFORM_ERROR.

## Contributing

Implementation docs: packages/rn/docs/README.md and guides under packages/rn/docs/guides/.

## License

MIT
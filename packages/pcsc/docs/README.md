# @aokiapp/jsapdu-pcsc Documentation

PC/SC SmartCard platform implementation for desktop environments.

Key constructs (click to open source):
- [PcscPlatformManager()](packages/pcsc/src/platform-manager.ts:11)
- [PcscPlatform()](packages/pcsc/src/platform.ts:31)
- [PcscPlatform.getDeviceInfo()](packages/pcsc/src/platform.ts:129)
- [PcscPlatform.acquireDevice()](packages/pcsc/src/platform.ts:159)
- [PcscDevice()](packages/pcsc/src/device.ts:31)
- [PcscDevice.isCardPresent()](packages/pcsc/src/device.ts:122)
- [PcscDevice.waitForCardPresence()](packages/pcsc/src/device.ts:196)
- [PcscCard()](packages/pcsc/src/card.ts:22)
- [PcscCard.getAtr()](packages/pcsc/src/card.ts:46)
- [PcscCard.transmit()](packages/pcsc/src/card.ts:64)
- [PcscCard.reset()](packages/pcsc/src/card.ts:131)

Quick start:

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { selectDf } from "@aokiapp/apdu-utils";

const mgr = PcscPlatformManager.getInstance();
const platform = mgr.getPlatform();
await platform.init();

try {
  const infos = await platform.getDeviceInfo();
  if (infos.length === 0) {
    console.log("No readers found");
    return;
  }

  const device = await platform.acquireDevice(infos[0].id);
  if (!(await device.isCardPresent())) {
    console.log("No card present");
    await device.release();
    return;
  }

  const card = await device.startSession();
  const res = await card.transmit(selectDf("A0000000041010", true));
  console.log("SW:", res.sw.toString(16));

  await card.release();
  await device.release();
} finally {
  await platform.release();
}
```

API highlights:
- Platform lifecycle: [PcscPlatform.init()](packages/pcsc/src/platform.ts:49), [PcscPlatform.release()](packages/pcsc/src/platform.ts:80)
- Reader enumeration: [PcscPlatform.getDeviceInfo()](packages/pcsc/src/platform.ts:129)
- Device acquisition: [PcscPlatform.acquireDevice(id)](packages/pcsc/src/platform.ts:159)
- Card ops: [PcscCard.getAtr()](packages/pcsc/src/card.ts:46), [PcscCard.transmit()](packages/pcsc/src/card.ts:64), [PcscCard.reset()](packages/pcsc/src/card.ts:131)

Resource management:
- Node.js examples may use "await using" which rely on:
  - [SmartCardPlatform.[Symbol.asyncDispose]()](packages/interface/src/abstracts.ts:79)
  - [SmartCardDevice.[Symbol.asyncDispose]()](packages/interface/src/abstracts.ts:313)
  - [SmartCard.[Symbol.asyncDispose]()](packages/interface/src/abstracts.ts:373)
- Requires Node.js 22+ for "await using".

Error handling:
- Structured errors via [SmartCardError()](packages/interface/src/errors.ts:23)
- Common PC/SC mappings:
  - NO_READERS / READER_ERROR from PC/SC enumeration failures
  - CARD_NOT_PRESENT when session start fails without a card
  - PLATFORM_ERROR for native return codes and transport failures

See also:
- Package README: [packages/pcsc/README.md](packages/pcsc/README.md:1)
- Interface docs: [packages/interface/docs/README.md](packages/interface/docs/README.md:1)
- APDU utils docs: [packages/apdu-utils/docs/README.md](packages/apdu-utils/docs/README.md:1)
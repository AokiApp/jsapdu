# @aokiapp/jsapdu-interface Documentation

Core abstractions and interfaces for SmartCard communication across platforms.

Key constructs (click to open source):
- [SmartCardPlatformManager()](packages/interface/src/abstracts.ts:9)
- [SmartCardPlatform()](packages/interface/src/abstracts.ts:19)
- [SmartCardDevice()](packages/interface/src/abstracts.ts:238)
- [SmartCard()](packages/interface/src/abstracts.ts:331)
- [EmulatedCard()](packages/interface/src/abstracts.ts:393)
- [CommandApdu()](packages/interface/src/apdu/command-apdu.ts:23)
- [ResponseApdu()](packages/interface/src/apdu/response-apdu.ts:1)
- [SmartCardError()](packages/interface/src/errors.ts:23)
- [TimeoutError()](packages/interface/src/errors.ts:84)
- [ValidationError()](packages/interface/src/errors.ts:99)
- [toUint8Array()](packages/interface/src/utils.ts:1)

API highlights:
- Platform lifecycle: init(force?), release(force?), isInitialized()
- Device discovery and acquisition: getDeviceInfo(), acquireDevice(id)
- Device ops: isDeviceAvailable(), isCardPresent(), waitForCardPresence(timeout)
- Card ops: getAtr(), transmit(CommandApdu|Uint8Array), reset(), release()
- Errors: structured with SmartCardError.code and helpers

Quick example (PC/SC):

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { selectDf } from "@aokiapp/apdu-utils";

const mgr = PcscPlatformManager.getInstance();
const platform = mgr.getPlatform();
await platform.init();

const infos = await platform.getDeviceInfo();
const device = await platform.acquireDevice(infos[0].id);
await device.waitForCardPresence(15000);
const card = await device.startSession();

const res = await card.transmit(selectDf("A0000000041010", true));
console.log("SW:", res.sw.toString(16));

await card.release();
await device.release();
await platform.release();
```

Resource management
- Node.js examples may use "await using" which relies on [SmartCardPlatform.[Symbol.asyncDispose]()](packages/interface/src/abstracts.ts:79), [SmartCardDevice.[Symbol.asyncDispose]()](packages/interface/src/abstracts.ts:313), [SmartCard.[Symbol.asyncDispose]()](packages/interface/src/abstracts.ts:373), [EmulatedCard.[Symbol.asyncDispose]()](packages/interface/src/abstracts.ts:422)
- Requires Node.js 22+ for "await using". In React Native, use try/finally.

APDU construction
- Use [CommandApdu()](packages/interface/src/apdu/command-apdu.ts:23) for manual commands
- Prefer apdu-utils: [selectDf()](packages/apdu-utils/src/select.ts:17), [selectEf()](packages/apdu-utils/src/select.ts:30), [readEfBinaryFull()](packages/apdu-utils/src/read-binary.ts:48), [readBinary()](packages/apdu-utils/src/read-binary.ts:3), [verify()](packages/apdu-utils/src/verify.ts:12)

Error handling
- Inspect [SmartCardError.code](packages/interface/src/errors.ts:31) and [SmartCardError.getSafeMessage()](packages/interface/src/errors.ts:43)
- Wrap unknown errors with [fromUnknownError()](packages/interface/src/errors.ts:115)

See also
- [Root docs index](docs/README.md:1)
- [PC/SC package](packages/pcsc/README.md:1)
- [APDU utils](packages/apdu-utils/README.md:1)
- [MynaCard](packages/mynacard/README.md:1)
- [RN module docs](packages/rn/docs/README.md:1)
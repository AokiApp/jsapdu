# @aokiapp/apdu-utils Documentation

High-level builders for common ISO 7816 APDU commands. Prefer these over manual construction.

Key functions:
- [selectDf()](packages/apdu-utils/src/select.ts:17)
- [selectEf()](packages/apdu-utils/src/select.ts:30)
- [readEfBinaryFull()](packages/apdu-utils/src/read-binary.ts:48)
- [readCurrentEfBinaryFull()](packages/apdu-utils/src/read-binary.ts:56)
- [readBinary()](packages/apdu-utils/src/read-binary.ts:3)
- [verify()](packages/apdu-utils/src/verify.ts:12)

Data conversion:
- Prefer [toUint8Array()](packages/interface/src/utils.ts:1) from jsapdu-interface for hex/array inputs.

Quick usage:
```typescript
import { selectDf, selectEf, readEfBinaryFull, verify } from "@aokiapp/apdu-utils";
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard";

const mgr = PcscPlatformManager.getInstance();
const platform = mgr.getPlatform();
await platform.init();

const infos = await platform.getDeviceInfo();
const device = await platform.acquireDevice(infos[0].id);
await device.waitForCardPresence(15000);
const card = await device.startSession();

await card.transmit(selectDf(KENHOJO_AP));
const pinOk = await card.transmit(verify("1234", { ef: KENHOJO_AP_EF.PIN }));
if (pinOk.sw !== 0x9000) throw new Error("PIN failed");
const res = await card.transmit(readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR));
console.log("SW:", res.sw.toString(16));

await card.release();
await device.release();
await platform.release();
```

Parameter validation:
- selectDf(): AID 1-16 bytes; fciRequested toggles Le
- selectEf(): EF id must be exactly 2 bytes
- readEfBinaryFull(): short EF id ∈ [0..31]
- readBinary(): respect APDU limits; useMaxLe selects 256/65536
- verify(): PIN as digits or bytes; EF ≤ 0x1e

Error handling:
- Inspect ResponseApdu status via [ResponseApdu.sw](packages/interface/src/apdu/response-apdu.ts:42)
- Wrap platform errors into [SmartCardError()](packages/interface/src/errors.ts:23)

See also:
- Package README: [packages/apdu-utils/README.md](packages/apdu-utils/README.md:1)
- Interface docs: [packages/interface/docs/README.md](packages/interface/docs/README.md:1)
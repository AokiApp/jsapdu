# @aokiapp/mynacard Documentation

Japanese MynaCard (マイナンバーカード) support: constants, TLV schemas, and usage patterns.

## Applications (AP)

- [JPKI_AP](packages/mynacard/src/constants.ts:4) and [JPKI_AP_EF](packages/mynacard/src/constants.ts:7)
- [KENHOJO_AP](packages/mynacard/src/constants.ts:66) and [KENHOJO_AP_EF](packages/mynacard/src/constants.ts:69)
- [KENKAKU_AP](packages/mynacard/src/constants.ts:38) and [KENKAKU_AP_EF](packages/mynacard/src/constants.ts:41)

## Schemas

- [schemaCertificate()](packages/mynacard/src/schema.ts:8) — returns contents.issuer, contents.subject, contents.publicKeyRaw, and thisSignature
- [schemaKenhojoBasicFour()](packages/mynacard/src/schema.ts:39) — offsets, name, address, birth, gender
- [schemaKenhojoSignature()](packages/mynacard/src/schema.ts:86) — kenhojoMyNumberHash, kenhojoBasicFourHash, thisSignature
- [schemaKenhojoAuthKey()](packages/mynacard/src/schema.ts:114) — publicKeyRaw, thisSignature
- [schemaKenkakuBirth()](packages/mynacard/src/schema.ts:140) — birth, publicKeyRaw, thisSignature
- [schemaKenkakuEntries()](packages/mynacard/src/schema.ts:171) — offsets, birth, gender, publicKeyRaw, namePng, addressPng, faceJp2, thisSignature, expire, securityCodePng
- [schemaKenkakuMyNumber()](packages/mynacard/src/schema.ts:258) — myNumberPng, publicKeyRaw, thisSignature

## Quick Start

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import { KENHOJO_AP, KENHOJO_AP_EF, schemaKenhojoBasicFour } from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv/parser";

const mgr = PcscPlatformManager.getInstance();
const platform = mgr.getPlatform();
await platform.init();

const infos = await platform.getDeviceInfo();
const device = await platform.acquireDevice(infos[0].id);
await device.waitForCardPresence(15000);

const card = await device.startSession();

// Select Kenhojo AP and verify 4-digit PIN
await card.transmit(selectDf(KENHOJO_AP));
const pinRes = await card.transmit(verify("1234", { ef: KENHOJO_AP_EF.PIN }));
if (pinRes.sw !== 0x9000) throw new Error("PIN verification failed");

// Read basic four information
const res = await card.transmit(readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR));
if (res.sw !== 0x9000) throw new Error("Read failed");

// Parse TLV
const parser = new SchemaParser(schemaKenhojoBasicFour);
const info = parser.parse(res.arrayBuffer());
console.log(info.name, info.address, info.birth, info.gender);

await card.release();
await device.release();
await platform.release();
```

## Reading JPKI Certificates

```typescript
import { selectDf, readEfBinaryFull } from "@aokiapp/apdu-utils";
import { JPKI_AP, JPKI_AP_EF, schemaCertificate } from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv/parser";

await card.transmit(selectDf(JPKI_AP));
const certRes = await card.transmit(readEfBinaryFull(JPKI_AP_EF.SIGN_CERT));
if (certRes.sw !== 0x9000) throw new Error("Failed to read signature certificate");

const certParser = new SchemaParser(schemaCertificate);
const cert = certParser.parse(certRes.arrayBuffer());
console.log({
  issuer: cert.contents.issuer,
  subject: cert.contents.subject,
  publicKeyRaw: cert.contents.publicKeyRaw,
  signature: cert.thisSignature,
});
```

## Authentication and Protected Data

```typescript
import { selectDf, selectEf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import { JPKI_AP, JPKI_AP_EF } from "@aokiapp/mynacard";

// Verify authentication PIN
const v = await card.transmit(verify("123456", { ef: JPKI_AP_EF.AUTH_PIN }));
if (v.sw !== 0x9000) throw new Error("Auth PIN verification failed");

// Select authentication private key (two-byte FID)
await card.transmit(selectEf([0x00, JPKI_AP_EF.AUTH_KEY]));

// Read auth certificate
const authCert = await card.transmit(readEfBinaryFull(JPKI_AP_EF.AUTH_CERT));
console.log("SW:", authCert.sw.toString(16));
```

## Hash Verification (Kenhojo Signature)

```typescript
import { readEfBinaryFull } from "@aokiapp/apdu-utils";
import { KENHOJO_AP_EF, schemaKenhojoSignature } from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv/parser";

const sigRes = await card.transmit(readEfBinaryFull(KENHOJO_AP_EF.SIGNATURE));
const sigParser = new SchemaParser(schemaKenhojoSignature);
const sigData = sigParser.parse(sigRes.arrayBuffer());

const basicRes = await card.transmit(readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR));
const myNumRes = await card.transmit(readEfBinaryFull(KENHOJO_AP_EF.MY_NUMBER));

const basicHash = await crypto.subtle.digest("SHA-256", basicRes.arrayBuffer());
const myNumHash = await crypto.subtle.digest("SHA-256", myNumRes.arrayBuffer());

const basicMatch = Buffer.from(basicHash).equals(Buffer.from(sigData.kenhojoBasicFourHash));
const myNumMatch = Buffer.from(myNumHash).equals(Buffer.from(sigData.kenhojoMyNumberHash));
console.log({ basicFourValid: basicMatch, myNumberValid: myNumMatch });
```

## Error Handling

Use [ResponseApdu()](packages/interface/src/apdu/response-apdu.ts:1) and inspect [ResponseApdu.sw](packages/interface/src/apdu/response-apdu.ts:42). Map transport errors via [SmartCardError()](packages/interface/src/errors.ts:23).

Common SW values:
- 0x9000: Success
- 0x6982: Security condition not satisfied
- 0x6A82: File not found
- 0x63Cx: PIN retry counter (x = retries left)

## Utilities and Builders

Prefer APDU utilities over manual construction:
- [selectDf()](packages/apdu-utils/src/select.ts:17)
- [selectEf()](packages/apdu-utils/src/select.ts:30)
- [readEfBinaryFull()](packages/apdu-utils/src/read-binary.ts:48)
- [readBinary()](packages/apdu-utils/src/read-binary.ts:3)
- [verify()](packages/apdu-utils/src/verify.ts:12)

For data conversion, use [toUint8Array()](packages/interface/src/utils.ts:1).

## Cross-References

- Root docs: [docs/README.md](docs/README.md:1)
- Interface docs: [packages/interface/docs/README.md](packages/interface/docs/README.md:1)
- APDU utils docs: [packages/apdu-utils/docs/README.md](packages/apdu-utils/docs/README.md:1)
- PC/SC docs: [packages/pcsc/docs/README.md](packages/pcsc/docs/README.md:1)
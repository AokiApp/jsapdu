# @aokiapp/mynacard

Japanese MynaCard (マイナンバーカード) support with JPKI, Kenhojo, and Kenkaku applications.

## Overview

This package provides specialized support for Japanese government-issued MynaCard (マイナンバーカード), including constants, TLV schemas, and utilities for accessing the three main applications:

- **JPKI AP** (公的個人認証) - Public Key Infrastructure for digital signatures
- **Kenhojo AP** (券面事項入力補助) - Card surface information input assistance
- **Kenkaku AP** (券面事項確認) - Card surface information verification

## Installation

```bash
npm install @aokiapp/mynacard @aokiapp/tlv-parser
```

## Quick Start

```typescript
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import {
  KENHOJO_AP,
  KENHOJO_AP_EF,
  schemaKenhojoBasicFour,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv-parser";

async function readBasicInfo(card, pin) {
  // Select Kenhojo application
  await card.transmit(selectDf(KENHOJO_AP));

  // Verify PIN (4 digits)
  await card.transmit(verify(pin, { ef: KENHOJO_AP_EF.PIN }));

  // Read basic four information (券面4事項)
  const response = await card.transmit(
    readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
  );

  // Parse structured data
  const parser = new SchemaParser(schemaKenhojoBasicFour);
  const info = parser.parse(response.arrayBuffer());

  console.log("Name (氏名):", info.name);
  console.log("Address (住所):", info.address);
  console.log("Birth (生年月日):", info.birth);
  console.log("Gender (性別):", info.gender);

  return info;
}
```

## Application Constants

### JPKI AP (公的個人認証)

```typescript
import { JPKI_AP, JPKI_AP_EF } from "@aokiapp/mynacard";

// Application Identifier
console.log(JPKI_AP); // [0xD3, 0x92, 0xF0, 0x00, 0x26, 0x01, 0x00, 0x00, 0x00, 0x01]

// Elementary Files
JPKI_AP_EF.SIGN_CERT; // 0x01 - 署名用電子証明書 (Signature Certificate)
JPKI_AP_EF.SIGN_CERT_CA; // 0x02 - 署名用電子証明書CA (Signature CA Certificate)
JPKI_AP_EF.AUTH_CERT; // 0x0A - 利用者証明用電子証明書 (Authentication Certificate)
JPKI_AP_EF.AUTH_CERT_CA; // 0x0B - 利用者証明用電子証明書CA (Authentication CA Certificate)
JPKI_AP_EF.AUTH_KEY; // 0x17 - 利用者証明用電子証明書秘密鍵 (Authentication Private Key)
JPKI_AP_EF.AUTH_PIN; // 0x18 - 利用者証明用電子証明書暗証番号 (Authentication PIN)
JPKI_AP_EF.SIGN_KEY; // 0x1A - 署名用電子証明書秘密鍵 (Signature Private Key)
JPKI_AP_EF.SIGN_PIN; // 0x1B - 署名用電子証明書暗証番号 (Signature PIN)
```

### Kenhojo AP (券面事項入力補助)

```typescript
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard";

// Application Identifier
console.log(KENHOJO_AP); // [0xD3, 0x92, 0x10, 0x00, 0x31, 0x00, 0x01, 0x01, 0x04, 0x08]

// Elementary Files
KENHOJO_AP_EF.MY_NUMBER; // 0x01 - 個人番号(保護) (My Number - Protected)
KENHOJO_AP_EF.BASIC_FOUR; // 0x02 - 券面4事項(保護) (Basic Four Items - Protected)
KENHOJO_AP_EF.SIGNATURE; // 0x03 - 個人番号と券面事項のハッシュ(保護) (Hash Signature - Protected)
KENHOJO_AP_EF.INTERMEDIATE_CERTIFICATE; // 0x04 - 中間証明書 (Intermediate Certificate)
KENHOJO_AP_EF.INFORMATION; // 0x05 - AP基本情報 (AP Basic Information)
KENHOJO_AP_EF.AUTH_KEY; // 0x07 - 認証鍵(保護) (Authentication Key - Protected)
KENHOJO_AP_EF.PIN; // 0x11 - 券面事項入力補助用暗証番号 (PIN for Card Surface Input)
KENHOJO_AP_EF.PIN_A; // 0x14 - 照合番号A (Verification Number A - My Number 12 digits)
KENHOJO_AP_EF.PIN_B; // 0x15 - 照合番号B (Verification Number B - Card Surface 14 digits)
```

### Kenkaku AP (券面事項確認)

```typescript
import { KENKAKU_AP, KENKAKU_AP_EF } from "@aokiapp/mynacard";

// Application Identifier
console.log(KENKAKU_AP); // [0xD3, 0x92, 0x10, 0x00, 0x31, 0x00, 0x01, 0x01, 0x04, 0x02]

// Elementary Files
KENKAKU_AP_EF.BIRTH; // 0x01 - 生年月日 (Birth Date)
KENKAKU_AP_EF.ENTRIES; // 0x02 - 券面事項 (Card Surface Entries)
KENKAKU_AP_EF.INFORMATION; // 0x03 - AP基本情報 (AP Basic Information)
KENKAKU_AP_EF.INTERMEDIATE_CERTIFICATE; // 0x04 - 中間証明書 (Intermediate Certificate)
KENKAKU_AP_EF.MY_NUMBER; // 0x05 - 個人番号 (My Number)
KENKAKU_AP_EF.BIRTH_PIN; // 0x11 - 生年月日PIN (Birth Date PIN)
KENKAKU_AP_EF.PIN_B; // 0x12 - 照合番号B (Verification Number B)
KENKAKU_AP_EF.PIN_A; // 0x13 - 照合番号A (Verification Number A)
```

## TLV Schemas (TLV構造定義)

### Basic Four Information Schema (券面4事項スキーマ)

```typescript
import { schemaKenhojoBasicFour } from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv-parser";

const parser = new SchemaParser(schemaKenhojoBasicFour);
const info = parser.parse(buffer);

// Parsed structure:
interface BasicFourInfo {
  offsets: number[]; // オフセット情報 (Offset Information)
  name: string; // 氏名 (Name)
  address: string; // 住所 (Address)
  birth: string; // 生年月日 (Birth Date)
  gender: string; // 性別 (Gender)
}
```

### Certificate Schema (証明書スキーマ)

```typescript
import { schemaCertificate } from "@aokiapp/mynacard";

const parser = new SchemaParser(schemaCertificate);
const cert = parser.parse(buffer);

// Parsed structure:
interface CertificateInfo {
  contents: {
    issuer: ArrayBuffer; // 発行者 (Issuer)
    subject: ArrayBuffer; // 主体者 (Subject)
    public_key: CryptoKey; // 公開鍵 (Public Key)
  };
  thisSignature: Uint8Array; // 署名 (Signature)
}
```

### Signature Schema (署名スキーマ)

```typescript
import { schemaKenhojoSignature } from "@aokiapp/mynacard";

const parser = new SchemaParser(schemaKenhojoSignature);
const sig = parser.parse(buffer);

// Parsed structure:
interface SignatureInfo {
  kenhojoMyNumberHash: Uint8Array; // 個人番号ハッシュ (My Number Hash)
  kenhojoBasicFourHash: Uint8Array; // 券面4事項ハッシュ (Basic Four Hash)
  thisSignature: Uint8Array; // 署名 (Signature)
}
```

### Additional Schemas (追加スキーマ)

```typescript
// Authentication Key Schema (認証鍵スキーマ)
import { schemaKenhojoAuthKey } from "@aokiapp/mynacard";

// Birth Information Schema (生年月日情報スキーマ)
import { schemaKenkakuBirth } from "@aokiapp/mynacard";

// Card Surface Entries Schema (券面事項スキーマ)
import { schemaKenkakuEntries } from "@aokiapp/mynacard";

// My Number Schema (個人番号スキーマ)
import { schemaKenkakuMyNumber } from "@aokiapp/mynacard";
```

## Common Usage Patterns

### Reading Personal Information (個人情報の読み取り)

```typescript
import {
  KENHOJO_AP,
  KENHOJO_AP_EF,
  schemaKenhojoBasicFour,
} from "@aokiapp/mynacard";

async function readPersonalInfo(card, pin) {
  // 1. Select Kenhojo application (券面事項入力補助APを選択)
  await card.transmit(selectDf(KENHOJO_AP));

  // 2. Verify PIN (暗証番号を確認)
  const verifyResult = await card.transmit(
    verify(pin, { ef: KENHOJO_AP_EF.PIN }),
  );
  if (verifyResult.sw !== 0x9000) {
    throw new Error(`PIN verification failed: ${verifyResult.sw.toString(16)}`);
  }

  // 3. Read basic information (基本情報を読み取り)
  const response = await card.transmit(
    readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
  );
  if (response.sw !== 0x9000) {
    throw new Error(`Failed to read basic info: ${response.sw.toString(16)}`);
  }

  // 4. Parse TLV data (TLVデータを解析)
  const parser = new SchemaParser(schemaKenhojoBasicFour);
  const info = parser.parse(response.arrayBuffer());

  return {
    name: info.name, // 氏名
    address: info.address, // 住所
    birth: info.birth, // 生年月日
    gender: info.gender, // 性別
    offsets: info.offsets, // オフセット情報
  };
}
```

### Reading Digital Certificate (デジタル証明書の読み取り)

```typescript
import { JPKI_AP, JPKI_AP_EF, schemaCertificate } from "@aokiapp/mynacard";

async function readSignatureCertificate(card) {
  // 1. Select JPKI application (JPKI APを選択)
  await card.transmit(selectDf(JPKI_AP));

  // 2. Read signature certificate (署名用証明書を読み取り)
  const response = await card.transmit(readEfBinaryFull(JPKI_AP_EF.SIGN_CERT));
  if (response.sw !== 0x9000) {
    throw new Error(`Failed to read certificate: ${response.sw.toString(16)}`);
  }

  // 3. Parse certificate data (証明書データを解析)
  const parser = new SchemaParser(schemaCertificate);
  const cert = parser.parse(response.arrayBuffer());

  return {
    publicKey: cert.contents.public_key, // 公開鍵
    issuer: cert.contents.issuer, // 発行者
    subject: cert.contents.subject, // 主体者
    signature: cert.thisSignature, // 署名
  };
}
```

### Hash Verification (ハッシュ検証)

```typescript
import { schemaKenhojoSignature } from "@aokiapp/mynacard";

async function verifyDataIntegrity(card, pin) {
  // Read signature data (署名データを読み取り)
  await card.transmit(selectDf(KENHOJO_AP));
  await card.transmit(verify(pin, { ef: KENHOJO_AP_EF.PIN }));

  const sigResponse = await card.transmit(
    readEfBinaryFull(KENHOJO_AP_EF.SIGNATURE),
  );
  const parser = new SchemaParser(schemaKenhojoSignature);
  const sigData = parser.parse(sigResponse.arrayBuffer());

  // Read actual data (実際のデータを読み取り)
  const basicResponse = await card.transmit(
    readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
  );
  const myNumResponse = await card.transmit(
    readEfBinaryFull(KENHOJO_AP_EF.MY_NUMBER),
  );

  // Calculate hashes (ハッシュを計算)
  const basicHash = await crypto.subtle.digest(
    "SHA-256",
    basicResponse.arrayBuffer(),
  );
  const myNumHash = await crypto.subtle.digest(
    "SHA-256",
    myNumResponse.arrayBuffer(),
  );

  // Compare hashes (ハッシュを比較)
  const basicMatch = Buffer.from(basicHash).equals(
    Buffer.from(sigData.kenhojoBasicFourHash),
  );
  const myNumMatch = Buffer.from(myNumHash).equals(
    Buffer.from(sigData.kenhojoMyNumberHash),
  );

  return {
    basicFourValid: basicMatch, // 券面4事項の検証結果
    myNumberValid: myNumMatch, // 個人番号の検証結果
    signature: sigData.thisSignature, // 署名データ
  };
}
```

## PIN Management (暗証番号管理)

### PIN Types (暗証番号の種類)

- **PIN (4 digits)**: 券面事項入力補助用暗証番号 - Card surface input assistance PIN
- **PIN A (12 digits)**: 照合番号A (個人番号) - Verification number A (My Number)
- **PIN B (14 digits)**: 照合番号B (券面事項) - Verification number B (Card surface)
- **Auth PIN**: 利用者証明用電子証明書暗証番号 - Authentication certificate PIN
- **Sign PIN**: 署名用電子証明書暗証番号 - Signature certificate PIN

### PIN Verification Examples

```typescript
// 4-digit PIN for basic operations (基本操作用4桁PIN)
await card.transmit(verify("1234", { ef: KENHOJO_AP_EF.PIN }));

// 12-digit My Number PIN (12桁個人番号PIN)
await card.transmit(verify("123456789012", { ef: KENHOJO_AP_EF.PIN_A }));

// 14-digit card surface PIN (14桁券面事項PIN)
await card.transmit(verify("12345678901234", { ef: KENHOJO_AP_EF.PIN_B }));
```

## Error Handling (エラーハンドリング)

### Common Status Words

```typescript
switch (response.sw) {
  case 0x9000:
    console.log("Success (成功)");
    break;
  case 0x6300:
    console.log("Authentication failed (認証失敗)");
    break;
  case 0x6983:
    console.log("Authentication method blocked (認証方法ブロック)");
    break;
  case 0x6a82:
    console.log("File not found (ファイルが見つかりません)");
    break;
  case 0x6982:
    console.log("Security condition not satisfied (セキュリティ条件未満足)");
    break;
  default:
    console.log(`Unexpected status: ${response.sw.toString(16)}`);
}
```

## Dependencies

- [`@aokiapp/tlv-parser`](../tlv-parser) - TLV data parsing and schema support

## Related Packages

- [`@aokiapp/apdu-utils`](../apdu-utils) - APDU command utilities for card communication
- [`@aokiapp/jsapdu-pcsc`](../pcsc) - PC/SC platform for desktop SmartCard readers

## References (参考資料)

- [公的個人認証サービス](https://www.jpki.go.jp/) - Public Key Infrastructure Service
- [マイナンバーカード](https://www.kojinbango-card.go.jp/) - MynaCard Official Site
- [地方公共団体情報システム機構](https://www.j-lis.go.jp/) - J-LIS Organization

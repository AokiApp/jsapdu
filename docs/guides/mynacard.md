# MynaCard Guide (マイナンバーカードガイド)

Complete guide for working with Japanese MynaCard (マイナンバーカード) using jsapdu.

## Overview (概要)

MynaCard (マイナンバーカード) is the Japanese government's official identification card that contains multiple applications for different purposes. This guide covers how to access and use these applications with jsapdu.

### Applications (アプリケーション)

1. **JPKI AP (公的個人認証)** - Public Key Infrastructure for digital signatures
2. **Kenhojo AP (券面事項入力補助)** - Card surface information input assistance
3. **Kenkaku AP (券面事項確認)** - Card surface information verification

## Prerequisites (前提条件)

### Required Packages

```bash
npm install @aokiapp/jsapdu-pcsc @aokiapp/mynacard @aokiapp/apdu-utils @aokiapp/tlv-parser
```

### Hardware Requirements

- PC/SC compatible SmartCard reader
- MynaCard (マイナンバーカード)
- Various PINs depending on operations:
  - **4-digit PIN** (券面事項入力補助用暗証番号)
  - **6-digit PIN** (利用者証明用電子証明書暗証番号)
  - **6-16 character PIN** (署名用電子証明書暗証番号)

## Basic Setup (基本セットアップ)

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import {
  JPKI_AP,
  JPKI_AP_EF,
  KENHOJO_AP,
  KENHOJO_AP_EF,
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaKenhojoBasicFour,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv-parser";

async function connectToMynaCard() {
  const manager = PcscPlatformManager.getInstance();
  await using platform = manager.getPlatform();
  await platform.init();

  const devices = await platform.getDeviceInfo();
  await using device = await platform.acquireDevice(devices[0].id);
  await using card = await device.startSession();

  return card;
}
```

## Reading Personal Information (個人情報の読み取り)

### Basic Four Information (券面4事項)

The basic four pieces of information are:

- **Name (氏名)**
- **Address (住所)**
- **Birth Date (生年月日)**
- **Gender (性別)**

```typescript
async function readBasicInfo(pin4digit: string) {
  const card = await connectToMynaCard();

  try {
    // 1. Select Kenhojo application (券面事項入力補助APを選択)
    await card.transmit(selectDf(KENHOJO_AP));

    // 2. Verify 4-digit PIN (4桁暗証番号を確認)
    const verifyResult = await card.transmit(
      verify(pin4digit, { ef: KENHOJO_AP_EF.PIN }),
    );

    if (verifyResult.sw !== 0x9000) {
      const retriesLeft = verifyResult.sw2 & 0x0f;
      throw new Error(
        `PIN verification failed. ${retriesLeft} tries remaining.`,
      );
    }

    // 3. Read basic four information (券面4事項を読み取り)
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
      birth: info.birth, // 生年月日 (YYYY年MM月DD日)
      gender: info.gender, // 性別 (男/女)
      offsets: info.offsets, // オフセット情報
    };
  } catch (error) {
    console.error("Error reading basic info:", error);
    throw error;
  }
}

// Usage example (使用例)
try {
  const info = await readBasicInfo("1234");
  console.log("氏名:", info.name);
  console.log("住所:", info.address);
  console.log("生年月日:", info.birth);
  console.log("性別:", info.gender);
} catch (error) {
  console.error("Failed to read MynaCard:", error.message);
}
```

### My Number (個人番号)

**⚠️ Security Warning**: My Number is highly sensitive personal information. Handle with extreme care and follow all privacy regulations.

```typescript
async function readMyNumber(pin4digit: string) {
  const card = await connectToMynaCard();

  try {
    // Select Kenhojo application
    await card.transmit(selectDf(KENHOJO_AP));

    // Verify PIN
    const verifyResult = await card.transmit(
      verify(pin4digit, { ef: KENHOJO_AP_EF.PIN }),
    );

    if (verifyResult.sw !== 0x9000) {
      throw new Error("PIN verification failed");
    }

    // Read My Number (protected data)
    const response = await card.transmit(
      readEfBinaryFull(KENHOJO_AP_EF.MY_NUMBER),
    );

    if (response.sw !== 0x9000) {
      throw new Error("Failed to read My Number");
    }

    // Parse My Number data
    // Note: Actual parsing depends on the TLV structure
    const buffer = response.arrayBuffer();
    // ... additional parsing logic needed

    return buffer;
  } catch (error) {
    console.error("Error reading My Number:", error);
    throw error;
  }
}
```

## Digital Certificates (デジタル証明書)

### Reading Signature Certificate (署名用証明書)

```typescript
async function readSignatureCertificate() {
  const card = await connectToMynaCard();

  try {
    // Select JPKI application (JPKI APを選択)
    await card.transmit(selectDf(JPKI_AP));

    // Read signature certificate (署名用電子証明書)
    const response = await card.transmit(
      readEfBinaryFull(JPKI_AP_EF.SIGN_CERT),
    );

    if (response.sw !== 0x9000) {
      throw new Error("Failed to read signature certificate");
    }

    // Parse certificate using schema
    const parser = new SchemaParser(schemaCertificate);
    const cert = parser.parse(response.arrayBuffer());

    return {
      publicKey: cert.contents.public_key, // CryptoKey object
      issuer: cert.contents.issuer, // 発行者情報
      subject: cert.contents.subject, // 主体者情報
      signature: cert.thisSignature, // 証明書署名
    };
  } catch (error) {
    console.error("Error reading signature certificate:", error);
    throw error;
  }
}
```

### Reading Authentication Certificate (利用者証明用証明書)

```typescript
async function readAuthenticationCertificate() {
  const card = await connectToMynaCard();

  try {
    // Select JPKI application
    await card.transmit(selectDf(JPKI_AP));

    // Read authentication certificate
    const response = await card.transmit(
      readEfBinaryFull(JPKI_AP_EF.AUTH_CERT),
    );

    if (response.sw !== 0x9000) {
      throw new Error("Failed to read authentication certificate");
    }

    // Parse certificate
    const parser = new SchemaParser(schemaCertificate);
    const cert = parser.parse(response.arrayBuffer());

    return cert;
  } catch (error) {
    console.error("Error reading authentication certificate:", error);
    throw error;
  }
}
```

## Card Surface Information (券面事項)

### Reading Visual Information (視覚的情報)

The Kenkaku AP contains visual representations of card information including photos and formatted text.

```typescript
async function readCardSurfaceInfo(pinB: string) {
  const card = await connectToMynaCard();

  try {
    // Select Kenkaku application (券面事項確認APを選択)
    await card.transmit(selectDf(KENKAKU_AP));

    // Verify PIN B (照合番号Bを確認)
    // PIN B is 14 digits: YYMMDD + expiry year + security code
    const verifyResult = await card.transmit(
      verify(pinB, { ef: KENKAKU_AP_EF.PIN_B }),
    );

    if (verifyResult.sw !== 0x9000) {
      throw new Error("PIN B verification failed");
    }

    // Read card surface entries (券面事項を読み取り)
    const response = await card.transmit(
      readEfBinaryFull(KENKAKU_AP_EF.ENTRIES),
    );

    if (response.sw !== 0x9000) {
      throw new Error("Failed to read card surface entries");
    }

    // Parse entries using schema
    const parser = new SchemaParser(schemaKenkakuEntries);
    const entries = parser.parse(response.arrayBuffer());

    return {
      birth: entries.birth, // 生年月日
      gender: entries.gender, // 性別
      publicKey: entries.publicKey, // 公開鍵
      namePng: entries.namePng, // 氏名PNG画像
      addressPng: entries.addressPng, // 住所PNG画像
      faceJp2: entries.faceJp2, // 顔写真JPEG2000
      securityCodePng: entries.securityCodePng, // セキュリティコードPNG
      expire: entries.expire, // 有効期限
      signature: entries.thisSignature, // 署名
    };
  } catch (error) {
    console.error("Error reading card surface info:", error);
    throw error;
  }
}
```

## Authentication Operations (認証操作)

### Authentication with User Certificate (利用者証明)

```typescript
async function authenticateUser(pin6digit: string, challenge: Uint8Array) {
  const card = await connectToMynaCard();

  try {
    // Select JPKI application
    await card.transmit(selectDf(JPKI_AP));

    // Verify authentication PIN (利用者証明用暗証番号を確認)
    const verifyResult = await card.transmit(
      verify(pin6digit, { ef: JPKI_AP_EF.AUTH_PIN }),
    );

    if (verifyResult.sw !== 0x9000) {
      throw new Error("Authentication PIN verification failed");
    }

    // Select authentication private key
    await card.transmit(selectEf(JPKI_AP_EF.AUTH_KEY));

    // Perform internal authentication (内部認証)
    const authCommand = new CommandApdu(
      0x00,
      0x88,
      0x00,
      0x00,
      challenge, // Challenge data
      0x00, // Expect response
    );

    const authResponse = await card.transmit(authCommand);

    if (authResponse.sw !== 0x9000) {
      throw new Error("Authentication failed");
    }

    return authResponse.data; // Signature over challenge
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
}
```

## Data Integrity Verification (データ整合性検証)

### Verify Card Data Integrity (カードデータ整合性検証)

```typescript
async function verifyCardDataIntegrity(pin4digit: string) {
  const card = await connectToMynaCard();

  try {
    // Select Kenhojo application
    await card.transmit(selectDf(KENHOJO_AP));
    await card.transmit(verify(pin4digit, { ef: KENHOJO_AP_EF.PIN }));

    // Read signature data (署名データを読み取り)
    const sigResponse = await card.transmit(
      readEfBinaryFull(KENHOJO_AP_EF.SIGNATURE),
    );

    const sigParser = new SchemaParser(schemaKenhojoSignature);
    const sigData = sigParser.parse(sigResponse.arrayBuffer());

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

    // Compare with stored hashes (保存されたハッシュと比較)
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
  } catch (error) {
    console.error("Verification error:", error);
    throw error;
  }
}
```

## Error Handling (エラーハンドリング)

### Common Status Words

```typescript
function handleMynaCardResponse(response: ResponseApdu): void {
  switch (response.sw) {
    case 0x9000:
      // Success (成功)
      break;

    case 0x6300:
      // Authentication failed (認証失敗)
      console.error("Authentication failed");
      break;

    case 0x63c0:
      // PIN blocked (PIN blocked - 0 tries left)
      console.error("PIN is blocked");
      break;

    case 0x63c1:
      // 1 try remaining (残り1回)
      console.warn("PIN verification failed. 1 try remaining.");
      break;

    case 0x63c2:
      // 2 tries remaining (残り2回)
      console.warn("PIN verification failed. 2 tries remaining.");
      break;

    case 0x63c3:
      // 3 tries remaining (残り3回)
      console.warn("PIN verification failed. 3 tries remaining.");
      break;

    case 0x6982:
      // Security condition not satisfied (セキュリティ条件未満足)
      console.error(
        "Security condition not satisfied - PIN verification required",
      );
      break;

    case 0x6a82:
      // File not found (ファイルが見つかりません)
      console.error("Requested file not found");
      break;

    case 0x6a86:
      // Incorrect parameters (パラメータ不正)
      console.error("Incorrect command parameters");
      break;

    case 0x6e00:
      // Class not supported (クラス未サポート)
      console.error("Command class not supported");
      break;

    case 0x6d00:
      // Instruction not supported (命令未サポート)
      console.error("Command instruction not supported");
      break;

    default:
      console.error(`Unexpected status word: ${response.sw.toString(16)}`);
  }
}
```

### PIN Management (PIN管理)

```typescript
function checkPinRetries(sw: number): number {
  if ((sw & 0xfff0) === 0x63c0) {
    return sw & 0x0f; // Number of retries remaining
  }
  return -1; // Unknown or not applicable
}

async function safeVerifyPin(
  card: SmartCard,
  pin: string,
  ef: number,
): Promise<boolean> {
  try {
    const response = await card.transmit(verify(pin, { ef }));

    if (response.sw === 0x9000) {
      return true;
    }

    const retries = checkPinRetries(response.sw);
    if (retries >= 0) {
      console.warn(`PIN verification failed. ${retries} tries remaining.`);
      if (retries === 0) {
        console.error("PIN is blocked! Contact card issuer.");
      }
    }

    return false;
  } catch (error) {
    console.error("PIN verification error:", error);
    return false;
  }
}
```

## Best Practices (ベストプラクティス)

### Security Considerations (セキュリティ考慮事項)

1. **PIN Protection (PIN保護)**

   ```typescript
   // Never log or store PINs
   // PINを絶対にログ出力や保存しない
   const pin = await askSecureInput("Enter PIN:");
   // Clear PIN from memory after use
   // 使用後はメモリからPINをクリア
   ```

2. **Resource Cleanup (リソースクリーンアップ)**

   ```typescript
   // Always use automatic resource management
   // 常に自動リソース管理を使用
   await using card = await device.startSession();
   // Resources automatically cleaned up
   ```

3. **Error Recovery (エラー復旧)**
   ```typescript
   // Handle authentication failures gracefully
   // 認証失敗を適切に処理
   if (!(await safeVerifyPin(card, pin, KENHOJO_AP_EF.PIN))) {
     // Prompt user for retry or exit
     // 再試行または終了をユーザーに促す
   }
   ```

### Performance Optimization (パフォーマンス最適化)

1. **Connection Reuse (接続再利用)**

   ```typescript
   // Reuse card connection for multiple operations
   // 複数の操作で同じカード接続を再利用
   const card = await connectToMynaCard();
   const info1 = await readBasicInfo(card, pin);
   const info2 = await readCertificate(card);
   ```

2. **Batch Operations (バッチ操作)**

   ```typescript
   // Read multiple files in sequence
   // 複数ファイルを順次読み取り
   await card.transmit(selectDf(KENHOJO_AP));
   await card.transmit(verify(pin, { ef: KENHOJO_AP_EF.PIN }));

   const [basicInfo, myNumber, signature] = await Promise.all([
     card.transmit(readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR)),
     card.transmit(readEfBinaryFull(KENHOJO_AP_EF.MY_NUMBER)),
     card.transmit(readEfBinaryFull(KENHOJO_AP_EF.SIGNATURE)),
   ]);
   ```

## Testing (テスト)

### Test Card Requirements (テストカード要件)

For development and testing, ensure you have:

- Valid MynaCard with known PINs
- PC/SC compatible card reader
- Test environment that complies with data protection regulations

### Unit Testing Example

```typescript
import { describe, it, expect } from "vitest";

describe("MynaCard Operations", () => {
  it("should read basic information", async () => {
    // Mock card or use test card
    const info = await readBasicInfo(testPin);

    expect(info.name).toBeDefined();
    expect(info.address).toBeDefined();
    expect(info.birth).toMatch(/^\d{4}年\d{2}月\d{2}日$/);
    expect(info.gender).toMatch(/^[男女]$/);
  });

  it("should handle PIN verification errors", async () => {
    await expect(readBasicInfo("0000")).rejects.toThrow(
      "PIN verification failed",
    );
  });
});
```

## Legal and Compliance (法的準拠)

### Data Protection (データ保護)

- **Personal Information Protection Law (個人情報保護法)**: Comply with Japanese privacy regulations
- **My Number Law (マイナンバー法)**: Special handling requirements for My Number data
- **Data Minimization**: Only access necessary information
- **Secure Storage**: Use appropriate encryption for any cached data
- **Audit Logging**: Log access to sensitive information

### Usage Restrictions (使用制限)

- Only use for legitimate purposes as authorized by cardholders
- Implement proper consent mechanisms
- Follow government guidelines for MynaCard integration
- Ensure secure disposal of sensitive data

## References (参考資料)

### Official Documentation (公式ドキュメント)

- [公的個人認証サービス](https://www.jpki.go.jp/) - Official JPKI documentation
- [マイナンバーカード総合サイト](https://www.kojinbango-card.go.jp/) - MynaCard official site
- [地方公共団体情報システム機構](https://www.j-lis.go.jp/) - J-LIS technical documentation

### Technical Standards (技術標準)

- ISO/IEC 7816 - SmartCard standards
- ISO/IEC 14443 - Contactless card standards
- JPKI Technical Specifications
- PC/SC Workgroup specifications

## Troubleshooting (トラブルシューティング)

### Common Issues (よくある問題)

1. **Card Not Detected (カードが検出されない)**
   - Check card reader connection
   - Verify card is properly inserted
   - Ensure PC/SC service is running

2. **PIN Verification Failures (PIN認証失敗)**
   - Verify correct PIN for the operation
   - Check remaining retry count
   - Ensure card is not blocked

3. **Application Selection Failures (アプリケーション選択失敗)**
   - Verify correct AID for the application
   - Check card compatibility
   - Ensure proper card initialization

4. **Data Parsing Errors (データ解析エラー)**
   - Verify TLV structure matches schema
   - Check for card-specific variations
   - Validate data integrity

For additional support, refer to the [main documentation](../README.md) or [open an issue](https://github.com/AokiApp/jsapdu/issues).

# @aokiapp/mynacard

Constants and utilities for Japanese MynaCard (Individual Number Card).

## Installation

```bash
npm install @aokiapp/mynacard
```

## Quick Start

```typescript
import { JPKI_AP, JPKI_AP_EF } from '@aokiapp/mynacard';
import { selectDf, verify, readEfBinaryFull } from '@aokiapp/apdu-utils';

// Select JPKI application
const selectCmd = selectDf(JPKI_AP);

// Verify PIN for authentication
const verifyCmd = verify("1234", { ef: JPKI_AP_EF.AUTH_PIN });

// Read authentication certificate
const readCmd = readEfBinaryFull(JPKI_AP_EF.AUTH_CERT, session);
```

## Examples

### Working with JPKI Application

```typescript
import { JPKI_AP, JPKI_AP_EF } from '@aokiapp/mynacard';
import { selectDf, verify, readEfBinaryFull } from '@aokiapp/apdu-utils';

async function readJpkiAuthCertificate(session, pin) {
  // Select JPKI application
  await session.transmit(selectDf(JPKI_AP));
  
  // Verify authentication PIN (4 digits)
  const verifyResp = await session.transmit(
    verify(pin, { ef: JPKI_AP_EF.AUTH_PIN })
  );
  
  if (!verifyResp.isSuccess()) {
    if (verifyResp.sw1 === 0x63) {
      const remaining = verifyResp.sw2 & 0x0F;
      throw new Error(`Wrong PIN. ${remaining} attempts remaining`);
    }
    throw new Error('PIN verification failed');
  }
  
  // Read authentication certificate
  const certData = await readEfBinaryFull(JPKI_AP_EF.AUTH_CERT, session);
  return certData;
}
```

### Working with KENHOJO Application (Health Insurance)

```typescript
import { KENHOJO_AP, KENHOJO_AP_EF, schemaKenhojoBasicFour } from '@aokiapp/mynacard';
import { selectDf, verify, readEfBinaryFull } from '@aokiapp/apdu-utils';
import { SchemaParser } from '@aokiapp/tlv/parser';

async function readHealthInsuranceInfo(session, pin) {
  // Select KENHOJO application
  await session.transmit(selectDf(KENHOJO_AP));
  
  // Verify PIN (4 digits)
  await session.transmit(
    verify(pin, { ef: KENHOJO_AP_EF.PIN })
  );
  
  // Read basic information
  const data = await readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR, session);
  
  // Parse TLV data
  const parser = new SchemaParser(schemaKenhojoBasicFour);
  const parsed = parser.parse(data.buffer);
  
  return parsed;
}
```

### Working with KENKAKU Application (Residence Certificate)

```typescript
import { KENKAKU_AP, KENKAKU_AP_EF, schemaKenkakuMyNumber } from '@aokiapp/mynacard';
import { selectDf, verify, readEfBinaryFull } from '@aokiapp/apdu-utils';
import { SchemaParser } from '@aokiapp/tlv/parser';

async function readMyNumber(session, pin) {
  // Select KENKAKU application
  await session.transmit(selectDf(KENKAKU_AP));
  
  // Verify PIN (4 digits)
  await session.transmit(
    verify(pin, { ef: KENKAKU_AP_EF.PIN })
  );
  
  // Read My Number
  const data = await readEfBinaryFull(KENKAKU_AP_EF.MY_NUMBER, session);
  
  // Parse TLV data
  const parser = new SchemaParser(schemaKenkakuMyNumber);
  const parsed = parser.parse(data.buffer);
  
  return parsed;
}
```

### Complete Example: Reading Multiple Card Data

```typescript
import { 
  JPKI_AP, JPKI_AP_EF,
  KENHOJO_AP, KENHOJO_AP_EF,
  schemaKenhojoBasicFour,
  decodeJpkiCertificate
} from '@aokiapp/mynacard';

async function readCardInfo(session) {
  const result = {
    jpki: null,
    insurance: null
  };
  
  try {
    // Read JPKI certificate (no PIN required for public cert)
    await session.transmit(selectDf(JPKI_AP));
    const certData = await readEfBinaryFull(JPKI_AP_EF.AUTH_CERT_CA, session);
    result.jpki = decodeJpkiCertificate(certData);
  } catch (error) {
    console.error('JPKI read failed:', error);
  }
  
  try {
    // Read health insurance (requires PIN)
    await session.transmit(selectDf(KENHOJO_AP));
    await session.transmit(verify("1234", { ef: KENHOJO_AP_EF.PIN }));
    const data = await readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR, session);
    
    const parser = new SchemaParser(schemaKenhojoBasicFour);
    result.insurance = parser.parse(data.buffer);
  } catch (error) {
    console.error('Insurance read failed:', error);
  }
  
  return result;
}
```

## API Reference

### Application Identifiers

#### `JPKI_AP: Uint8Array`
JPKI (公的個人認証) Digital Certificate Application ID.

**Value:** `[0xD3, 0x92, 0xF0, 0x00, 0x26, 0x01, 0x00, 0x00, 0x00, 0x01]`

**Usage:** Select this application to access digital certificates and signature capabilities.

#### `KENHOJO_AP: Uint8Array`
KENHOJO (券面事項入力補助) Health Insurance Application ID.

**Value:** `[0xD3, 0x92, 0xF0, 0x00, 0x26, 0x01, 0x00, 0x00, 0x00, 0x02]`

**Usage:** Select this application to access health insurance information.

#### `KENKAKU_AP: Uint8Array`
KENKAKU (券面確認) Residence Certificate Application ID.

**Value:** `[0xD3, 0x92, 0xF0, 0x00, 0x26, 0x01, 0x00, 0x00, 0x00, 0x03]`

**Usage:** Select this application to access residence information and My Number.

---

### Elementary File IDs

#### JPKI_AP_EF (JPKI Application Files)

**Public Files (No PIN required):**
- `AUTH_CERT_CA: number` - Authentication CA certificate (File ID: 0x00 0x0A)
- `SIGN_CERT_CA: number` - Signature CA certificate (File ID: 0x00 0x0B)

**PIN-Protected Files:**
- `AUTH_PIN: number` - Authentication PIN (File ID: 0x00 0x18, 4 digits)
- `AUTH_KEY: number` - Authentication private key (File ID: 0x00 0x17)
- `AUTH_CERT: number` - User authentication certificate (File ID: 0x00 0x0A)
- `SIGN_PIN: number` - Signature PIN (File ID: 0x00 0x1B, 6-16 chars)
- `SIGN_KEY: number` - Signature private key (File ID: 0x00 0x1A)
- `SIGN_CERT: number` - User signature certificate (File ID: 0x00 0x01)

#### KENHOJO_AP_EF (Health Insurance Files)

- `PIN: number` - PIN verification (File ID: 0x00 0x12, 4 digits)
- `BASIC_FOUR: number` - Name, address, birth, gender (File ID: 0x00 0x02)
- `CERTIFICATE: number` - Insurance certificate (File ID: 0x00 0x04)
- `MY_NUMBER: number` - Individual number (File ID: 0x00 0x0D)
- `SIGNATURE: number` - Digital signature (File ID: 0x00 0x05)
- `SIGN_PINLESS: number` - PIN-less signature key (File ID: 0x00 0x1A)

#### KENKAKU_AP_EF (Residence Certificate Files)

- `PIN: number` - PIN verification (File ID: 0x00 0x12, 4 digits)
- `BASIC_FOUR: number` - Basic resident info (File ID: 0x00 0x02)
- `CERTIFICATE: number` - Residence certificate (File ID: 0x00 0x04)
- `MY_NUMBER: number` - Individual number PNG image (File ID: 0x00 0x0D)
- `ENTRIES: number` - Residence entries with images (File ID: 0x00 0x06)
- `SIGNATURE: number` - Digital signature (File ID: 0x00 0x05)

---

### TLV Schemas

Structured parsers for card TLV data. Use with `@aokiapp/tlv` SchemaParser.

#### `schemaKenhojoBasicFour`
Parses basic personal information from health insurance card.

**Parsed Fields:**
- `offsets: number[]` - Array of 16-bit offset values
- `name: string` - Full name in UTF-8
- `address: string` - Residence address in UTF-8
- `birth: string` - Birth date in format (e.g., "H01.01.01")
- `gender: string` - Gender code ("1" = male, "2" = female)

**Usage:**
```typescript
const parser = new SchemaParser(schemaKenhojoBasicFour);
const data = parser.parse(rawBytes.buffer);
console.log(data.name, data.address, data.birth, data.gender);
```

#### `schemaKenhojoSignature`
Parses signature data from health insurance card.

**Parsed Fields:**
- `kenhojoMyNumberHash: Uint8Array` - SHA-256 hash of My Number
- `kenhojoBasicFourHash: Uint8Array` - SHA-256 hash of BasicFour data
- `thisSignature: Uint8Array` - RSA signature bytes

#### `schemaKenkakuEntries`
Parses residence entries with embedded images.

**Parsed Fields:**
- `offsets: number[]` - Position offsets
- `birth: string` - Birth date
- `gender: string` - Gender code
- `publicKeyRaw: ArrayBuffer` - RSA public key (for verification)
- `namePng: Uint8Array` - Name as PNG image
- `addressPng: Uint8Array` - Address as PNG image
- `faceJp2: Uint8Array` - Face photo in JPEG 2000 format
- `thisSignature: Uint8Array` - Digital signature
- `expire: string` - Card expiration date
- `securityCodePng: Uint8Array` - Security code PNG

#### `schemaKenkakuMyNumber`
Parses My Number data from residence card.

**Parsed Fields:**
- `myNumberPng: Uint8Array` - My Number as PNG image
- `publicKeyRaw: ArrayBuffer` - RSA public key
- `thisSignature: Uint8Array` - Digital signature

---

### Utility Functions

#### `decodePublicKey(buffer: ArrayBuffer): Promise<CryptoKey>`
Decodes RSA public key from MynaCard TLV format to Web Crypto API key.

**Parameters:**
- `buffer: ArrayBuffer` - Raw public key data from card (exponent + modulus in TLV)

**Returns:** `Promise<CryptoKey>` - Web Crypto API key for signature verification
- Key type: RSA
- Algorithm: RSASSA-PKCS1-v1_5 with SHA-256
- Key operations: ["verify"]

**Usage:**
```typescript
const key = await decodePublicKey(parsed.publicKeyRaw);
const isValid = await crypto.subtle.verify(
  'RSASSA-PKCS1-v1_5',
  key,
  signature,
  data
);
```

#### `decodeText(buffer: ArrayBuffer): string`
Decodes UTF-8 text from card data.

**Parameters:**
- `buffer: ArrayBuffer` - Raw text data from card

**Returns:** `string` - Decoded UTF-8 text (supports Japanese characters)

**Usage:** Automatically called by TLV schemas for text fields.

#### `decodeOffsets(buffer: ArrayBuffer): number[]`
Decodes array of 16-bit big-endian offset values.

**Parameters:**
- `buffer: ArrayBuffer` - Raw offset data (multiple of 2 bytes)

**Returns:** `number[]` - Array of offset values

**Usage:** Used internally by schemas to parse data structure positions.

## PIN Requirements

- **JPKI Authentication PIN**: 4 digits
- **JPKI Signature PIN**: 6-16 alphanumeric characters
- **KENHOJO PIN**: 4 digits
- **KENKAKU PIN**: 4 digits

## License

ANAL-Tight-1.0.1 - See [LICENSE](../../LICENSE.md)
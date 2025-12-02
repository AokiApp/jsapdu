# MynaCard TLV Schema System

The MynaCard package defines structured TLV (Tag-Length-Value) schemas for parsing data from Japanese Individual Number Cards. These schemas provide type-safe parsing of complex card data structures.

## Schema Architecture

### TLV Tag Classes
MynaCard data uses different tag classes defined by ISO 7816-4:

```typescript
enum TagClass {
  Universal = 0,    // Standard ISO types
  Application = 1,  // Card application specific  
  Context = 2,      // Context-specific tags
  Private = 3       // Private/proprietary tags
}
```

### Schema Structure
```typescript
// Constructed schema (contains other TLV elements)
Schema.constructed(name, tagInfo, children)

// Primitive schema (contains raw data with decoder)
Schema.primitive(name, tagInfo, decoder)
```

## MynaCard Data Structure

### Certificate Schema (`schemaCertificate`)
Parses X.509-like certificate data with Application class tags:

```typescript
export const schemaCertificate = Schema.constructed("certificate", {
  tagClass: TagClass.Application,
  tagNumber: 0x21,  // A1 tag
}, [
  Schema.primitive("contents", {
    tagClass: TagClass.Application, 
    tagNumber: 0x4e  // AE tag
  }, (buffer) => ({
    issuer: buffer.slice(0, 16),      // 16-byte issuer ID
    subject: buffer.slice(16, 32),    // 16-byte subject ID  
    publicKeyRaw: buffer.slice(32)    // RSA public key components
  })),
  Schema.primitive("thisSignature", {
    tagClass: TagClass.Application,
    tagNumber: 0x37  // A7 tag
  }, decodeAsUint8Array)
]);
```

**Real-world usage:**
```typescript
const parser = new SchemaParser(schemaCertificate);
const cert = parser.parse(certBytes.buffer);

console.log(cert.contents.issuer);        // Certificate authority ID
console.log(cert.contents.subject);       // Card holder ID
console.log(cert.thisSignature);          // CA signature bytes
```

### Kenhojo (Health Insurance) Schemas

#### Basic Four Information (`schemaKenhojoBasicFour`)
Core personal data with Private class tags:

```typescript
export const schemaKenhojoBasicFour = Schema.constructed("kenhojoBasicFour", {}, [
  Schema.primitive("offsets", { tagClass: TagClass.Private, tagNumber: 0x21 }, decodeOffsets),
  Schema.primitive("name", { tagClass: TagClass.Private, tagNumber: 0x22 }, decodeText),
  Schema.primitive("address", { tagClass: TagClass.Private, tagNumber: 0x23 }, decodeText),
  Schema.primitive("birth", { tagClass: TagClass.Private, tagNumber: 0x24 }, decodeText),
  Schema.primitive("gender", { tagClass: TagClass.Private, tagNumber: 0x25 }, decodeText)
]);
```

**Tag mapping:**
- `E1` (0xE1) → offsets array
- `E2` (0xE2) → name (UTF-8 text)
- `E3` (0xE3) → address (UTF-8 text) 
- `E4` (0xE4) → birth date (UTF-8 text)
- `E5` (0xE5) → gender (UTF-8 text)

#### Digital Signature (`schemaKenhojoSignature`)
Hash verification data:

```typescript
export const schemaKenhojoSignature = Schema.constructed("kenhojoSignature", {
  tagClass: TagClass.Private,
  tagNumber: 0x30  // F0 tag
}, [
  Schema.primitive("kenhojoMyNumberHash", { tagClass: TagClass.Private, tagNumber: 0x31 }, decodeAsUint8Array),
  Schema.primitive("kenhojoBasicFourHash", { tagClass: TagClass.Private, tagNumber: 0x32 }, decodeAsUint8Array),
  Schema.primitive("thisSignature", { tagClass: TagClass.Private, tagNumber: 0x33 }, decodeAsUint8Array)
]);
```

### Kenkaku (Residence) Schemas

#### Entry Records (`schemaKenkakuEntries`)
Complete residence history with embedded images:

```typescript
export const schemaKenkakuEntries = Schema.constructed("kenkakuEntries", {}, [
  Schema.primitive("offsets", { tagClass: TagClass.Private, tagNumber: 0x21 }, decodeOffsets),
  Schema.primitive("birth", { tagClass: TagClass.Private, tagNumber: 0x22 }, decodeText),
  Schema.primitive("gender", { tagClass: TagClass.Private, tagNumber: 0x23 }, decodeText),
  Schema.primitive("publicKeyRaw", { tagClass: TagClass.Private, tagNumber: 0x24 }, decodeAsArrayBuffer),
  Schema.primitive("namePng", { tagClass: TagClass.Private, tagNumber: 0x25 }, decodeAsUint8Array),
  Schema.primitive("addressPng", { tagClass: TagClass.Private, tagNumber: 0x26 }, decodeAsUint8Array),
  Schema.primitive("faceJp2", { tagClass: TagClass.Private, tagNumber: 0x27 }, decodeAsUint8Array),
  Schema.primitive("thisSignature", { tagClass: TagClass.Private, tagNumber: 0x28 }, decodeAsUint8Array),
  Schema.primitive("expire", { tagClass: TagClass.Private, tagNumber: 0x29 }, decodeText),
  Schema.primitive("securityCodePng", { tagClass: TagClass.Private, tagNumber: 0x2a }, decodeAsUint8Array)
]);
```

**Image formats:**
- `namePng` / `addressPng` / `securityCodePng` → PNG image data
- `faceJp2` → JPEG 2000 compressed photo

## Custom Decoder Functions

### Text Decoder (`decodeText`)
```typescript
export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buffer);
}
```
Handles Japanese text in UTF-8 encoding (Hiragana, Katakana, Kanji).

### Offset Decoder (`decodeOffsets`)
```typescript
export function decodeOffsets(buffer: ArrayBuffer): number[] {
  const uint8 = new Uint8Array(buffer);
  const offsets = [];
  for (let i = 0; i < uint8.length; i += 2) {
    offsets.push((uint8[i] << 8) | uint8[i + 1]);  // Big-endian 16-bit
  }
  return offsets;
}
```
Parses array of 16-bit big-endian offset values for data positioning.

### RSA Public Key Decoder (`decodePublicKey`)
```typescript
export async function decodePublicKey(buffer: ArrayBuffer): Promise<CryptoKey> {
  const eParsed = BasicTLVParser.parse(buffer);           // Parse exponent
  const subBuffer = buffer.slice(eParsed.endOffset);
  const nParsed = BasicTLVParser.parse(subBuffer);        // Parse modulus
  
  return crypto.subtle.importKey("jwk", {
    kty: "RSA",
    e: arrayBufferToBase64url(eParsed.value),             // Exponent (usually 65537)
    n: arrayBufferToBase64url(nParsed.value),             // Modulus (2048-bit)
    key_ops: ["verify"],
    ext: true
  }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["verify"]);
}
```

## Real-World Usage Patterns

### Complete Data Extraction
```typescript
import { 
  schemaKenhojoBasicFour,
  schemaKenkakuEntries,
  decodePublicKey 
} from '@aokiapp/mynacard';
import { SchemaParser } from '@aokiapp/tlv/parser';

async function parseMynaCardData(basicFourBytes: Uint8Array, entriesBytes: Uint8Array) {
  // Parse basic information
  const basicParser = new SchemaParser(schemaKenhojoBasicFour);
  const basicData = basicParser.parse(basicFourBytes.buffer);
  
  // Parse residence entries with images
  const entriesParser = new SchemaParser(schemaKenkakuEntries);
  const entriesData = entriesParser.parse(entriesBytes.buffer);
  
  // Extract RSA public key
  const publicKey = await decodePublicKey(entriesData.publicKeyRaw);
  
  return {
    personal: {
      name: basicData.name,
      address: basicData.address,
      birth: basicData.birth,
      gender: basicData.gender
    },
    images: {
      face: entriesData.faceJp2,           // JPEG 2000 photo
      namePng: entriesData.namePng,        // PNG name image
      addressPng: entriesData.addressPng   // PNG address image
    },
    crypto: {
      publicKey,                           // Web Crypto API key
      signature: entriesData.thisSignature
    },
    metadata: {
      expire: entriesData.expire,
      offsets: entriesData.offsets
    }
  };
}
```

### Image Processing
```typescript
// Convert JP2 face photo to displayable format
function displayFacePhoto(jp2Bytes: Uint8Array) {
  const blob = new Blob([jp2Bytes], { type: 'image/jp2' });
  const url = URL.createObjectURL(blob);
  
  const img = document.createElement('img');
  img.src = url;
  document.body.appendChild(img);
}

// Extract PNG name image
function extractNameImage(pngBytes: Uint8Array): string {
  const blob = new Blob([pngBytes], { type: 'image/png' });
  return URL.createObjectURL(blob);
}
```

### Signature Verification
```typescript
async function verifySignature(data: Uint8Array, signature: Uint8Array, publicKey: CryptoKey): Promise<boolean> {
  return await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    data
  );
}
```

## Schema Testing Patterns

### Schema Validation
```typescript
describe('MynaCard TLV schemas', () => {
  test('should parse Kenhojo BasicFour correctly', () => {
    const mockData = new Uint8Array([
      0xE1, 0x04, 0x00, 0x10, 0x00, 0x20,           // Offsets
      0xE2, 0x09, 0xE5, 0xB1, 0x B1, 0xE7, 0x94, 0xB0, 0xE5, 0xA4, 0xAA, // "山田太" (name)
      0xE3, 0x15, 0xE6, 0x9D, 0xB1, 0xE4, 0xBA, 0xAC, 0xE9, 0x83, 0xBD, 0xE6, 0xB8, 0x8B, 0xE8, 0xB0, 0xB7, 0xE5, 0x8C, 0xBA, 0xE2, 0x80, 0xA6, // "東京都渋谷区…" (address)
      0xE4, 0x08, 0x48, 0x30, 0x31, 0x2E, 0x30, 0x31, 0x2E, 0x30, 0x31, // "H01.01.01" (birth)
      0xE5, 0x01, 0x31                                // "1" (gender)
    ]);
    
    const parser = new SchemaParser(schemaKenhojoBasicFour);
    const result = parser.parse(mockData.buffer);
    
    expect(result.name).toBe('山田太');
    expect(result.address).toBe('東京都渋谷区…');
    expect(result.birth).toBe('H01.01.01');
    expect(result.gender).toBe('1');
    expect(result.offsets).toEqual([0x0010, 0x0020]);
  });
});
```

### Error Handling
```typescript
try {
  const parser = new SchemaParser(schemaKenhojoBasicFour);
  const result = parser.parse(invalidData.buffer);
} catch (error) {
  if (error.message.includes('TLV parsing failed')) {
    // Handle corrupted card data
    console.error('Card data is corrupted or incomplete');
  }
}
```

## Performance Considerations

- **Lazy parsing**: Schemas parse on-demand, not eagerly
- **Memory efficiency**: Raw buffers shared, not copied
- **Type safety**: TypeScript ensures correct decoder usage
- **Validation**: Schema validates tag structure automatically

This TLV system provides robust, type-safe parsing of Japanese government ID card data while handling complex nested structures and multiple data formats.
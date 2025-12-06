# MynaCard CLI Examples (Node.js)

Command-line examples demonstrating how to read Japanese Individual Number Card (Myナンバーカード) data using PC/SC smart card readers.

## Overview

This directory contains practical Node.js CLI scripts for reading various MynaCard applications:

- **KENHOJO (券面事項入力補助)** - Health insurance application with basic personal information
- **KENKAKU (券面確認)** - Residence certificate application with detailed records and images
- **JPKI (公的個人認証)** - Public Key Infrastructure application (coming soon)

## Prerequisites

### Hardware

- **PC/SC-compatible smart card reader**
  - Recommended: ACS ACR122U, Sony RC-S380/P, Identiv uTrust
  - Must support ISO 14443 Type B or contact card interface
- **Japanese MynaCard (マイナンバーカード)**
  - Valid government-issued Individual Number Card
  - Know your 4-digit PIN for health insurance data
  - Know your 4-digit PIN-A for residence certificate data

### Software

- Node.js 18.0+ or compatible runtime (Bun, Deno with Node compatibility)
- PC/SC middleware:
  - **Windows**: Built-in (winscard.dll)
  - **macOS**: Built-in (PCSC.framework)
  - **Linux**: Install pcscd
    ```bash
    sudo apt-get install pcscd libpcsclite-dev  # Debian/Ubuntu
    sudo yum install pcsc-lite pcsc-lite-devel   # RHEL/CentOS
    ```

## Installation

```bash
cd examples/mynacard
npm install
npm run build
```

## Available Examples

### 1. Read Basic Four Information (KENHOJO)

Reads name, address, birth date, and gender from the health insurance application.

**File:** [`src/kenhojo/read-basic-four.ts`](./src/kenhojo/read-basic-four.ts)

**Required PIN:** 4-digit health insurance PIN (券面事項入力補助用PIN)

**Output:**
- Name (氏名) in UTF-8
- Address (住所) in UTF-8
- Birth date (生年月日) in Japanese calendar format
- Gender (性別) as numeric code
- SHA-256 hash of the data

**Usage:**
```bash
npm run build
node dist/src/kenhojo/read-basic-four.js
# Or with tsx:
npx tsx src/kenhojo/read-basic-four.ts
```

**Example Output:**
```
Enter PIN: ****
{
  offsets: [ 16, 32, 48, 64 ],
  name: '山田太郎',
  address: '東京都渋谷区道玄坂一丁目２番３号',
  birth: 'H01.01.01',
  gender: '1'
}
Hash: a3b2c1d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### 2. Read My Number (KENHOJO)

Reads the 12-digit Individual Number from the health insurance application.

**File:** [`src/kenhojo/read-my-number.ts`](./src/kenhojo/read-my-number.ts)

**Required PIN:** 4-digit health insurance PIN

**Output:**
- 12-digit Individual Number (マイナンバー)
- SHA-256 hash of the number

**Usage:**
```bash
node dist/src/kenhojo/read-my-number.js
```

**Example Output:**
```
Enter PIN: ****
123456789012
Hash: b4c3d2e1f0a9876543210fedcba9876543210fedcba9876543210fedcba9
```

**⚠️ Security Warning:** The Individual Number is highly sensitive personal information. Handle with extreme care and comply with Japanese privacy laws (個人情報保護法, マイナンバー法).

### 3. Read Certificate and Key (KENHOJO)

Reads the intermediate certificate and authentication key from the health insurance application.

**File:** [`src/kenhojo/read-certificate.ts`](./src/kenhojo/read-certificate.ts)

**Required PIN:** 4-digit health insurance PIN

**Output:**
- Intermediate certificate contents (issuer, subject, public key)
- Authentication key information
- Digital signatures

**Usage:**
```bash
node dist/src/kenhojo/read-certificate.js
```

### 4. Read Residence Entries (KENKAKU)

Reads detailed residence certificate information including embedded PNG/JPEG2000 images.

**File:** [`src/kenkaku/read-entries.ts`](./src/kenkaku/read-entries.ts)

**Required PIN:** 4-digit PIN-A for residence certificate (券面確認用PIN)

**Output:**
- Birth date and gender
- RSA public key (raw format)
- Name as PNG image
- Address as PNG image
- Face photo as JPEG 2000 image
- Expiration date
- Security code as PNG image
- Digital signature
- SHA-256 hashes of data segments

**Usage:**
```bash
node dist/src/kenkaku/read-entries.js
```

**Note:** This example includes image data extraction. To save images to files, modify the script to write the PNG/JP2 buffers.

### 5. Read Other KENKAKU Files

Additional scripts for reading various residence certificate files:

- **[`read-certificate.ts`](./src/kenkaku/read-certificate.ts)** - Residence certificate
- **[`read-my-number.ts`](./src/kenkaku/read-my-number.ts)** - Individual Number PNG image
- **[`read.ts`](./src/kenkaku/read.ts)** - Generic KENKAKU reader

## Code Structure

### Common Pattern

All examples follow this structure:

```typescript
async function main() {
  let platform: SmartCardPlatform | undefined;
  let device: SmartCardDevice | undefined;
  
  try {
    // 1. Initialize platform
    platform = await getPlatform();
    await platform.init();
    
    // 2. Acquire device
    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].id);
    
    // 3. Start session
    const session = await device.startSession();
    
    // 4. Select application
    const selectResponse = await session.transmit(selectDf(KENHOJO_AP));
    if (selectResponse.sw !== 0x9000) {
      throw new Error('Failed to select DF');
    }
    
    // 5. Verify PIN (with masked input)
    const pin = await askPassword('Enter PIN: ');
    const verifyResponse = await session.transmit(
      verify(pin, { ef: KENHOJO_AP_EF.PIN })
    );
    if (verifyResponse.sw !== 0x9000) {
      throw new Error('PIN verification failed');
    }
    
    // 6. Read data
    const response = await session.transmit(
      readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR)
    );
    
    // 7. Parse TLV data
    const parser = new SchemaParser(schemaKenhojoBasicFour);
    const parsed = parser.parse(response.arrayBuffer());
    
    console.log(parsed);
    
  } catch (error) {
    console.error('error:', error);
  } finally {
    // 8. Always cleanup
    await device?.release();
    await platform?.release();
  }
}

await main();
```

### Utility Functions

The [`src/utils.ts`](./src/utils.ts) file provides shared helpers:

#### `askPassword(query: string): Promise<string>`
Prompts for password input with masked display (asterisks).

**Features:**
- Raw terminal mode for character-by-character input
- Backspace support
- Ctrl+C cancellation
- No echo to terminal

**Usage:**
```typescript
const pin = await askPassword('Enter PIN: ');
```

#### `getPlatform(): Promise<SmartCardPlatform>`
Returns the appropriate platform for the current environment (PC/SC on Node.js).

#### `calculateBasicFourHash(buffer: ArrayBuffer): Promise<ArrayBuffer>`
Calculates SHA-256 hash of BasicFour data according to MynaCard specifications.

#### `calculateMyNumberHash(buffer: ArrayBuffer): Promise<ArrayBuffer>`
Calculates SHA-256 hash of Individual Number data.

#### `uint8ArrayToHexString(uint8Array: Uint8Array): string`
Converts byte array to uppercase hexadecimal string.

#### `arrayBufferToBase64(buffer: ArrayBuffer): string`
Converts ArrayBuffer to base64 string (Node.js or browser compatible).

## Troubleshooting

### "No readers found"

**Cause:** Reader not connected, drivers not installed, or PC/SC service not running.

**Solutions:**
- Verify reader is connected via USB and powered on
- Install reader drivers (usually automatic on modern OS)
- Check PC/SC service:
  - Windows: Services → Smart Card → ensure Running
  - macOS: Built-in, no action needed
  - Linux: `sudo systemctl status pcscd` → start if not running

### "Failed to establish context"

**Cause:** PC/SC subsystem not accessible.

**Solutions:**
- **Windows:** Restart Smart Card service
  ```powershell
  Restart-Service SCardSvr
  ```
- **macOS:** Check System Preferences → Security & Privacy → Privacy → NFC
- **Linux:** Restart pcscd
  ```bash
  sudo systemctl restart pcscd
  ```

### "PIN verification failed"

**Causes:**
1. Wrong PIN entered
2. Wrong PIN type for the selected application
3. PIN blocked due to too many failed attempts

**Solutions:**
- Health insurance PIN (券面事項入力補助用PIN) is 4 digits
- Residence certificate PIN-A is 4 digits  
- Check remaining attempts before card locks permanently
- If locked, contact your municipality to unlock

### "Failed to select DF"

**Cause:** Wrong application ID or card not genuine MynaCard.

**Solutions:**
- Ensure card is genuine government-issued MynaCard (not test card)
- Some applications require specific card versions
- Verify correct application constant (KENHOJO_AP, KENKAKU_AP, JPKI_AP)

### "Card removed during operation"

**Cause:** Card lost contact with reader during transaction.

**Solutions:**
- Keep card firmly on reader during entire operation
- For contact readers: ensure card is fully inserted
- For NFC readers: hold card steady for 5-10 seconds
- Avoid movement or interference during reading

### TypeScript Errors

If you encounter TypeScript errors during build:

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

## Security Considerations

1. **PIN Protection**
   - Never hardcode PINs in source code
   - Use masked input (`askPassword`) for terminal entry
   - Clear PIN from memory after use

2. **Data Handling**
   - Individual Number (マイナンバー) is highly sensitive
   - Comply with Japanese privacy laws
   - Implement proper access controls and logging
   - Encrypt data at rest and in transit

3. **Card Access**
   - Always release resources in `finally` blocks
   - Avoid concurrent access to same card
   - Monitor remaining PIN attempts to prevent lockout

## Related Documentation

- **[Examples Overview](../README.md)** - All available examples
- **[@aokiapp/mynacard Package](../../packages/mynacard/README.md)** - MynaCard constants and schemas
- **[@aokiapp/jsapdu-pcsc Package](../../packages/pcsc/README.md)** - PC/SC platform API
- **[@aokiapp/apdu-utils Package](../../packages/apdu-utils/README.md)** - APDU command builders
- **[TLV Schema System](../../packages/mynacard/docs/tlv-schemas.md)** - Data parsing details

## Adding New Examples

When creating new examples:

1. Follow the common pattern structure
2. Use utility functions from `utils.ts`
3. Always include proper error handling
4. Implement resource cleanup in `finally` blocks
5. Document required PINs and output format
6. Test on multiple platforms (Windows, macOS, Linux)

## License

ANAL-Tight-1.0.1 - See [LICENSE](../../LICENSE.md)
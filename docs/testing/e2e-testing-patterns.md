# End-to-End Testing Patterns

This document explains the comprehensive E2E testing strategy used for MynaCard integration, covering real hardware interaction patterns and test organization.

## Test Architecture Overview

The E2E tests are organized in a hierarchical pattern that mirrors real-world usage:

```
examples/mynacard-e2e/
├── mynacard.e2e.test.ts       # Core platform functionality
├── jpki_ap.test.ts            # JPKI application public certificates
├── kenhojo_ap.test.ts         # Health insurance application
├── kenkaku_ap.test.ts         # Residence certificate application  
└── randr.e2e.test.ts          # Research & development claims verification
```

## Test Environment Setup

### Global Test Configuration
```typescript
let platform: SmartCardPlatform;
let deviceInfos: DeviceInfo[];

beforeAll(async () => {
  platformManager = PcscPlatformManager.getInstance();
  platform = platformManager.getPlatform();
  await platform.init();
  deviceInfos = await platform.getDeviceInfo();
}, 30000); // 30 second timeout for hardware initialization
```

### Shared State Management
Each test suite maintains shared state for:
- **Platform instance**: Single PC/SC context across tests
- **Device list**: Available smart card readers
- **Timeout handling**: Hardware operations can be slow

## Core Testing Patterns

### 1. Hardware Availability Guards
```typescript
it("should have at least one reader", () => {
  expect(deviceInfos.length, "No readers found").toBeGreaterThan(0);
});

// Skip tests if no hardware available
if (deviceInfos.length === 0) return;
```

**Purpose:** Gracefully handle environments without smart card hardware.

### 2. Resource Lifecycle Management
```typescript
it("should read certificate file", async () => {
  if (deviceInfos.length === 0) return;
  
  let device: SmartCardDevice | null = null;
  let card: SmartCard | null = null;
  
  try {
    device = await platform.acquireDevice(deviceInfos[0].id);
    card = await device.startSession();
    
    // Test operations here...
    
  } finally {
    // Guaranteed cleanup
    if (card) await card.release();
    if (device) await device.release();
  }
});
```

**Key principles:**
- **RAII pattern**: Acquire resources in try block
- **Guaranteed cleanup**: Always release in finally block
- **Graceful degradation**: Skip tests if hardware unavailable

### 3. Application-Specific Test Organization

#### JPKI Application Tests (`jpki_ap.test.ts`)
Tests public certificate files that don't require PIN:

```typescript
const PUBLIC_CERT_FILES = [
  { name: "認証用CA証明書", fid: JPKI_AP_EF.AUTH_CERT_CA },
  { name: "署名用CA証明書", fid: JPKI_AP_EF.SIGN_CERT_CA },
  { name: "認証用証明書", fid: JPKI_AP_EF.AUTH_CERT },
  { name: "署名用証明書", fid: JPKI_AP_EF.SIGN_CERT }
];

for (const { name, fid } of PUBLIC_CERT_FILES) {
  it(`${name} READ BINARY`, async () => {
    // Test each certificate file individually
    await card.transmit(selectDf(JPKI_AP));
    await card.transmit(selectEf(fid));
    
    const readResp = await card.transmit(readBinary(0, 10));
    expect(readResp.sw1).toBeTypeOf("number");
    expect(readResp.sw2).toBeTypeOf("number");
  });
}
```

**Testing strategy:**
- **Parameterized tests**: Loop through all certificate types
- **Non-invasive**: Only read public data (no PIN required)
- **Minimal reads**: Read small amounts to verify accessibility

#### Kenhojo/Kenkaku Application Tests
Similar pattern but focused on public areas:

```typescript
const PUBLIC_FILES = [
  { name: "券面事項入力補助AP", fid: [0x00, 0x11] },
  { name: "券面事項入力補助用PIN", fid: [0x00, 0x12] }
];

describe("KENHOJO_AP public area E2E tests", () => {
  for (const { name, fid } of PUBLIC_FILES) {
    it(`${name} READ BINARY`, async () => {
      // Test file accessibility without PIN
    });
  }
});
```

## Advanced Testing Patterns

### 4. Research & Development Claims Verification (`randr.e2e.test.ts`)
This test suite verifies specific technical claims about MynaCard capabilities:

#### RSA-PSS Signature Support
```typescript
describe("RSA-PSS signature verification (80 2A 05 00)", () => {
  it("should support PSS algorithm 05 for Kenhojo PIN-less signature EF", async () => {
    // Select Kenhojo application
    const selectKenhojoApResponse = await card.transmit(selectKenhojoApCommand);
    expect(selectKenhojoApResponse.sw).toBe(0x9000);
    
    // Select PIN-less signature EF
    await card.transmit(selectEf(KENHOJO_AP_EF.SIGN_PINLESS));
    
    // Test RSA-PSS signature (algorithm 05)
    const command802A0500 = new CommandApdu(0x80, 0x2A, 0x05, 0x00, testData);
    const response = await card.transmit(command802A0500);
    
    // Verify PSS signature was created
    expect(response.sw).toBe(0x9000);
    expect(response.data.length).toBeGreaterThan(0);
  });
});
```

#### PIN-less Internal Authentication
```typescript
describe("PIN-free internal authentication verification (80 2A 00 00)", () => {
  it("should perform signature without PIN authentication", async () => {
    // Test that certain operations don't require PIN verification
    const response = await card.transmit(command802A0000);
    expect(response.sw).toBe(0x9000);
  });
});
```

### 5. Error Condition Testing
```typescript
describe("Authentication command verification (80 A2)", () => {
  it("should fail signature verification with invalid data (67 00)", async () => {
    // Send meaningless data that should fail CA signature verification
    const command80A200C1 = new CommandApdu(0x80, 0xA2, 0x00, 0xC1, invalidData);
    const response = await card.transmit(command80A200C1);
    
    // Expect specific error code for verification failure
    expect(response.sw).toBe(0x6700);
  });
});
```

## Test Data Management

### 1. Realistic Test Data
```typescript
// Use actual MynaCard constants and file structures
const testData = new Uint8Array([
  0x30, 0x31, 0x30, 0x0D, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20,
  // SHA-256 hash of test data...
]);
```

### 2. Dynamic Data Generation
```typescript
// Generate test data based on card responses
const atr = await card.getAtr();
const testHash = await crypto.subtle.digest('SHA-256', atr);
```

### 3. Error Boundary Testing
```typescript
// Test edge cases and error conditions
const oversizedApdu = new Uint8Array(65540); // Exceeds APDU limits
expect(() => card.transmit(oversizedApdu)).toThrow();
```

## Performance Testing Patterns

### 1. Timeout Verification
```typescript
it("should respect timeout limits", async () => {
  const start = Date.now();
  
  try {
    await device.waitForCardPresence(1000); // 1 second timeout
  } catch (error) {
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1500); // Should timeout within reasonable bounds
    expect(error.code).toBe('TIMEOUT');
  }
});
```

### 2. Concurrent Operation Testing
```typescript
it("should handle concurrent APDU transmission safely", async () => {
  const promises = Array(5).fill(0).map(() => 
    card.transmit(new CommandApdu(0x00, 0xB0, 0x00, 0x00, null, 1))
  );
  
  // All operations should complete without interference
  const responses = await Promise.all(promises);
  responses.forEach(resp => expect(resp).toBeDefined());
});
```

## Platform-Specific Considerations

### 1. Windows PC/SC Behavior
```typescript
// Test Windows-specific reader name encoding
if (process.platform === 'win32') {
  it("should handle UTF-16LE reader names", async () => {
    const devices = await platform.getDeviceInfo();
    devices.forEach(device => {
      expect(device.name).not.toContain('\0'); // Null terminator should be stripped
    });
  });
}
```

### 2. macOS Framework Integration
```typescript
// Test macOS PCSC framework behavior
if (process.platform === 'darwin') {
  it("should work with PCSC.framework", async () => {
    // macOS-specific tests
  });
}
```

### 3. Linux libpcsclite Compatibility
```typescript
// Test Linux PC/SC lite behavior
if (process.platform === 'linux') {
  it("should work with pcscd service", async () => {
    // Linux-specific tests
  });
}
```

## Test Organization Best Practices

### 1. Descriptive Test Names
```typescript
// Bad: Generic names
it("should work", () => {});

// Good: Specific, meaningful names  
it("should read JPKI authentication certificate without PIN", async () => {});
it("should fail RSA-PSS signature with invalid algorithm parameter", async () => {});
```

### 2. Test Independence
```typescript
// Each test should be self-contained
describe("JPKI certificate reading", () => {
  beforeEach(async () => {
    // Reset to known state before each test
    if (card) {
      await card.reset();
    }
  });
  
  it("should read auth certificate", () => {
    // Test doesn't depend on other tests
  });
});
```

### 3. Error Message Clarity
```typescript
it("should have adequate response data", () => {
  expect(response.data.length, 
    `Certificate data too small: ${response.data.length} bytes`
  ).toBeGreaterThan(100);
});
```

This comprehensive E2E testing strategy ensures reliable integration with real MynaCard hardware while providing clear documentation of expected card behavior and API usage patterns.
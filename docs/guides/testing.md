# Testing Guide

Comprehensive guide for testing SmartCard applications built with jsapdu.

## Overview

Testing SmartCard applications presents unique challenges due to hardware dependencies, security constraints, and various card types. This guide covers strategies for unit testing, integration testing, and end-to-end testing with jsapdu.

## Testing Strategy

### Testing Pyramid

```
    ┌─────────────────┐
    │   E2E Tests     │  ← Real hardware, full scenarios
    │   (Few tests)   │
    ├─────────────────┤
    │ Integration     │  ← Mock hardware, API testing
    │ Tests           │
    │ (Some tests)    │
    ├─────────────────┤
    │  Unit Tests     │  ← Pure functions, business logic
    │  (Many tests)   │
    └─────────────────┘
```

### Test Categories

1. **Unit Tests**: Test individual functions and classes without hardware
2. **Integration Tests**: Test component interactions with mocked hardware
3. **End-to-End Tests**: Test complete scenarios with real hardware
4. **Contract Tests**: Verify API contracts between components

## Setup and Configuration

### Test Environment

```bash
# Install test dependencies
npm install --save-dev vitest @types/node

# Basic test setup
mkdir tests
mkdir tests/unit
mkdir tests/integration
mkdir tests/e2e
```

### Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000, // SmartCard operations can be slow
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
```

## Unit Testing

### Testing Pure Functions

Test functions that don't require hardware:

```typescript
// tests/unit/apdu-utils.test.ts
import { describe, it, expect } from "vitest";
import { selectDf, selectEf, readBinary } from "@aokiapp/apdu-utils";

describe("APDU Utilities", () => {
  describe("selectDf", () => {
    it("should create correct SELECT DF command", () => {
      const aid = "A0000000041010";
      const command = selectDf(aid);

      expect(command.cla).toBe(0x00);
      expect(command.ins).toBe(0xa4);
      expect(command.p1).toBe(0x04);
      expect(command.p2).toBe(0x0c);

      const expectedData = new Uint8Array([
        0xa0, 0x00, 0x00, 0x00, 0x04, 0x10, 0x10,
      ]);
      expect(command.data).toEqual(expectedData);
    });

    it("should handle FCI request", () => {
      const command = selectDf("A0000000041010", true);
      expect(command.p2).toBe(0x00);
      expect(command.le).toBe(0x00);
    });

    it("should validate AID length", () => {
      expect(() => selectDf("")).toThrow("Invalid DF identifier");
      expect(() => selectDf("A".repeat(34))).toThrow("Invalid DF identifier");
    });
  });

  describe("readBinary", () => {
    it("should create standard READ BINARY command", () => {
      const command = readBinary(0x0000, 256);

      expect(command.cla).toBe(0x00);
      expect(command.ins).toBe(0xb0);
      expect(command.p1).toBe(0x00);
      expect(command.p2).toBe(0x00);
      expect(command.le).toBe(256);
    });

    it("should handle extended APDU", () => {
      const command = readBinary(0x0000, 65536, true);
      const bytes = command.toUint8Array();

      // Extended APDU has different structure
      expect(bytes.length).toBeGreaterThan(7);
    });
  });
});
```

### Testing TLV Parsing

```typescript
// tests/unit/tlv-parser.test.ts
import { describe, it, expect } from "vitest";
import { BasicTLVParser, SchemaParser, Schema } from "@aokiapp/tlv-parser";

describe("TLV Parser", () => {
  describe("BasicTLVParser", () => {
    it("should parse simple TLV", () => {
      // Tag: 0x01 (Universal, Primitive, 1)
      // Length: 0x04
      // Value: [0x01, 0x02, 0x03, 0x04]
      const buffer = new Uint8Array([0x01, 0x04, 0x01, 0x02, 0x03, 0x04])
        .buffer;

      const result = BasicTLVParser.parse(buffer);

      expect(result.tag.tagNumber).toBe(1);
      expect(result.tag.constructed).toBe(false);
      expect(result.length).toBe(4);
      expect(new Uint8Array(result.value)).toEqual(
        new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      );
    });

    it("should parse constructed TLV", () => {
      // Constructed tag with nested TLVs
      const buffer = new Uint8Array([
        0x30,
        0x06, // SEQUENCE, length 6
        0x01,
        0x01,
        0xff, // BOOLEAN true
        0x02,
        0x01,
        0x42, // INTEGER 66
      ]).buffer;

      const result = BasicTLVParser.parse(buffer);

      expect(result.tag.constructed).toBe(true);
      expect(result.length).toBe(6);
    });
  });

  describe("SchemaParser", () => {
    it("should parse with simple schema", () => {
      const schema = Schema.constructed("test", [
        Schema.primitive("name", (buf) => new TextDecoder().decode(buf)),
        Schema.primitive("age", (buf) => new DataView(buf).getUint8(0)),
      ]);

      // Mock TLV data representing: name="John", age=25
      const buffer = createMockTLVBuffer([
        { tag: 0x81, value: new TextEncoder().encode("John") },
        { tag: 0x82, value: new Uint8Array([25]) },
      ]);

      const parser = new SchemaParser(schema);
      const result = parser.parse(buffer);

      expect(result.name).toBe("John");
      expect(result.age).toBe(25);
    });
  });
});

// Helper function to create mock TLV data
function createMockTLVBuffer(
  entries: Array<{ tag: number; value: Uint8Array }>,
): ArrayBuffer {
  let totalLength = 0;
  entries.forEach((entry) => {
    totalLength += 2 + entry.value.length; // tag + length + value
  });

  const buffer = new Uint8Array(totalLength + 2); // +2 for outer tag/length
  buffer[0] = 0x30; // SEQUENCE
  buffer[1] = totalLength;

  let offset = 2;
  entries.forEach((entry) => {
    buffer[offset++] = entry.tag;
    buffer[offset++] = entry.value.length;
    buffer.set(entry.value, offset);
    offset += entry.value.length;
  });

  return buffer.buffer;
}
```

### Testing Error Handling

```typescript
// tests/unit/error-handling.test.ts
import { describe, it, expect } from "vitest";
import {
  SmartCardError,
  ResourceError,
  TimeoutError,
  ValidationError,
} from "@aokiapp/jsapdu-interface";

describe("Error Handling", () => {
  it("should create SmartCardError with correct properties", () => {
    const error = new SmartCardError("CARD_NOT_PRESENT", "No card found");

    expect(error.code).toBe("CARD_NOT_PRESENT");
    expect(error.message).toBe("No card found");
    expect(error.name).toBe("SmartCardError");
  });

  it("should provide safe error messages", () => {
    const error = new SmartCardError(
      "PLATFORM_ERROR",
      "Internal error details",
      new Error("Sensitive info"),
    );

    const safeMessage = error.getSafeMessage();
    expect(safeMessage).toBe("Internal error details");
    expect(safeMessage).not.toContain("Sensitive info");
  });

  it("should provide debug information", () => {
    const cause = new Error("Original error");
    const error = new SmartCardError("TIMEOUT", "Operation timed out", cause);

    const debugInfo = error.getDebugInfo();
    expect(debugInfo.code).toBe("TIMEOUT");
    expect(debugInfo.message).toBe("Operation timed out");
    expect(debugInfo.cause?.message).toBe("Original error");
  });

  it("should create specialized error types", () => {
    const resourceError = new ResourceError(
      "Too many connections",
      "connections",
      5,
    );
    expect(resourceError.code).toBe("RESOURCE_LIMIT");
    expect(resourceError.resourceType).toBe("connections");
    expect(resourceError.limit).toBe(5);

    const timeoutError = new TimeoutError("Card timeout", "transmit", 5000);
    expect(timeoutError.code).toBe("TIMEOUT");
    expect(timeoutError.operationType).toBe("transmit");
    expect(timeoutError.timeoutMs).toBe(5000);

    const validationError = new ValidationError("Invalid PIN", "pin", "123");
    expect(validationError.code).toBe("INVALID_PARAMETER");
    expect(validationError.parameter).toBe("pin");
    expect(validationError.value).toBe("123");
  });
});
```

## Integration Testing

### Mocking Hardware Dependencies

Create mock implementations for testing:

```typescript
// tests/mocks/mock-platform.ts
import {
  SmartCardPlatform,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCard,
} from "@aokiapp/jsapdu-interface";

export class MockPlatform extends SmartCardPlatform {
  private devices: MockDeviceInfo[] = [];

  constructor(deviceCount = 1) {
    super();
    for (let i = 0; i < deviceCount; i++) {
      this.devices.push(new MockDeviceInfo(`Reader ${i}`));
    }
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  async release(): Promise<void> {
    this.initialized = false;
  }

  async getDeviceInfo(): Promise<SmartCardDeviceInfo[]> {
    this.assertInitialized();
    return this.devices;
  }

  async acquireDevice(id: string): Promise<SmartCardDevice> {
    this.assertInitialized();
    const device = this.devices.find((d) => d.id === id);
    if (!device) {
      throw new SmartCardError("READER_ERROR", "Device not found");
    }
    return new MockDevice(this, id);
  }
}

export class MockDevice extends SmartCardDevice {
  private sessionActive = false;
  private cardPresent = true;

  constructor(
    platform: SmartCardPlatform,
    private deviceId: string,
  ) {
    super(platform);
  }

  getDeviceInfo(): SmartCardDeviceInfo {
    return new MockDeviceInfo(this.deviceId);
  }

  isSessionActive(): boolean {
    return this.sessionActive;
  }

  async isDeviceAvailable(): Promise<boolean> {
    return true;
  }

  async isCardPresent(): Promise<boolean> {
    return this.cardPresent;
  }

  async startSession(): Promise<SmartCard> {
    if (!this.cardPresent) {
      throw new SmartCardError("CARD_NOT_PRESENT", "No card present");
    }
    this.sessionActive = true;
    return new MockCard(this);
  }

  async waitForCardPresence(timeout: number): Promise<void> {
    if (!this.cardPresent) {
      throw new SmartCardError("TIMEOUT", "Card not present");
    }
  }

  async startHceSession(): Promise<EmulatedCard> {
    throw new SmartCardError(
      "UNSUPPORTED_OPERATION",
      "HCE not supported in mock",
    );
  }

  async release(): Promise<void> {
    this.sessionActive = false;
  }

  // Test helpers
  setCardPresent(present: boolean) {
    this.cardPresent = present;
  }
}

export class MockCard extends SmartCard {
  private active = true;
  private responses = new Map<string, ResponseApdu>();

  constructor(device: SmartCardDevice) {
    super(device);
  }

  async getAtr(): Promise<Uint8Array> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Card not active");
    }
    // Return mock ATR
    return new Uint8Array([0x3b, 0x00]);
  }

  async transmit(apdu: CommandApdu): Promise<ResponseApdu> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Card not active");
    }

    const key = apdu.toHexString();
    const mockResponse = this.responses.get(key);

    if (mockResponse) {
      return mockResponse;
    }

    // Default success response
    return ResponseApdu.fromUint8Array(new Uint8Array([0x90, 0x00]));
  }

  async reset(): Promise<void> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Card not active");
    }
  }

  async release(): Promise<void> {
    this.active = false;
  }

  // Test helpers
  setResponse(command: CommandApdu | string, response: ResponseApdu) {
    const key = typeof command === "string" ? command : command.toHexString();
    this.responses.set(key, response);
  }

  isActive(): boolean {
    return this.active;
  }
}

class MockDeviceInfo extends SmartCardDeviceInfo {
  constructor(public readonly id: string) {
    super();
  }

  readonly devicePath = `/mock/${this.id}`;
  readonly friendlyName = `Mock ${this.id}`;
  readonly description = `Mock SmartCard reader for testing`;
  readonly supportsApdu = true;
  readonly supportsHce = false;
  readonly isIntegratedDevice = false;
  readonly isRemovableDevice = true;
  readonly d2cProtocol = "iso7816" as const;
  readonly p2dProtocol = "usb" as const;
  readonly apduApi = ["mock"];
}
```

### Integration Test Examples

```typescript
// tests/integration/card-operations.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { MockPlatform, MockCard } from "../mocks/mock-platform.js";
import { selectDf, readEfBinaryFull } from "@aokiapp/apdu-utils";
import { ResponseApdu } from "@aokiapp/jsapdu-interface";

describe("Card Operations Integration", () => {
  let platform: MockPlatform;
  let card: MockCard;

  beforeEach(async () => {
    platform = new MockPlatform();
    await platform.init();

    const devices = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(devices[0].id);
    card = (await device.startSession()) as MockCard;
  });

  it("should select application and read file", async () => {
    // Setup mock responses
    const selectResponse = ResponseApdu.fromUint8Array(
      new Uint8Array([0x90, 0x00]),
    );
    card.setResponse(selectDf("A0000000041010"), selectResponse);

    const fileData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x90, 0x00]);
    const readResponse = ResponseApdu.fromUint8Array(fileData);
    card.setResponse(readEfBinaryFull(0x01), readResponse);

    // Test the flow
    const selectResult = await card.transmit(selectDf("A0000000041010"));
    expect(selectResult.sw).toBe(0x9000);

    const readResult = await card.transmit(readEfBinaryFull(0x01));
    expect(readResult.sw).toBe(0x9000);
    expect(readResult.data).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  });

  it("should handle card communication errors", async () => {
    // Setup error response
    const errorResponse = ResponseApdu.fromUint8Array(
      new Uint8Array([0x6a, 0x82]),
    );
    card.setResponse("00A4040007A0000000041010", errorResponse);

    const result = await card.transmit(selectDf("A0000000041010"));
    expect(result.sw).toBe(0x6a82); // File not found
  });
});
```

## End-to-End Testing

### Hardware-Dependent Tests

These tests require actual SmartCard hardware:

```typescript
// tests/e2e/hardware.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import {
  SmartCardPlatform,
  SmartCardDevice,
  SmartCard,
} from "@aokiapp/jsapdu-interface";

describe("Hardware End-to-End Tests", () => {
  let platform: SmartCardPlatform;
  let device: SmartCardDevice;
  let card: SmartCard;

  beforeAll(async () => {
    // Skip if no hardware available
    if (process.env.SKIP_HARDWARE_TESTS) {
      return;
    }

    const manager = PcscPlatformManager.getInstance();
    platform = manager.getPlatform();
    await platform.init();

    const devices = await platform.getDeviceInfo();
    if (devices.length === 0) {
      throw new Error(
        "No card readers found. Set SKIP_HARDWARE_TESTS=1 to skip.",
      );
    }

    device = await platform.acquireDevice(devices[0].id);

    if (!(await device.isCardPresent())) {
      throw new Error("No card present. Insert a test card.");
    }

    card = await device.startSession();
  });

  afterAll(async () => {
    if (process.env.SKIP_HARDWARE_TESTS) {
      return;
    }

    await card?.release();
    await device?.release();
    await platform?.release();
  });

  it("should read card ATR", async () => {
    if (process.env.SKIP_HARDWARE_TESTS) {
      return;
    }

    const atr = await card.getAtr();
    expect(atr).toBeInstanceOf(Uint8Array);
    expect(atr.length).toBeGreaterThan(0);
    console.log(
      "ATR:",
      Array.from(atr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" "),
    );
  });

  it("should handle invalid commands gracefully", async () => {
    if (process.env.SKIP_HARDWARE_TESTS) {
      return;
    }

    // Send invalid command
    const invalidCommand = new CommandApdu(0xff, 0xff, 0xff, 0xff);
    const response = await card.transmit(invalidCommand);

    // Should get error response, not throw exception
    expect(response.sw).not.toBe(0x9000);
    expect(response.sw1).toBeGreaterThan(0);
    expect(response.sw2).toBeGreaterThan(0);
  });
});
```

### MynaCard End-to-End Tests

```typescript
// tests/e2e/mynacard.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { selectDf } from "@aokiapp/apdu-utils";
import { JPKI_AP, KENHOJO_AP, KENKAKU_AP } from "@aokiapp/mynacard";

describe("MynaCard End-to-End Tests", () => {
  let platform, device, card;

  beforeAll(async () => {
    if (process.env.SKIP_MYNACARD_TESTS) {
      return;
    }

    const manager = PcscPlatformManager.getInstance();
    platform = manager.getPlatform();
    await platform.init();

    const devices = await platform.getDeviceInfo();
    device = await platform.acquireDevice(devices[0].id);
    card = await device.startSession();
  });

  afterAll(async () => {
    if (process.env.SKIP_MYNACARD_TESTS) {
      return;
    }

    await card?.release();
    await device?.release();
    await platform?.release();
  });

  it("should select JPKI application", async () => {
    if (process.env.SKIP_MYNACARD_TESTS) {
      return;
    }

    const response = await card.transmit(selectDf(JPKI_AP));

    // Should succeed or fail with specific error
    if (response.sw === 0x9000) {
      console.log("JPKI application selected successfully");
    } else if (response.sw === 0x6a82) {
      console.log("JPKI application not found (expected for non-MynaCard)");
    } else {
      console.log(`Unexpected response: ${response.sw.toString(16)}`);
    }

    expect([0x9000, 0x6a82]).toContain(response.sw);
  });

  it("should select Kenhojo application", async () => {
    if (process.env.SKIP_MYNACARD_TESTS) {
      return;
    }

    const response = await card.transmit(selectDf(KENHOJO_AP));
    expect([0x9000, 0x6a82]).toContain(response.sw);
  });

  it("should select Kenkaku application", async () => {
    if (process.env.SKIP_MYNACARD_TESTS) {
      return;
    }

    const response = await card.transmit(selectDf(KENKAKU_AP));
    expect([0x9000, 0x6a82]).toContain(response.sw);
  });
});
```

## Testing Best Practices

### Environment Variables

Use environment variables to control test behavior:

```bash
# Skip hardware-dependent tests
export SKIP_HARDWARE_TESTS=1

# Skip MynaCard-specific tests
export SKIP_MYNACARD_TESTS=1

# Use specific card reader
export TEST_READER_NAME="ACS CCID USB Reader 0"

# Test timeout
export TEST_TIMEOUT=30000
```

### Test Configuration

```typescript
// tests/test-config.ts
export const testConfig = {
  skipHardwareTests: process.env.SKIP_HARDWARE_TESTS === "1",
  skipMynaCardTests: process.env.SKIP_MYNACARD_TESTS === "1",
  testReaderName: process.env.TEST_READER_NAME,
  testTimeout: parseInt(process.env.TEST_TIMEOUT || "30000", 10),

  // Test data
  testAid: process.env.TEST_AID || "A0000000041010",
  testPin: process.env.TEST_PIN, // Don't set default for security
};
```

### Security in Tests

```typescript
// Never hardcode sensitive data
const testPin = process.env.TEST_PIN;
if (!testPin && !testConfig.skipHardwareTests) {
  throw new Error("TEST_PIN environment variable required for hardware tests");
}

// Clear sensitive data after use
function clearTestData(data: string) {
  // In real implementations, use secure memory clearing
  data = "";
}

// Use mock data for unit tests
const mockPin = "1234"; // Safe for unit tests
const realPin = testPin; // From environment for E2E tests
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run test:integration

  # Hardware tests only run when specifically triggered
  hardware-tests:
    runs-on: self-hosted # Requires custom runner with hardware
    if: github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run test:e2e
        env:
          TEST_PIN: ${{ secrets.TEST_PIN }}
```

### Test Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:coverage": "vitest run --coverage",
    "test:hardware": "SKIP_HARDWARE_TESTS=0 vitest run tests/e2e"
  }
}
```

## Debugging Tests

### Logging

```typescript
import { describe, it, expect } from "vitest";

describe("Debug Tests", () => {
  it("should log APDU communication", async () => {
    const command = selectDf("A0000000041010");
    console.log("Sending:", command.toHexString());

    const response = await card.transmit(command);
    console.log("Received:", response.sw.toString(16));
    console.log(
      "Data:",
      Array.from(response.data)
        .map((b) => b.toString(16))
        .join(" "),
    );

    expect(response.sw).toBe(0x9000);
  });
});
```

### Test Helpers

```typescript
// tests/helpers/test-utils.ts
export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
  return new Uint8Array(bytes);
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectResponseSW(
  response: ResponseApdu,
  expectedSW: number,
) {
  expect(response.sw).toBe(expectedSW);
  if (response.sw !== expectedSW) {
    console.error(
      `Expected SW: ${expectedSW.toString(16)}, Got: ${response.sw.toString(16)}`,
    );
  }
}

export function createMockCard(responses: Record<string, string>): MockCard {
  const card = new MockCard(null as any);

  Object.entries(responses).forEach(([command, response]) => {
    const responseBytes = hexToUint8Array(response);
    card.setResponse(command, ResponseApdu.fromUint8Array(responseBytes));
  });

  return card;
}
```

## Performance Testing

### Benchmarking

```typescript
// tests/performance/benchmarks.test.ts
import { describe, it } from "vitest";
import { performance } from "perf_hooks";

describe("Performance Benchmarks", () => {
  it("should benchmark APDU construction", () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const command = new CommandApdu(0x00, 0xa4, 0x04, 0x00, null, 0x00);
      command.toUint8Array();
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`Average APDU construction time: ${avgTime.toFixed(3)}ms`);
    expect(avgTime).toBeLessThan(1); // Should be sub-millisecond
  });

  it("should benchmark TLV parsing", () => {
    const tlvData = new Uint8Array([0x30, 0x04, 0x01, 0x01, 0xff, 0x02]).buffer;
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      BasicTLVParser.parse(tlvData);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`Average TLV parsing time: ${avgTime.toFixed(3)}ms`);
    expect(avgTime).toBeLessThan(5);
  });
});
```

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/test-data.ts
export const testData = {
  // Mock ATRs for different card types
  atrs: {
    mynacard: new Uint8Array([
      0x3b, 0xfc, 0x13, 0x00, 0x00, 0x81, 0x31, 0xfe, 0x15, 0x59, 0x75, 0x62,
      0x69, 0x6b, 0x65, 0x79, 0x40,
    ]),
    generic: new Uint8Array([0x3b, 0x00]),
  },

  // Mock APDU responses
  responses: {
    success: "9000",
    fileNotFound: "6A82",
    wrongPin: "6300",
    pinBlocked: "63C0",
  },

  // Test certificates (mock data)
  certificates: {
    rsa2048: "308201...", // Mock certificate data
  },

  // Mock TLV structures
  tlvStructures: {
    basicInfo: new Uint8Array([
      0x30,
      0x20, // SEQUENCE, length 32
      0x81,
      0x08,
      0x48,
      0x65,
      0x6c,
      0x6c,
      0x6f,
      0x20,
      0x00,
      0x00, // Name: "Hello"
      0x82,
      0x10,
      0x54,
      0x6f,
      0x6b,
      0x79,
      0x6f,
      0x2c,
      0x20,
      0x4a,
      0x61,
      0x70,
      0x61,
      0x6e,
      0x00,
      0x00,
      0x00,
      0x00, // Address: "Tokyo, Japan"
    ]),
  },
};
```

This comprehensive testing guide covers all aspects of testing SmartCard applications with jsapdu, from unit tests to hardware integration testing, providing a solid foundation for reliable SmartCard software development.

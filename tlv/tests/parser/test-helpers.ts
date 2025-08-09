import { expect } from "vitest";
import { TagClass } from "../../src/parser";

/**
 * Test data factory for creating various buffer types
 */
export const TestData = {
  createBuffer: (data: number[]): ArrayBuffer => {
    const buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
    return buffer;
  },

  createStringBuffer: (str: string): ArrayBuffer => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    const buffer = new ArrayBuffer(encoded.length);
    new Uint8Array(buffer).set(encoded);
    return buffer;
  },

  createHelloBuffer: (): ArrayBuffer => {
    return TestData.createStringBuffer("Hello");
  },

  createLargeBuffer: (size: number = 1000): ArrayBuffer => {
    const buffer = new ArrayBuffer(size);
    new Uint8Array(buffer).fill(0xaa);
    return buffer;
  },

  // Create TLV encoded buffers for testing parsing
  createTlvBuffer: (tag: number, value: ArrayBuffer): ArrayBuffer => {
    const valueLength = value.byteLength;
    let result: Uint8Array;

    if (valueLength < 128) {
      // Short form length
      result = new Uint8Array(2 + valueLength);
      result[0] = tag;
      result[1] = valueLength;
      result.set(new Uint8Array(value), 2);
    } else {
      // Long form length
      const lengthBytes: number[] = [];
      let tempLen = valueLength;
      do {
        lengthBytes.unshift(tempLen & 0xff);
        tempLen = Math.floor(tempLen / 256);
      } while (tempLen > 0);

      result = new Uint8Array(2 + lengthBytes.length + valueLength);
      result[0] = tag;
      result[1] = 0x80 | lengthBytes.length;
      result.set(lengthBytes, 2);
      result.set(new Uint8Array(value), 2 + lengthBytes.length);
    }

    return result.buffer;
  },

  // Create constructed TLV buffer
  createConstructedTlvBuffer: (
    tag: number,
    children: ArrayBuffer[],
  ): ArrayBuffer => {
    const totalChildLength = children.reduce(
      (sum, child) => sum + child.byteLength,
      0,
    );
    const constructedTag = tag | 0x20; // Set constructed bit

    const childrenData = new Uint8Array(totalChildLength);
    let offset = 0;
    for (const child of children) {
      childrenData.set(new Uint8Array(child), offset);
      offset += child.byteLength;
    }

    return TestData.createTlvBuffer(constructedTag, childrenData.buffer);
  },
  // Buffer配列を連結するユーティリティ
  concatBuffers: (buffers: ArrayBuffer[]): ArrayBuffer => {
    const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) {
      out.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }
    return out.buffer;
  },
};

/**
 * Common decoding functions for primitive data types
 */
export const Decoders = {
  utf8String: (buffer: ArrayBuffer): string => {
    return new TextDecoder("utf-8").decode(buffer);
  },

  string: (buffer: ArrayBuffer): string => {
    return Decoders.utf8String(buffer);
  },

  integer: (buffer: ArrayBuffer): number => {
    if (buffer.byteLength === 0) return 0;

    const view = new DataView(buffer);
    let result = 0;
    for (let i = 0; i < buffer.byteLength; i++) {
      result = (result << 8) | view.getUint8(i);
    }
    return result;
  },

  number: (buffer: ArrayBuffer): number => {
    return Decoders.integer(buffer);
  },

  singleByte: (buffer: ArrayBuffer): number => {
    if (buffer.byteLength !== 1) throw new Error("Expected single byte");
    return new Uint8Array(buffer)[0];
  },

  boolean: (buffer: ArrayBuffer): boolean => {
    if (buffer.byteLength !== 1)
      throw new Error("Expected single byte for boolean");
    return new Uint8Array(buffer)[0] !== 0x00;
  },

  asyncString: async (buffer: ArrayBuffer): Promise<string> => {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 1));
    return Decoders.utf8String(buffer);
  },

  uint8Array: (buffer: ArrayBuffer): Uint8Array => {
    return new Uint8Array(buffer);
  },
};

/**
 * Common tag definitions following ASN.1/DER standards
 */
export const CommonTags = {
  // Universal class tags
  BOOLEAN: { tagClass: TagClass.Universal, tagNumber: 1 },
  INTEGER: { tagClass: TagClass.Universal, tagNumber: 2 },
  BIT_STRING: { tagClass: TagClass.Universal, tagNumber: 3 },
  OCTET_STRING: { tagClass: TagClass.Universal, tagNumber: 4 },
  NULL: { tagClass: TagClass.Universal, tagNumber: 5 },
  UTF8_STRING: { tagClass: TagClass.Universal, tagNumber: 12 },
  SEQUENCE: { tagClass: TagClass.Universal, tagNumber: 16 },
  SET: { tagClass: TagClass.Universal, tagNumber: 17 },

  // Context-specific tags
  CONTEXT_SPECIFIC_0: { tagClass: TagClass.ContextSpecific, tagNumber: 0 },
  CONTEXT_SPECIFIC_1: { tagClass: TagClass.ContextSpecific, tagNumber: 1 },
  CONTEXT_SPECIFIC_2: { tagClass: TagClass.ContextSpecific, tagNumber: 2 },

  // Application tags
  APPLICATION_0: { tagClass: TagClass.Application, tagNumber: 0 },
  APPLICATION_1: { tagClass: TagClass.Application, tagNumber: 1 },
  APPLICATION_2: { tagClass: TagClass.Application, tagNumber: 2 },

  // Private tags
  PRIVATE_0: { tagClass: TagClass.Private, tagNumber: 0 },
  PRIVATE_1: { tagClass: TagClass.Private, tagNumber: 1 },
};

/**
 * Assertion helpers for testing parsed results
 */
export const ExpectHelpers = {
  /**
   * Assert that parsed result has expected string value
   */
  expectStringValue: (actual: unknown, expected: string) => {
    expect(actual).toBe(expected);
  },

  /**
   * Assert that parsed result has expected number value
   */
  expectNumberValue: (actual: unknown, expected: number) => {
    expect(actual).toBe(expected);
  },

  /**
   * Assert that parsed result has expected boolean value
   */
  expectBooleanValue: (actual: unknown, expected: boolean) => {
    expect(actual).toBe(expected);
  },

  /**
   * Assert that buffer contents match expected bytes
   */
  expectBufferBytes: (buffer: ArrayBuffer, expectedBytes: number[]) => {
    const actual = Array.from(new Uint8Array(buffer));
    expect(actual).toEqual(expectedBytes);
  },

  /**
   * Assert that ArrayBuffer matches expected content
   */
  expectArrayBufferContent: (actual: ArrayBuffer, expected: ArrayBuffer) => {
    expect(new Uint8Array(actual)).toEqual(new Uint8Array(expected));
  },

  /**
   * Assert that parsed result is an ArrayBuffer
   */
  expectArrayBuffer: (actual: unknown) => {
    expect(actual).toBeInstanceOf(ArrayBuffer);
  },

  /**
   * Assert that object has expected structure
   */
  expectObjectStructure: (actual: unknown, expectedKeys: string[]) => {
    expect(typeof actual).toBe("object");
    expect(actual).not.toBe(null);
    for (const key of expectedKeys) {
      expect(actual).toHaveProperty(key);
    }
  },

  /**
   * Assert that Uint8Array matches expected bytes
   */
  expectUint8ArrayBytes: (actual: Uint8Array, expectedBytes: number[]) => {
    expect(Array.from(actual)).toEqual(expectedBytes);
  },
};

/**
 * Sample test data for different scenarios
 */
export const SampleData = {
  simpleText: "Hello, World!",
  numbers: [42, 0, 255, 65535],
  booleans: [true, false],
  emptyBuffer: new ArrayBuffer(0),

  // Nested structure example data
  certificate: {
    version: 3,
    serialNumber: "123456789",
    issuer: "Test CA",
    subject: "Test Subject",
  },

  // Large data for testing length encoding
  largeBinary: TestData.createLargeBuffer(300), // > 127 bytes to test long form length
};

/**
 * Create sample TLV data for cross-package testing
 */
export const SampleTlvData = {
  // Simple OCTET STRING
  octetString: TestData.createTlvBuffer(
    0x04,
    TestData.createStringBuffer("test"),
  ),

  // UTF8 String
  utf8String: TestData.createTlvBuffer(
    0x0c,
    TestData.createStringBuffer("Hello TLV"),
  ),

  // INTEGER
  integer: TestData.createTlvBuffer(0x02, TestData.createBuffer([0x01, 0x23])),

  // BOOLEAN true
  booleanTrue: TestData.createTlvBuffer(0x01, TestData.createBuffer([0xff])),

  // BOOLEAN false
  booleanFalse: TestData.createTlvBuffer(0x01, TestData.createBuffer([0x00])),

  // Context-specific [0]
  contextSpecific0: TestData.createTlvBuffer(
    0x80,
    TestData.createStringBuffer("context"),
  ),

  // Application [1]
  application1: TestData.createTlvBuffer(
    0x41,
    TestData.createStringBuffer("application"),
  ),

  // Private [0]
  private0: TestData.createTlvBuffer(
    0xc0,
    TestData.createStringBuffer("private"),
  ),
};

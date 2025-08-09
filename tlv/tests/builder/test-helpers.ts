import { expect } from "vitest";
import { TagClass } from "../../src/builder";

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

    return result.buffer as ArrayBuffer;
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
};

/**
 * Common encoding functions for primitive data types
 */
export const Encoders = {
  utf8String: (str: string): ArrayBuffer => {
    return TestData.createStringBuffer(str);
  },
  /**
   * Alias for utf8String to keep test code readable
   */
  string: (str: string): ArrayBuffer => {
    return Encoders.utf8String(str);
  },

  integer: (num: number): ArrayBuffer => {
    if (num === 0) {
      return new ArrayBuffer(1); // INTEGER 0 is encoded as single 0x00 byte
    }

    // Calculate minimum bytes needed
    let tempNum = Math.abs(num);
    let byteCount = 0;
    while (tempNum > 0) {
      tempNum >>= 8;
      byteCount++;
    }

    const buffer = new ArrayBuffer(byteCount);
    const view = new DataView(buffer);

    // Store in big-endian format
    for (let i = byteCount - 1; i >= 0; i--) {
      view.setUint8(i, num & 0xff);
      num >>= 8;
    }

    return buffer;
  },
  /**
   * Alias for integer encoder to accept generic number naming
   */
  number: (num: number): ArrayBuffer => {
    return Encoders.integer(num);
  },

  singleByte: (byte: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(1);
    new Uint8Array(buffer)[0] = byte;
    return buffer;
  },

  boolean: (value: boolean): ArrayBuffer => {
    const buffer = new ArrayBuffer(1);
    new Uint8Array(buffer)[0] = value ? 0xff : 0x00;
    return buffer;
  },

  asyncString: async (str: string): Promise<ArrayBuffer> => {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 1));
    return Encoders.utf8String(str);
  },

  bitString: (bits: { unusedBits: number; data: Uint8Array }): ArrayBuffer => {
    const buffer = new ArrayBuffer(bits.data.length + 1);
    const view = new Uint8Array(buffer);
    view[0] = bits.unusedBits;
    view.set(bits.data, 1);
    return buffer;
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
 * Behavior assertion helpers for DER-encoded ArrayBuffer structures
 */
export const ExpectHelpers = {
  /**
   * Assert that DER-encoded buffer has the expected tag information
   */
  expectTagMatches: (
    buffer: ArrayBuffer,
    expectedTag: {
      tagClass: TagClass;
      tagNumber: number;
      constructed?: boolean;
    },
  ) => {
    const bytes = new Uint8Array(buffer);
    expect(bytes.length).toBeGreaterThan(0);

    // Extract tag information from first byte(s)
    const firstByte = bytes[0];
    const actualTagClass = (firstByte & 0xc0) >> 6;
    const actualConstructed = !!(firstByte & 0x20);
    let actualTagNumber = firstByte & 0x1f;

    // Handle high tag numbers (multi-byte)
    if (actualTagNumber === 0x1f && bytes.length > 1) {
      actualTagNumber = 0;
      let offset = 1;
      let b: number;
      do {
        b = bytes[offset++];
        actualTagNumber = (actualTagNumber << 7) | (b & 0x7f);
      } while (b & 0x80);
    }

    expect(actualTagClass).toBe(expectedTag.tagClass);
    expect(actualTagNumber).toBe(expectedTag.tagNumber);
    expect(actualConstructed).toBe(expectedTag.constructed ?? false);
  },

  /**
   * Assert that DER-encoded buffer has the expected tag information (alias for compatibility)
   */
  expectTagInfo: (
    buffer: ArrayBuffer,
    expectedTag: {
      tagClass: TagClass;
      tagNumber: number;
      constructed?: boolean;
    },
  ) => {
    ExpectHelpers.expectTagMatches(buffer, expectedTag);
  },

  /**
   * Assert that DER-encoded buffer contains expected string value
   */
  expectStringValue: (buffer: ArrayBuffer, expectedString: string) => {
    const bytes = new Uint8Array(buffer);
    // Skip T and L to get to V (simplified - assumes single byte length)
    const valueStart = bytes[1] < 0x80 ? 2 : 2 + (bytes[1] & 0x7f);
    const valueLength =
      bytes[1] < 0x80
        ? bytes[1]
        : bytes
            .slice(2, 2 + (bytes[1] & 0x7f))
            .reduce((acc, b) => (acc << 8) | b, 0);

    const decoder = new TextDecoder();
    const actualString = decoder.decode(
      buffer.slice(valueStart, valueStart + valueLength),
    );
    expect(actualString).toBe(expectedString);
  },

  /**
   * Assert that DER-encoded buffer has expected total length
   */
  expectLength: (buffer: ArrayBuffer, expectedLength: number) => {
    expect(buffer.byteLength).toBe(expectedLength);
  },

  /**
   * Assert that buffer is valid DER encoding
   */
  expectValidDerEncoding: (buffer: ArrayBuffer) => {
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);

    const bytes = new Uint8Array(buffer);
    // Basic validation: should have at least T and L
    expect(bytes.length).toBeGreaterThanOrEqual(2);

    // Length should be definite (DER requirement)
    const lengthByte = bytes[1];
    if (lengthByte & 0x80) {
      // Long form - should not be 0x80 (indefinite length not allowed in DER)
      expect(lengthByte).not.toBe(0x80);
    }
  },

  /**
   * Assert that buffer contents match expected bytes
   */
  expectBufferBytes: (buffer: ArrayBuffer, expectedBytes: number[]) => {
    const actual = Array.from(new Uint8Array(buffer));
    expect(actual).toEqual(expectedBytes);
  },

  /**
   * Assert that DER-encoded buffer contains expected numeric value
   */
  expectNumberValue: (buffer: ArrayBuffer, expectedNumber: number) => {
    const bytes = new Uint8Array(buffer);
    // Skip T and L to get to V (simplified)
    const valueStart = bytes[1] < 0x80 ? 2 : 2 + (bytes[1] & 0x7f);
    const valueLength =
      bytes[1] < 0x80
        ? bytes[1]
        : bytes
            .slice(2, 2 + (bytes[1] & 0x7f))
            .reduce((acc, b) => (acc << 8) | b, 0);

    let actual = 0;
    for (let i = valueStart; i < valueStart + valueLength; i++) {
      actual = (actual << 8) | bytes[i];
    }
    expect(actual).toBe(expectedNumber);
  },

  /**
   * Assert that DER-encoded buffer represents a constructed type
   */
  expectConstructedFieldCount: (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    const constructedFlag = !!(bytes[0] & 0x20);
    expect(constructedFlag).toBe(true);
  },
};

/**
 * Alias for behavior assertions (for backward compatibility)
 */
export const BehaviorAssertions = ExpectHelpers;

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

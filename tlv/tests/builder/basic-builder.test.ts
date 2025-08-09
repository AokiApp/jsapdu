import { describe, expect, test } from "vitest";
import { BasicTLVBuilder, TagClass } from "../../src/builder";
import { TestData, BehaviorAssertions } from "./test-helpers";

/**
 * Helper to create TLV structure for testing
 */
function createTlvStructure(
  value: ArrayBuffer,
  tagClass: TagClass,
  tagNumber: number,
  constructed = false,
) {
  return {
    tag: { tagClass, tagNumber, constructed },
    length: value.byteLength,
    value,
    endOffset: 0,
  };
}

describe("BasicTLVBuilder - DER encoding behavior", () => {
  describe("Tag encoding behavior", () => {
    test("should encode Universal class tags correctly", () => {
      // Given: A TLV structure with Universal tag class
      const value = TestData.createBuffer([0x01, 0x02, 0x03, 0x04]);
      const tlv = createTlvStructure(value, TagClass.Universal, 2, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Result should be properly DER-encoded with Universal tag
      const bytes = new Uint8Array(result);
      expect(bytes[0] & 0xc0).toBe(0x00); // Universal class bits
      expect(bytes[0] & 0x1f).toBe(2); // Tag number 2
      expect(bytes[0] & 0x20).toBe(0); // Not constructed
      BehaviorAssertions.expectValidDerEncoding(result);
    });

    test("should encode Application class tags correctly", () => {
      // Given: A TLV structure with Application tag class
      const value = new ArrayBuffer(0);
      const tlv = createTlvStructure(value, TagClass.Application, 15, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Result should have Application class bits set
      const bytes = new Uint8Array(result);
      expect(bytes[0] & 0xc0).toBe(0x40); // Application class bits
      expect(bytes[0] & 0x1f).toBe(15); // Tag number 15
    });

    test("should encode Context-Specific class tags correctly", () => {
      // Given: A TLV structure with Context-Specific tag
      const testData = "Hello, World!";
      const value = TestData.createStringBuffer(testData);
      const tlv = createTlvStructure(value, TagClass.ContextSpecific, 0, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Result should have Context-Specific class bits set
      const bytes = new Uint8Array(result);
      expect(bytes[0] & 0xc0).toBe(0x80); // Context-Specific class bits
      expect(bytes[0] & 0x1f).toBe(0); // Tag number 0
    });

    test("should encode Private class tags correctly", () => {
      // Given: A TLV structure with Private tag class
      const value = TestData.createBuffer([0xff]);
      const tlv = createTlvStructure(value, TagClass.Private, 31, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Result should have Private class bits and handle high tag number
      const bytes = new Uint8Array(result);
      expect(bytes[0] & 0xc0).toBe(0xc0); // Private class bits
      expect(bytes[0] & 0x1f).toBe(0x1f); // Indicates multi-byte tag number
    });
  });

  describe("Constructed flag behavior", () => {
    test("should encode constructed SEQUENCE properly", () => {
      // Given: A SEQUENCE structure (constructed)
      const value = new ArrayBuffer(5);
      const tlv = createTlvStructure(value, TagClass.Universal, 16, true);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Constructed bit should be set
      const bytes = new Uint8Array(result);
      expect(bytes[0] & 0x20).toBe(0x20); // Constructed bit set
      expect(bytes[0] & 0x1f).toBe(16); // SEQUENCE tag number
    });

    test("should encode primitive types without constructed flag", () => {
      // Given: A primitive type (not constructed)
      const value = new ArrayBuffer(1);
      const tlv = createTlvStructure(value, TagClass.Universal, 4, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Constructed bit should not be set
      const bytes = new Uint8Array(result);
      expect(bytes[0] & 0x20).toBe(0); // Constructed bit not set
    });
  });

  describe("Length encoding behavior", () => {
    test("should encode short lengths (0-127) in definite short form", () => {
      // Given: A TLV with short length
      const value = new ArrayBuffer(50);
      const tlv = createTlvStructure(value, TagClass.Universal, 0, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Length should be encoded in short form
      const bytes = new Uint8Array(result);
      expect(bytes[1]).toBe(50);
      expect(bytes[1] & 0x80).toBe(0); // Short form indicator
    });

    test("should encode long lengths (128+) in definite long form", () => {
      // Given: A TLV with long length
      const value = new ArrayBuffer(200);
      const tlv = createTlvStructure(value, TagClass.Universal, 0, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Length should be encoded in long form
      const bytes = new Uint8Array(result);
      expect(bytes[1] & 0x80).toBe(0x80); // Long form indicator
    });

    test("should handle empty values correctly", () => {
      // Given: A TLV with empty value
      const value = new ArrayBuffer(0);
      const tlv = createTlvStructure(value, TagClass.Universal, 5, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Should produce valid TLV with zero length
      const bytes = new Uint8Array(result);
      expect(bytes.length).toBe(2); // Tag + Length only
      expect(bytes[1]).toBe(0); // Zero length
    });
  });

  describe("DER compliance behavior", () => {
    test("should produce DER-compliant encoding for OCTET STRING", () => {
      // Given: An OCTET STRING with specific data
      const value = TestData.createBuffer([0x01, 0x02, 0x03, 0x04, 0x05]);
      const tlv = createTlvStructure(value, TagClass.Universal, 4, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Should produce valid DER-encoded OCTET STRING
      const bytes = new Uint8Array(result);
      expect(bytes[0]).toBe(0x04); // OCTET STRING tag
      expect(bytes[1]).toBe(0x05); // Length = 5
      BehaviorAssertions.expectBufferBytes(
        result.slice(2),
        [0x01, 0x02, 0x03, 0x04, 0x05],
      );
    });

    test("should handle large data structures efficiently", () => {
      // Given: A large data structure
      const largeSize = 1000;
      const value = TestData.createLargeBuffer(largeSize);
      const tlv = createTlvStructure(value, TagClass.Universal, 0, false);

      // When: Building DER encoding
      const result = BasicTLVBuilder.build(tlv);

      // Then: Should handle large structures without issues
      expect(result.byteLength).toBeGreaterThan(largeSize);
      const bytes = new Uint8Array(result);
      expect(bytes[1] & 0x80).toBe(0x80); // Long form length encoding
    });
  });

  describe("Error handling behavior", () => {
    test("should validate tag number ranges", () => {
      // Given: Invalid tag numbers
      const value = new ArrayBuffer(1);
      const invalidNegativeTlv = createTlvStructure(
        value,
        TagClass.Universal,
        -1,
        false,
      );
      const invalidLargeTlv = createTlvStructure(
        value,
        TagClass.Universal,
        Number.MAX_SAFE_INTEGER,
        false,
      );

      // When/Then: Should reject invalid tag numbers
      expect(() => BasicTLVBuilder.build(invalidNegativeTlv)).toThrow(
        /tag number/i,
      );
      expect(() => BasicTLVBuilder.build(invalidLargeTlv)).toThrow(
        /tag number/i,
      );
    });

    test("should validate tag class values", () => {
      // Given: Invalid tag class
      const value = new ArrayBuffer(1);
      const invalidTlv = createTlvStructure(value, 999 as TagClass, 0, false);

      // When/Then: Should reject invalid tag class
      expect(() => BasicTLVBuilder.build(invalidTlv)).toThrow(/tag class/i);
    });
  });
});

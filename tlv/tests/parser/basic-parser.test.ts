import { describe, expect, test } from "vitest";
import { BasicTLVParser, TagClass } from "../../src/parser";
import { TestData, ExpectHelpers, SampleTlvData } from "./test-helpers";

describe("BasicTLVParser - Core parsing functionality", () => {
  describe("Tag parsing behavior", () => {
    test("should parse Universal class tags correctly", () => {
      // Given: TLV data with Universal OCTET STRING tag (0x04)
      const buffer = SampleTlvData.octetString;

      // When: Parsing the TLV structure
      const result = BasicTLVParser.parse(buffer);

      // Then: Should correctly identify Universal OCTET STRING
      expect(result.tag.tagClass).toBe(TagClass.Universal);
      expect(result.tag.tagNumber).toBe(4);
      expect(result.tag.constructed).toBe(false);
      expect(result.length).toBe(4); // "test".length

      // Verify content
      const decoder = new TextDecoder();
      expect(decoder.decode(result.value)).toBe("test");
    });

    test("should parse Application class tags correctly", () => {
      // Given: TLV data with Application tag [1]
      const buffer = SampleTlvData.application1;

      // When: Parsing the TLV structure
      const result = BasicTLVParser.parse(buffer);

      // Then: Should correctly identify Application tag [1]
      expect(result.tag.tagClass).toBe(TagClass.Application);
      expect(result.tag.tagNumber).toBe(1);
      expect(result.tag.constructed).toBe(false);

      // Verify content
      const decoder = new TextDecoder();
      expect(decoder.decode(result.value)).toBe("application");
    });

    test("should parse Context-Specific class tags correctly", () => {
      // Given: TLV data with Context-Specific tag [0]
      const buffer = SampleTlvData.contextSpecific0;

      // When: Parsing the TLV structure
      const result = BasicTLVParser.parse(buffer);

      // Then: Should correctly identify Context-Specific tag [0]
      expect(result.tag.tagClass).toBe(TagClass.ContextSpecific);
      expect(result.tag.tagNumber).toBe(0);
      expect(result.tag.constructed).toBe(false);

      // Verify content
      const decoder = new TextDecoder();
      expect(decoder.decode(result.value)).toBe("context");
    });

    test("should parse Private class tags correctly", () => {
      // Given: TLV data with Private tag [0]
      const buffer = SampleTlvData.private0;

      // When: Parsing the TLV structure
      const result = BasicTLVParser.parse(buffer);

      // Then: Should correctly identify Private tag [0]
      expect(result.tag.tagClass).toBe(TagClass.Private);
      expect(result.tag.tagNumber).toBe(0);
      expect(result.tag.constructed).toBe(false);

      // Verify content
      const decoder = new TextDecoder();
      expect(decoder.decode(result.value)).toBe("private");
    });
  });

  describe("Constructed flag parsing", () => {
    test("should parse constructed SEQUENCE correctly", () => {
      // Given: Constructed SEQUENCE containing two OCTET STRINGs
      const child1 = TestData.createTlvBuffer(
        0x04,
        TestData.createStringBuffer("first"),
      );
      const child2 = TestData.createTlvBuffer(
        0x04,
        TestData.createStringBuffer("second"),
      );
      const sequence = TestData.createConstructedTlvBuffer(0x30, [
        child1,
        child2,
      ]);

      // When: Parsing the constructed TLV
      const result = BasicTLVParser.parse(sequence);

      // Then: Should correctly identify as constructed SEQUENCE
      expect(result.tag.tagClass).toBe(TagClass.Universal);
      expect(result.tag.tagNumber).toBe(16); // SEQUENCE
      expect(result.tag.constructed).toBe(true);
      expect(result.value.byteLength).toBeGreaterThan(0);
    });

    test("should parse primitive types with constructed flag false", () => {
      // Given: Primitive OCTET STRING
      const buffer = SampleTlvData.octetString;

      // When: Parsing the primitive TLV
      const result = BasicTLVParser.parse(buffer);

      // Then: Constructed flag should be false
      expect(result.tag.constructed).toBe(false);
    });
  });

  describe("Length encoding parsing", () => {
    test("should parse short form length (0-127) correctly", () => {
      // Given: TLV with short length
      const shortData = TestData.createStringBuffer("short");
      const buffer = TestData.createTlvBuffer(0x04, shortData);

      // When: Parsing the TLV
      const result = BasicTLVParser.parse(buffer);

      // Then: Should parse length correctly
      expect(result.length).toBe(5); // "short".length
      expect(result.value.byteLength).toBe(5);

      const decoder = new TextDecoder();
      expect(decoder.decode(result.value)).toBe("short");
    });

    test("should parse long form length (128+) correctly", () => {
      // Given: TLV with long length (large data > 127 bytes)
      const largeData = TestData.createLargeBuffer(200);
      const buffer = TestData.createTlvBuffer(0x04, largeData);

      // When: Parsing the TLV
      const result = BasicTLVParser.parse(buffer);

      // Then: Should parse long form length correctly
      expect(result.length).toBe(200);
      expect(result.value.byteLength).toBe(200);

      // Verify content (all bytes should be 0xAA as per createLargeBuffer)
      const bytes = new Uint8Array(result.value);
      expect(bytes[0]).toBe(0xaa);
      expect(bytes[199]).toBe(0xaa);
    });

    test("should handle empty values correctly", () => {
      // Given: TLV with empty value
      const emptyData = new ArrayBuffer(0);
      const buffer = TestData.createTlvBuffer(0x04, emptyData);

      // When: Parsing the empty TLV
      const result = BasicTLVParser.parse(buffer);

      // Then: Should handle empty value correctly
      expect(result.length).toBe(0);
      expect(result.value.byteLength).toBe(0);
    });
  });

  describe("High tag number parsing", () => {
    test("should parse high tag numbers (>30) correctly", () => {
      // Given: TLV with high tag number (using multi-byte encoding)
      // Tag 100 in Context-Specific class: 0x9F 0x64
      const highTagBuffer = TestData.createBuffer([
        0x9f,
        0x64, // Context-specific tag 100 (multi-byte)
        0x05, // Length: 5
        0x68,
        0x65,
        0x6c,
        0x6c,
        0x6f, // "hello"
      ]);

      // When: Parsing the high tag number TLV
      const result = BasicTLVParser.parse(highTagBuffer);

      // Then: Should correctly parse high tag number
      expect(result.tag.tagClass).toBe(TagClass.ContextSpecific);
      expect(result.tag.tagNumber).toBe(100);
      expect(result.tag.constructed).toBe(false);
      expect(result.length).toBe(5);

      const decoder = new TextDecoder();
      expect(decoder.decode(result.value)).toBe("hello");
    });
  });

  describe("End offset tracking", () => {
    test("should track end offset correctly for single TLV", () => {
      // Given: Simple TLV structure
      const buffer = SampleTlvData.utf8String;

      // When: Parsing the TLV
      const result = BasicTLVParser.parse(buffer);

      // Then: End offset should point to the end of the TLV
      expect(result.endOffset).toBe(buffer.byteLength);
      expect(result.endOffset).toBeGreaterThan(0);
    });

    test("should handle consecutive TLV parsing with correct offsets", () => {
      // Given: Buffer containing two consecutive TLVs
      const tlv1 = SampleTlvData.octetString;
      const tlv2 = SampleTlvData.utf8String;

      const combined = new Uint8Array(tlv1.byteLength + tlv2.byteLength);
      combined.set(new Uint8Array(tlv1), 0);
      combined.set(new Uint8Array(tlv2), tlv1.byteLength);

      // When: Parsing first TLV
      const result1 = BasicTLVParser.parse(combined.buffer);

      // Then: End offset should allow parsing of second TLV
      expect(result1.endOffset).toBe(tlv1.byteLength);

      // When: Parsing second TLV from the offset
      const remainingBuffer = combined.buffer.slice(result1.endOffset);
      const result2 = BasicTLVParser.parse(remainingBuffer);

      // Then: Second TLV should be parsed correctly
      expect(result2.tag.tagClass).toBe(TagClass.Universal);
      expect(result2.tag.tagNumber).toBe(12); // UTF8_STRING

      const decoder = new TextDecoder();
      expect(decoder.decode(result2.value)).toBe("Hello TLV");
    });
  });

  describe("Data type parsing", () => {
    test("should parse BOOLEAN values correctly", () => {
      // Given: BOOLEAN true and false values
      const booleanTrue = SampleTlvData.booleanTrue;
      const booleanFalse = SampleTlvData.booleanFalse;

      // When: Parsing BOOLEAN TLVs
      const resultTrue = BasicTLVParser.parse(booleanTrue);
      const resultFalse = BasicTLVParser.parse(booleanFalse);

      // Then: Should parse BOOLEAN tags and values correctly
      expect(resultTrue.tag.tagNumber).toBe(1); // BOOLEAN
      expect(resultFalse.tag.tagNumber).toBe(1); // BOOLEAN

      expect(new Uint8Array(resultTrue.value)[0]).toBe(0xff);
      expect(new Uint8Array(resultFalse.value)[0]).toBe(0x00);
    });

    test("should parse INTEGER values correctly", () => {
      // Given: INTEGER TLV
      const buffer = SampleTlvData.integer;

      // When: Parsing INTEGER TLV
      const result = BasicTLVParser.parse(buffer);

      // Then: Should parse INTEGER tag and value correctly
      expect(result.tag.tagNumber).toBe(2); // INTEGER
      ExpectHelpers.expectBufferBytes(result.value, [0x01, 0x23]);
    });
  });
});

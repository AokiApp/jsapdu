import { describe, expect, test } from "vitest";
import {
  BasicTLVParser,
  SchemaParser,
  Schema as ParserSchema,
  TagClass,
} from "../../src/parser";
import {
  BasicTLVBuilder,
  SchemaBuilder,
  Schema as BuilderSchema,
} from "@aokiapp/tlv-builder";
import {
  TestData,
  Decoders,
  CommonTags,
  ExpectHelpers,
  SampleTlvData,
} from "./test-helpers";

describe("TLV Parser -> Builder Integration - Decode then Encode", () => {
  describe("BasicTLVParser -> BasicTLVBuilder roundtrip", () => {
    test("should decode and encode primitive OCTET STRING", () => {
      // Given: Pre-encoded TLV buffer
      const originalBuffer = SampleTlvData.octetString;

      // When: Decoding with BasicTLVParser
      const parsed = BasicTLVParser.parse(originalBuffer);

      // And: Re-encoding with BasicTLVBuilder
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should produce identical binary data
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode UTF8 STRING", () => {
      // Given: Pre-encoded UTF8 STRING
      const originalBuffer = SampleTlvData.utf8String;

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(originalBuffer);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should be identical
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode INTEGER", () => {
      // Given: Pre-encoded INTEGER
      const originalBuffer = SampleTlvData.integer;

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(originalBuffer);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should be identical
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode BOOLEAN values", () => {
      // Given: Pre-encoded BOOLEAN true and false
      const booleanTrueBuffer = SampleTlvData.booleanTrue;
      const booleanFalseBuffer = SampleTlvData.booleanFalse;

      // When: Decoding and re-encoding both
      const parsedTrue = BasicTLVParser.parse(booleanTrueBuffer);
      const parsedFalse = BasicTLVParser.parse(booleanFalseBuffer);
      const reEncodedTrue = BasicTLVBuilder.build(parsedTrue);
      const reEncodedFalse = BasicTLVBuilder.build(parsedFalse);

      // Then: Should be identical
      expect(new Uint8Array(reEncodedTrue)).toEqual(
        new Uint8Array(booleanTrueBuffer),
      );
      expect(new Uint8Array(reEncodedFalse)).toEqual(
        new Uint8Array(booleanFalseBuffer),
      );
    });

    test("should decode and encode Context-Specific tags", () => {
      // Given: Pre-encoded Context-Specific [0] tag
      const originalBuffer = SampleTlvData.contextSpecific0;

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(originalBuffer);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should preserve tag class and number
      expect(parsed.tag.tagClass).toBe(TagClass.ContextSpecific);
      expect(parsed.tag.tagNumber).toBe(0);
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode Application tags", () => {
      // Given: Pre-encoded Application [1] tag
      const originalBuffer = SampleTlvData.application1;

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(originalBuffer);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should preserve Application tag
      expect(parsed.tag.tagClass).toBe(TagClass.Application);
      expect(parsed.tag.tagNumber).toBe(1);
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode Private tags", () => {
      // Given: Pre-encoded Private [0] tag
      const originalBuffer = SampleTlvData.private0;

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(originalBuffer);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should preserve Private tag
      expect(parsed.tag.tagClass).toBe(TagClass.Private);
      expect(parsed.tag.tagNumber).toBe(0);
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode large data with long-form length", () => {
      // Given: Large TLV structure with long-form length encoding
      const largeValue = TestData.createLargeBuffer(300);
      const originalBuffer = TestData.createTlvBuffer(0x04, largeValue);

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(originalBuffer);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should handle large data correctly
      expect(parsed.length).toBe(300);
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode high tag numbers", () => {
      // Given: TLV with high tag number (multi-byte encoding)
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

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(highTagBuffer);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should handle high tag numbers correctly
      expect(parsed.tag.tagNumber).toBe(100);
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(highTagBuffer));
    });

    test("should decode and encode constructed SEQUENCE", () => {
      // Given: Pre-encoded SEQUENCE with children
      const child1 = TestData.createTlvBuffer(
        0x04,
        TestData.createStringBuffer("first"),
      );
      const child2 = TestData.createTlvBuffer(
        0x04,
        TestData.createStringBuffer("second"),
      );
      const originalSequence = TestData.createConstructedTlvBuffer(0x30, [
        child1,
        child2,
      ]);

      // When: Decoding and re-encoding
      const parsed = BasicTLVParser.parse(originalSequence);
      const reEncoded = BasicTLVBuilder.build(parsed);

      // Then: Should preserve constructed structure
      expect(parsed.tag.constructed).toBe(true);
      expect(parsed.tag.tagNumber).toBe(16); // SEQUENCE
      expect(new Uint8Array(reEncoded)).toEqual(
        new Uint8Array(originalSequence),
      );
    });
  });

  describe("SchemaParser -> SchemaBuilder roundtrip", () => {
    test("should decode and encode simple primitive with string processing", () => {
      // Given: Pre-encoded data and corresponding schemas
      const originalBuffer = TestData.createTlvBuffer(
        0x0c,
        TestData.createStringBuffer("Hello Schema"),
      );

      const parsingSchema = ParserSchema.primitive(
        "message",
        (buffer) => new TextDecoder().decode(buffer),
        CommonTags.UTF8_STRING,
      );

      const encodingSchema = BuilderSchema.primitive(
        "message",
        (data) => TestData.createStringBuffer(data),
        CommonTags.UTF8_STRING,
      );

      const parser = new SchemaParser(parsingSchema);
      const builder = new SchemaBuilder(encodingSchema);

      // When: Decoding then re-encoding
      const decoded = parser.parse(originalBuffer);
      const reEncoded = builder.build(decoded);

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode primitive with number processing", () => {
      // Given: Pre-encoded INTEGER and schemas
      const originalBuffer = TestData.createTlvBuffer(
        0x02,
        TestData.createBuffer([0x30, 0x39]),
      ); // 12345

      const parsingSchema = ParserSchema.primitive(
        "value",
        (buffer) => {
          if (buffer.byteLength === 0) return 0;
          const view = new DataView(buffer);
          let result = 0;
          for (let i = 0; i < buffer.byteLength; i++) {
            result = (result << 8) | view.getUint8(i);
          }
          return result;
        },
        CommonTags.INTEGER,
      );

      const encodingSchema = BuilderSchema.primitive(
        "value",
        (num) => {
          if (num === 0) return TestData.createBuffer([0x00]);

          const bytes: number[] = [];
          let temp = num;
          while (temp > 0) {
            bytes.unshift(temp & 0xff);
            temp = temp >> 8;
          }
          return TestData.createBuffer(bytes);
        },
        CommonTags.INTEGER,
      );

      const parser = new SchemaParser(parsingSchema);
      const builder = new SchemaBuilder(encodingSchema);

      // When: Decoding then re-encoding
      const decoded = parser.parse(originalBuffer);
      const reEncoded = builder.build(decoded);

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });

    test("should decode and encode constructed SEQUENCE with multiple fields", () => {
      // Given: Pre-encoded SEQUENCE and schemas
      const nameData = TestData.createTlvBuffer(
        0x0c,
        TestData.createStringBuffer("Alice"),
      );
      const ageData = TestData.createTlvBuffer(
        0x02,
        TestData.createBuffer([25]),
      );
      const originalSequence = TestData.createConstructedTlvBuffer(0x30, [
        nameData,
        ageData,
      ]);

      const parsingSchema = ParserSchema.constructed(
        "person",
        [
          ParserSchema.primitive(
            "name",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.UTF8_STRING,
          ),
          ParserSchema.primitive(
            "age",
            (buffer) => new Uint8Array(buffer)[0],
            CommonTags.INTEGER,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const encodingSchema = BuilderSchema.constructed(
        "person",
        [
          BuilderSchema.primitive(
            "name",
            (data: string) => TestData.createStringBuffer(data),
            CommonTags.UTF8_STRING,
          ),
          BuilderSchema.primitive<string, number>(
            "age",
            (data) => TestData.createBuffer([data]),
            CommonTags.INTEGER,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const parser = new SchemaParser(parsingSchema);
      const builder = new SchemaBuilder(encodingSchema);

      // When: Decoding then re-encoding
      const decoded = parser.parse(originalSequence);
      const reEncoded = builder.build(decoded);

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(
        new Uint8Array(originalSequence),
      );
    });

    test("should decode and encode nested SEQUENCE structures", () => {
      // Given: Pre-encoded nested SEQUENCE
      const streetData = TestData.createTlvBuffer(
        0x0c,
        TestData.createStringBuffer("123 Main"),
      );
      const cityData = TestData.createTlvBuffer(
        0x0c,
        TestData.createStringBuffer("Anytown"),
      );
      const addressSequence = TestData.createConstructedTlvBuffer(0x30, [
        streetData,
        cityData,
      ]);

      const nameData = TestData.createTlvBuffer(
        0x0c,
        TestData.createStringBuffer("Bob"),
      );
      const originalNested = TestData.createConstructedTlvBuffer(0x30, [
        nameData,
        addressSequence,
      ]);

      const addressParsingSchema = ParserSchema.constructed(
        "address",
        [
          ParserSchema.primitive(
            "street",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.UTF8_STRING,
          ),
          ParserSchema.primitive(
            "city",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.UTF8_STRING,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const personParsingSchema = ParserSchema.constructed(
        "person",
        [
          ParserSchema.primitive(
            "name",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.UTF8_STRING,
          ),
          addressParsingSchema,
        ],
        CommonTags.SEQUENCE,
      );

      const addressEncodingSchema = BuilderSchema.constructed(
        "address",
        [
          BuilderSchema.primitive(
            "street",
            (data: string) => TestData.createStringBuffer(data),
            CommonTags.UTF8_STRING,
          ),
          BuilderSchema.primitive(
            "city",
            (data: string) => TestData.createStringBuffer(data),
            CommonTags.UTF8_STRING,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const personEncodingSchema = BuilderSchema.constructed(
        "person",
        [
          BuilderSchema.primitive(
            "name",
            (data: string) => TestData.createStringBuffer(data),
            CommonTags.UTF8_STRING,
          ),
          addressEncodingSchema,
        ],
        CommonTags.SEQUENCE,
      );

      const parser = new SchemaParser(personParsingSchema);
      const builder = new SchemaBuilder(personEncodingSchema);

      // When: Decoding then re-encoding
      const decoded = parser.parse(originalNested);
      const reEncoded = builder.build(decoded);

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalNested));
    });

    test("should decode and encode Context-Specific tags in schemas", () => {
      // Given: Pre-encoded data with Context-Specific tags
      const field1Data = TestData.createTlvBuffer(
        0x80,
        TestData.createStringBuffer("context zero"),
      );
      const field2Data = TestData.createTlvBuffer(
        0x81,
        TestData.createStringBuffer("context one"),
      );
      const originalSequence = TestData.createConstructedTlvBuffer(0x30, [
        field1Data,
        field2Data,
      ]);

      const parsingSchema = ParserSchema.constructed(
        "tagged",
        [
          ParserSchema.primitive(
            "field1",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.CONTEXT_SPECIFIC_0,
          ),
          ParserSchema.primitive(
            "field2",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.CONTEXT_SPECIFIC_1,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const encodingSchema = BuilderSchema.constructed(
        "tagged",
        [
          BuilderSchema.primitive(
            "field1",
            (data: string) => TestData.createStringBuffer(data),
            CommonTags.CONTEXT_SPECIFIC_0,
          ),
          BuilderSchema.primitive(
            "field2",
            (data: string) => TestData.createStringBuffer(data),
            CommonTags.CONTEXT_SPECIFIC_1,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const parser = new SchemaParser(parsingSchema);
      const builder = new SchemaBuilder(encodingSchema);

      // When: Decoding then re-encoding
      const decoded = parser.parse(originalSequence);
      const reEncoded = builder.build(decoded);

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(
        new Uint8Array(originalSequence),
      );
    });

    test("should decode and encode Application tags in schemas", () => {
      // Given: Pre-encoded data with Application tags
      const versionData = TestData.createTlvBuffer(
        0x41,
        TestData.createBuffer([2]),
      );
      const dataData = TestData.createTlvBuffer(
        0x42,
        TestData.createStringBuffer("app data"),
      );
      const originalApp = TestData.createTlvBuffer(
        0x60, // Application [0] constructed
        new Uint8Array([
          ...new Uint8Array(versionData),
          ...new Uint8Array(dataData),
        ]).buffer,
      );

      const parsingSchema = ParserSchema.constructed(
        "app",
        [
          ParserSchema.primitive(
            "version",
            (buffer) => new Uint8Array(buffer)[0],
            CommonTags.APPLICATION_1,
          ),
          ParserSchema.primitive(
            "data",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.APPLICATION_2,
          ),
        ],
        CommonTags.APPLICATION_0,
      );

      const encodingSchema = BuilderSchema.constructed(
        "app",
        [
          BuilderSchema.primitive(
            "version",
            (data: number) => TestData.createBuffer([data]),
            CommonTags.APPLICATION_1,
          ),
          BuilderSchema.primitive(
            "data",
            (data: string) => TestData.createStringBuffer(data),
            CommonTags.APPLICATION_2,
          ),
        ],
        CommonTags.APPLICATION_0,
      );

      const parser = new SchemaParser(parsingSchema);
      const builder = new SchemaBuilder(encodingSchema);

      // When: Decoding then re-encoding
      const decoded = parser.parse(originalApp);
      const reEncoded = builder.build(decoded);

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalApp));
    });

    test("should decode and encode Private tags in schemas", () => {
      // Given: Pre-encoded data with Private tags (using constructed for parent)
      const data1Bytes = TestData.createTlvBuffer(
        0xc0,
        TestData.createBuffer([0x01, 0x02, 0x03]),
      );
      const data2Bytes = TestData.createTlvBuffer(
        0xc1,
        TestData.createStringBuffer("private"),
      );
      const originalPrivate = TestData.createConstructedTlvBuffer(
        0xca, // Private [10] with constructed bit
        [data1Bytes, data2Bytes],
      );

      const parsingSchema = ParserSchema.constructed(
        "private",
        [
          ParserSchema.primitive(
            "data1",
            (buffer) => new Uint8Array(buffer),
            CommonTags.PRIVATE_0,
          ),
          ParserSchema.primitive(
            "data2",
            (buffer) => new TextDecoder().decode(buffer),
            { tagClass: TagClass.Private, tagNumber: 1 },
          ),
        ],
        { tagClass: TagClass.Private, tagNumber: 10 },
      );

      const encodingSchema = BuilderSchema.constructed(
        "private",
        [
          BuilderSchema.primitive(
            "data1",
            (data: Uint8Array) => data.buffer as ArrayBuffer,
            CommonTags.PRIVATE_0,
          ),
          BuilderSchema.primitive<string, string>(
            "data2",
            (data) => TestData.createStringBuffer(data),
            { tagClass: TagClass.Private, tagNumber: 1 },
          ),
        ],
        { tagClass: TagClass.Private, tagNumber: 10 },
      );

      const parser = new SchemaParser(parsingSchema);
      const builder = new SchemaBuilder(encodingSchema);

      // When: Decoding then re-encoding
      const decoded = parser.parse(originalPrivate);
      const reEncoded = builder.build(decoded);

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(
        new Uint8Array(originalPrivate),
      );
    });
  });

  describe("Async schema roundtrip", () => {
    test("should handle async decoding and encoding", async () => {
      // Given: Pre-encoded data and async schemas
      const originalBuffer = TestData.createTlvBuffer(
        0x0c,
        TestData.createStringBuffer("async test"),
      );

      const parsingSchema = ParserSchema.primitive(
        "asyncField",
        async (buffer) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return new TextDecoder().decode(buffer);
        },
        CommonTags.UTF8_STRING,
      );

      const encodingSchema = BuilderSchema.primitive(
        "asyncField",
        async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return TestData.createStringBuffer(data);
        },
        CommonTags.UTF8_STRING,
      );

      const parser = new SchemaParser(parsingSchema);
      const builder = new SchemaBuilder(encodingSchema);

      // When: Decoding then re-encoding asynchronously
      const decoded = await parser.parse(originalBuffer, { async: true });
      const reEncoded = await builder.build(decoded, { async: true });

      // Then: Should produce equivalent data
      expect(new Uint8Array(reEncoded)).toEqual(new Uint8Array(originalBuffer));
    });
  });

  describe("Error handling in roundtrip", () => {
    test("should handle malformed data appropriately", () => {
      // Given: Truly malformed TLV data (invalid length encoding)
      const malformedBuffer = TestData.createBuffer([0x04, 0x85]); // Says it has 5-byte length but no length bytes follow

      // When/Then: Parser should throw error before reaching builder
      expect(() => BasicTLVParser.parse(malformedBuffer)).toThrow();
    });

    test("should validate schema constraints during roundtrip", () => {
      // Given: Schema expecting specific tag but data has different tag
      const mismatchedBuffer = TestData.createTlvBuffer(
        0x04,
        TestData.createStringBuffer("test"),
      ); // OCTET_STRING
      const schema = ParserSchema.primitive(
        "field",
        Decoders.string,
        CommonTags.UTF8_STRING,
      ); // Expects UTF8_STRING

      const parser = new SchemaParser(schema);

      // When/Then: Should throw tag mismatch error
      expect(() => parser.parse(mismatchedBuffer)).toThrow(
        /tag number mismatch/i,
      );
    });
  });
});

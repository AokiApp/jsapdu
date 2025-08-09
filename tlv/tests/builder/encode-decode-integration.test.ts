import { describe, expect, test } from "vitest";
import {
  BasicTLVBuilder,
  SchemaBuilder,
  Schema as BuilderSchema,
  TagClass,
} from "../../src/builder";
import {
  BasicTLVParser,
  SchemaParser,
  Schema as ParserSchema,
} from "@aokiapp/tlv-parser";
import { TestData, Encoders, CommonTags } from "./test-helpers";

describe("TLV Builder -> Parser Integration - Encode then Decode", () => {
  describe("BasicTLVBuilder -> BasicTLVParser roundtrip", () => {
    test("should encode and decode primitive OCTET STRING", () => {
      // Given: TLV structure for OCTET STRING
      const originalValue = TestData.createStringBuffer("Hello World");
      const tlvStructure = {
        tag: { tagClass: TagClass.Universal, tagNumber: 4, constructed: false },
        length: originalValue.byteLength,
        value: originalValue,
        endOffset: 0,
      };

      // When: Encoding with BasicTLVBuilder
      const encoded = BasicTLVBuilder.build(tlvStructure);

      // And: Decoding with BasicTLVParser
      const decoded = BasicTLVParser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.tag.tagClass).toBe(TagClass.Universal);
      expect(decoded.tag.tagNumber).toBe(4);
      expect(decoded.tag.constructed).toBe(false);
      expect(decoded.length).toBe(originalValue.byteLength);
      expect(new TextDecoder().decode(decoded.value)).toBe("Hello World");
    });

    test("should encode and decode Context-Specific tags", () => {
      // Given: TLV structure for Context-Specific [1]
      const originalValue = TestData.createBuffer([0x01, 0x02, 0x03]);
      const tlvStructure = {
        tag: {
          tagClass: TagClass.ContextSpecific,
          tagNumber: 1,
          constructed: false,
        },
        length: originalValue.byteLength,
        value: originalValue,
        endOffset: 0,
      };

      // When: Encoding and decoding
      const encoded = BasicTLVBuilder.build(tlvStructure);
      const decoded = BasicTLVParser.parse(encoded);

      // Then: Should preserve tag information
      expect(decoded.tag.tagClass).toBe(TagClass.ContextSpecific);
      expect(decoded.tag.tagNumber).toBe(1);
      expect(decoded.tag.constructed).toBe(false);
      expect(Array.from(new Uint8Array(decoded.value))).toEqual([
        0x01, 0x02, 0x03,
      ]);
    });

    test("should encode and decode Application tags", () => {
      // Given: TLV structure for Application [5]
      const originalValue = TestData.createStringBuffer("application data");
      const tlvStructure = {
        tag: {
          tagClass: TagClass.Application,
          tagNumber: 5,
          constructed: false,
        },
        length: originalValue.byteLength,
        value: originalValue,
        endOffset: 0,
      };

      // When: Encoding and decoding
      const encoded = BasicTLVBuilder.build(tlvStructure);
      const decoded = BasicTLVParser.parse(encoded);

      // Then: Should preserve Application tag
      expect(decoded.tag.tagClass).toBe(TagClass.Application);
      expect(decoded.tag.tagNumber).toBe(5);
      expect(new TextDecoder().decode(decoded.value)).toBe("application data");
    });

    test("should encode and decode Private tags", () => {
      // Given: TLV structure for Private [10]
      const originalValue = TestData.createBuffer([0xff, 0xee, 0xdd, 0xcc]);
      const tlvStructure = {
        tag: { tagClass: TagClass.Private, tagNumber: 10, constructed: false },
        length: originalValue.byteLength,
        value: originalValue,
        endOffset: 0,
      };

      // When: Encoding and decoding
      const encoded = BasicTLVBuilder.build(tlvStructure);
      const decoded = BasicTLVParser.parse(encoded);

      // Then: Should preserve Private tag
      expect(decoded.tag.tagClass).toBe(TagClass.Private);
      expect(decoded.tag.tagNumber).toBe(10);
      expect(Array.from(new Uint8Array(decoded.value))).toEqual([
        0xff, 0xee, 0xdd, 0xcc,
      ]);
    });

    test("should handle large data with long-form length encoding", () => {
      // Given: Large TLV structure (> 127 bytes)
      const largeValue = TestData.createLargeBuffer(500);
      const tlvStructure = {
        tag: { tagClass: TagClass.Universal, tagNumber: 4, constructed: false },
        length: largeValue.byteLength,
        value: largeValue,
        endOffset: 0,
      };

      // When: Encoding and decoding
      const encoded = BasicTLVBuilder.build(tlvStructure);
      const decoded = BasicTLVParser.parse(encoded);

      // Then: Should handle large data correctly
      expect(decoded.tag.tagNumber).toBe(4);
      expect(decoded.length).toBe(500);
      expect(decoded.value.byteLength).toBe(500);
      expect(new Uint8Array(decoded.value)[0]).toBe(0xaa); // createLargeBuffer fills with 0xAA
    });

    test("should encode and decode high tag numbers (>30)", () => {
      // Given: TLV structure with high tag number
      const originalValue = TestData.createStringBuffer("high tag");
      const tlvStructure = {
        tag: {
          tagClass: TagClass.ContextSpecific,
          tagNumber: 100,
          constructed: false,
        },
        length: originalValue.byteLength,
        value: originalValue,
        endOffset: 0,
      };

      // When: Encoding and decoding
      const encoded = BasicTLVBuilder.build(tlvStructure);
      const decoded = BasicTLVParser.parse(encoded);

      // Then: Should handle high tag numbers correctly
      expect(decoded.tag.tagClass).toBe(TagClass.ContextSpecific);
      expect(decoded.tag.tagNumber).toBe(100);
      expect(new TextDecoder().decode(decoded.value)).toBe("high tag");
    });
  });

  describe("SchemaBuilder -> SchemaParser roundtrip", () => {
    test("should encode and decode simple primitive with string encoding/decoding", () => {
      // Given: Primitive schema for both encoding and decoding
      const encodingSchema = BuilderSchema.primitive(
        "message",
        Encoders.string,
        CommonTags.UTF8_STRING,
      );
      const decodingSchema = ParserSchema.primitive(
        "message",
        (buffer) => new TextDecoder().decode(buffer),
        CommonTags.UTF8_STRING,
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(decodingSchema);

      const originalData = "Hello Schema Integration!";

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded).toBe(originalData);
    });

    test("should encode and decode primitive with number encoding/decoding", () => {
      // Given: Schema for number encoding/decoding
      const encodingSchema = BuilderSchema.primitive(
        "value",
        Encoders.integer,
        CommonTags.INTEGER,
      );
      const decodingSchema = ParserSchema.primitive(
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

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(decodingSchema);

      const originalNumber = 12345;

      // When: Encoding then decoding
      const encoded = builder.build(originalNumber);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded).toBe(originalNumber);
    });

    test("should encode and decode constructed SEQUENCE", () => {
      // Given: SEQUENCE schema with multiple fields
      const encodingSchema = BuilderSchema.constructed(
        "person",
        [
          BuilderSchema.primitive(
            "name",
            Encoders.string,
            CommonTags.UTF8_STRING,
          ),
          BuilderSchema.primitive(
            "age",
            Encoders.singleByte,
            CommonTags.INTEGER,
          ),
          BuilderSchema.primitive(
            "active",
            Encoders.boolean,
            CommonTags.BOOLEAN,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const decodingSchema = ParserSchema.constructed(
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
          ParserSchema.primitive(
            "active",
            (buffer) => new Uint8Array(buffer)[0] !== 0x00,
            CommonTags.BOOLEAN,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(decodingSchema);

      const originalData = {
        name: "Alice",
        age: 30,
        active: true,
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.name).toBe("Alice");
      expect(decoded.age).toBe(30);
      expect(decoded.active).toBe(true);
    });

    test("should encode and decode nested SEQUENCE structures", () => {
      // Given: Nested SEQUENCE schema
      const addressEncodingSchema = BuilderSchema.constructed(
        "address",
        [
          BuilderSchema.primitive(
            "street",
            Encoders.string,
            CommonTags.UTF8_STRING,
          ),
          BuilderSchema.primitive(
            "city",
            Encoders.string,
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
            Encoders.string,
            CommonTags.UTF8_STRING,
          ),
          addressEncodingSchema,
        ],
        CommonTags.SEQUENCE,
      );

      const addressDecodingSchema = ParserSchema.constructed(
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

      const personDecodingSchema = ParserSchema.constructed(
        "person",
        [
          ParserSchema.primitive(
            "name",
            (buffer) => new TextDecoder().decode(buffer),
            CommonTags.UTF8_STRING,
          ),
          addressDecodingSchema,
        ],
        CommonTags.SEQUENCE,
      );

      const builder = new SchemaBuilder(personEncodingSchema);
      const parser = new SchemaParser(personDecodingSchema);

      const originalData = {
        name: "Bob",
        address: {
          street: "123 Main St",
          city: "Anytown",
        },
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.name).toBe("Bob");
      expect(decoded.address.street).toBe("123 Main St");
      expect(decoded.address.city).toBe("Anytown");
    });

    test("should handle Context-Specific tags in schema roundtrip", () => {
      // Given: Schema with Context-Specific tags
      const encodingSchema = BuilderSchema.constructed(
        "tagged",
        [
          BuilderSchema.primitive(
            "field1",
            Encoders.string,
            CommonTags.CONTEXT_SPECIFIC_0,
          ),
          BuilderSchema.primitive(
            "field2",
            Encoders.string,
            CommonTags.CONTEXT_SPECIFIC_1,
          ),
        ],
        CommonTags.SEQUENCE,
      );

      const decodingSchema = ParserSchema.constructed(
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

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(decodingSchema);

      const originalData = {
        field1: "context zero",
        field2: "context one",
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.field1).toBe("context zero");
      expect(decoded.field2).toBe("context one");
    });

    test("should handle Application tags in schema roundtrip", () => {
      // Given: Schema with Application tags
      const encodingSchema = BuilderSchema.constructed(
        "app",
        [
          BuilderSchema.primitive(
            "version",
            Encoders.singleByte,
            CommonTags.APPLICATION_1,
          ),
          BuilderSchema.primitive(
            "data",
            Encoders.string,
            CommonTags.APPLICATION_2,
          ),
        ],
        CommonTags.APPLICATION_0,
      );

      const decodingSchema = ParserSchema.constructed(
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

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(decodingSchema);

      const originalData = {
        version: 2,
        data: "application data",
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.version).toBe(2);
      expect(decoded.data).toBe("application data");
    });

    test("should handle Private tags in schema roundtrip", () => {
      // Given: Schema with Private tags
      const encodingSchema = BuilderSchema.constructed(
        "private",
        [
          BuilderSchema.primitive(
            "data1",
            (data: Uint8Array) => data.buffer as ArrayBuffer,
            CommonTags.PRIVATE_0,
          ),
          BuilderSchema.primitive(
            "data2",
            Encoders.string,
            CommonTags.PRIVATE_1,
          ),
        ],
        {
          tagClass: TagClass.Private,
          tagNumber: 10,
        },
      );

      const decodingSchema = ParserSchema.constructed(
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
            CommonTags.PRIVATE_1,
          ),
        ],
        {
          tagClass: TagClass.Private,
          tagNumber: 10,
        },
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(decodingSchema);

      const originalData = {
        data1: new Uint8Array([0x01, 0x02, 0x03]),
        data2: "private string",
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(Array.from(decoded.data1)).toEqual([0x01, 0x02, 0x03]);
      expect(decoded.data2).toBe("private string");
    });
  });

  describe("Async schema roundtrip", () => {
    test("should handle async encoding and decoding", async () => {
      // Given: Schema with async encoding and decoding
      const encodingSchema = BuilderSchema.primitive(
        "asyncField",
        Encoders.asyncString,
        CommonTags.UTF8_STRING,
      );

      const decodingSchema = ParserSchema.primitive(
        "asyncField",
        async (buffer) => {
          // Simulate async processing
          await new Promise((resolve) => setTimeout(resolve, 1));
          return new TextDecoder().decode(buffer);
        },
        CommonTags.UTF8_STRING,
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(decodingSchema);

      const originalData = "async test data";

      // When: Encoding then decoding asynchronously
      const encoded = await builder.build(originalData, { async: true });
      const decoded = await parser.parse(encoded, { async: true });

      // Then: Should roundtrip correctly
      expect(decoded).toBe(originalData);
    });
  });
});

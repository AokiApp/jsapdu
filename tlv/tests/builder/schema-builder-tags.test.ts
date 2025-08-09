import { describe, expect, test } from "vitest";

import { SchemaBuilder, Schema, TagClass } from "../../src/builder";
import { TestData, CommonTags, ExpectHelpers, Encoders } from "./test-helpers";

describe("SchemaBuilder - Tag-based behavior", () => {
  describe("Context-specific tags", () => {
    test("should build primitive with context-specific tag [0]", () => {
      // Given: A schema for an optional field with context-specific tag [0]
      const optionalFieldSchema = Schema.primitive(
        "optional",
        undefined,
        CommonTags.CONTEXT_SPECIFIC_0,
      );
      const builder = new SchemaBuilder(optionalFieldSchema);
      const testData = TestData.createBuffer([0xab, 0xcd]);

      // When: Building the TLV structure
      const result = builder.build(testData);

      // Then: Result should be ArrayBuffer with context-specific tag
      expect(result).toBeInstanceOf(ArrayBuffer);
      ExpectHelpers.expectTagInfo(result, CommonTags.CONTEXT_SPECIFIC_0);
      ExpectHelpers.expectValidDerEncoding(result);

      // Context-specific [0]: tag(1) + length(1) + value(2) = 4 bytes
      expect(result.byteLength).toBe(4);
    });

    test("should build with multiple context-specific tags", () => {
      // Given: A schema with context-specific tags [1] and [2]
      const schema1 = Schema.primitive(
        "field1",
        undefined,
        CommonTags.CONTEXT_SPECIFIC_1,
      );
      const schema2 = Schema.primitive(
        "field2",
        undefined,
        CommonTags.CONTEXT_SPECIFIC_2,
      );

      const builder1 = new SchemaBuilder(schema1);
      const builder2 = new SchemaBuilder(schema2);

      const testData1 = TestData.createStringBuffer("value1");
      const testData2 = TestData.createStringBuffer("value2");

      // When: Building both structures
      const result1 = builder1.build(testData1);
      const result2 = builder2.build(testData2);

      // Then: Both results should be ArrayBuffer with correct tags
      expect(result1).toBeInstanceOf(ArrayBuffer);
      expect(result2).toBeInstanceOf(ArrayBuffer);

      ExpectHelpers.expectTagInfo(result1, CommonTags.CONTEXT_SPECIFIC_1);
      ExpectHelpers.expectTagInfo(result2, CommonTags.CONTEXT_SPECIFIC_2);
      ExpectHelpers.expectStringValue(result1, "value1");
      ExpectHelpers.expectStringValue(result2, "value2");
    });
  });

  describe("Application-specific tags", () => {
    test("should build application-specific primitive", () => {
      // Given: A schema with application-specific tag [1]
      const appSchema = Schema.primitive<string, number>(
        "version",
        Encoders.singleByte,
        CommonTags.APPLICATION_1,
      );
      const builder = new SchemaBuilder(appSchema);

      // When: Building with version number
      const result = builder.build(42);

      // Then: Result should be ArrayBuffer with application tag [1]
      expect(result).toBeInstanceOf(ArrayBuffer);
      ExpectHelpers.expectTagInfo(result, CommonTags.APPLICATION_1);
      ExpectHelpers.expectValidDerEncoding(result);

      // Application [1]: tag(1) + length(1) + value(1) = 3 bytes
      expect(result.byteLength).toBe(3);
    });

    test("should build complex application-specific structure", () => {
      // Given: A complex application structure with nested fields
      const applicationSchema = Schema.constructed(
        "application",
        [
          Schema.primitive(
            "version",
            Encoders.singleByte,
            CommonTags.APPLICATION_1,
          ),
          Schema.primitive("data", undefined, CommonTags.APPLICATION_2),
        ],
        {
          tagClass: TagClass.Application,
          tagNumber: 0,
        },
      );

      const builder = new SchemaBuilder(applicationSchema);
      const testPayload = TestData.createBuffer([0x01, 0x02, 0x03, 0x04]);

      // When: Building the application structure
      const result = builder.build({
        version: 1,
        data: testPayload,
      });

      // Then: Result should be ArrayBuffer with constructed application tag [0]
      expect(result).toBeInstanceOf(ArrayBuffer);
      ExpectHelpers.expectValidDerEncoding(result);

      // Verify application tag [0] with constructed flag
      const bytes = new Uint8Array(result);
      expect((bytes[0] & 0xc0) >> 6).toBe(TagClass.Application); // Application class
      expect(bytes[0] & 0x1f).toBe(0); // Tag number 0
      expect(bytes[0] & 0x20).toBe(0x20); // Constructed flag
    });
  });

  describe("Universal tags", () => {
    test("should build UTF8 string with universal tag", () => {
      // Given: A UTF8 string schema with universal tag 12
      const stringSchema = Schema.primitive<string, string>(
        "message",
        Encoders.utf8String,
        CommonTags.UTF8_STRING,
      );
      const builder = new SchemaBuilder(stringSchema);

      // When: Building with string data
      const result = builder.build("Hello, TLV!");

      // Then: Result should be ArrayBuffer with universal UTF8String tag
      expect(result).toBeInstanceOf(ArrayBuffer);
      ExpectHelpers.expectTagInfo(result, CommonTags.UTF8_STRING);
      ExpectHelpers.expectStringValue(result, "Hello, TLV!");
      ExpectHelpers.expectValidDerEncoding(result);
    });

    test("should build integer with universal tag", () => {
      // Given: An integer schema with universal tag 2
      const integerSchema = Schema.primitive<string, number>(
        "number",
        Encoders.integer,
        CommonTags.INTEGER,
      );
      const builder = new SchemaBuilder(integerSchema);

      // When: Building with integer data
      const result = builder.build(42);

      // Then: Result should be ArrayBuffer with universal INTEGER tag
      expect(result).toBeInstanceOf(ArrayBuffer);
      ExpectHelpers.expectTagInfo(result, CommonTags.INTEGER);
      ExpectHelpers.expectValidDerEncoding(result);
    });
  });

  describe("Private tags", () => {
    test("should build with private tag", () => {
      // Given: A schema with private tag [0]
      const privateSchema = Schema.primitive(
        "private_data",
        undefined,
        CommonTags.PRIVATE_0,
      );
      const builder = new SchemaBuilder(privateSchema);
      const testData = TestData.createBuffer([0xff, 0xee, 0xdd]);

      // When: Building with private data
      const result = builder.build(testData);

      // Then: Result should be ArrayBuffer with private tag [0]
      expect(result).toBeInstanceOf(ArrayBuffer);
      ExpectHelpers.expectTagInfo(result, CommonTags.PRIVATE_0);
      ExpectHelpers.expectValidDerEncoding(result);

      // Private [0]: tag(1) + length(1) + value(3) = 5 bytes
      expect(result.byteLength).toBe(5);
    });
  });

  describe("Tag defaults", () => {
    test("should use default universal tag when none specified", () => {
      // Given: A schema without explicit tag specification
      const defaultSchema = Schema.primitive("default_field");
      const builder = new SchemaBuilder(defaultSchema);
      const testData = TestData.createBuffer([0x12, 0x34]);

      // When: Building the structure
      const result = builder.build(testData);

      // Then: Should be ArrayBuffer with default universal tag 0
      expect(result).toBeInstanceOf(ArrayBuffer);
      ExpectHelpers.expectValidDerEncoding(result);

      // Verify default universal tag 0
      const bytes = new Uint8Array(result);
      expect((bytes[0] & 0xc0) >> 6).toBe(TagClass.Universal); // Universal class
      expect(bytes[0] & 0x1f).toBe(0); // Tag number 0
      expect(bytes[0] & 0x20).toBe(0); // Not constructed
    });
  });
});

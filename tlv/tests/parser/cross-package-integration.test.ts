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
  schemaKenhojoBasicFour,
  schemaKenhojoSignature,
  schemaKenkakuEntries,
  schemaKenkakuMyNumber,
} from "@aokiapp/mynacard";
import { TestData, Decoders, SampleTlvData } from "./test-helpers";

/**
 * Cross-package integration tests from tlv-parser perspective
 * Verifying seamless interoperability with tlv-builder
 */
describe("Cross-Package Integration Tests - Parser-Centric View", () => {
  describe("Binary compatibility verification", () => {
    test("should parse any TLV built by BasicTLVBuilder", () => {
      // Given: Various TLV structures built by BasicTLVBuilder
      const testCases = [
        {
          tag: {
            tagClass: TagClass.Universal,
            tagNumber: 4,
            constructed: false,
          },
          value: TestData.createStringBuffer("test"),
        },
        {
          tag: {
            tagClass: TagClass.Application,
            tagNumber: 1,
            constructed: false,
          },
          value: TestData.createBuffer([0x01, 0x02, 0x03]),
        },
        {
          tag: {
            tagClass: TagClass.ContextSpecific,
            tagNumber: 0,
            constructed: false,
          },
          value: TestData.createStringBuffer("context"),
        },
        {
          tag: {
            tagClass: TagClass.Private,
            tagNumber: 10,
            constructed: false,
          },
          value: TestData.createBuffer([0xff, 0xee]),
        },
      ];

      testCases.forEach((testCase, index) => {
        const tlvStructure = {
          tag: testCase.tag,
          length: testCase.value.byteLength,
          value: testCase.value,
          endOffset: 0,
        };

        // When: Build with BasicTLVBuilder and parse with BasicTLVParser
        const built = BasicTLVBuilder.build(tlvStructure);
        const parsed = BasicTLVParser.parse(built);

        // Then: Should parse identical structure
        expect(parsed.tag.tagClass).toBe(testCase.tag.tagClass);
        expect(parsed.tag.tagNumber).toBe(testCase.tag.tagNumber);
        expect(parsed.tag.constructed).toBe(testCase.tag.constructed);
        expect(parsed.length).toBe(testCase.value.byteLength);
        expect(new Uint8Array(parsed.value)).toEqual(
          new Uint8Array(testCase.value),
        );
      });
    });

    test("should handle constructed structures built by BasicTLVBuilder", () => {
      // Given: A constructed structure built by BasicTLVBuilder
      const child1 = {
        tag: { tagClass: TagClass.Universal, tagNumber: 4, constructed: false },
        length: 4,
        value: TestData.createStringBuffer("test"),
        endOffset: 0,
      };
      const child2 = {
        tag: { tagClass: TagClass.Universal, tagNumber: 2, constructed: false },
        length: 1,
        value: TestData.createBuffer([42]),
        endOffset: 0,
      };

      const child1Built = BasicTLVBuilder.build(child1);
      const child2Built = BasicTLVBuilder.build(child2);

      const combinedValue = new Uint8Array(
        child1Built.byteLength + child2Built.byteLength,
      );
      combinedValue.set(new Uint8Array(child1Built), 0);
      combinedValue.set(new Uint8Array(child2Built), child1Built.byteLength);

      const constructedTlv = {
        tag: { tagClass: TagClass.Universal, tagNumber: 16, constructed: true },
        length: combinedValue.byteLength,
        value: combinedValue.buffer,
        endOffset: 0,
      };

      // When: Build and parse
      const built = BasicTLVBuilder.build(constructedTlv);
      const parsed = BasicTLVParser.parse(built);

      // Then: Should correctly identify constructed structure
      expect(parsed.tag.constructed).toBe(true);
      expect(parsed.tag.tagNumber).toBe(16); // SEQUENCE
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed.value.byteLength).toBe(combinedValue.byteLength);
    });
  });

  describe("Schema interoperability validation", () => {
    test("should parse data encoded by SchemaBuilder with compatible schemas", () => {
      // Given: Compatible encoding and parsing schemas
      const encodingSchema = BuilderSchema.constructed(
        "compatible",
        [
          BuilderSchema.primitive(
            "text",
            (data: string) => TestData.createStringBuffer(data),
            { tagNumber: 12 },
          ),
          BuilderSchema.primitive(
            "number",
            (data: number) => TestData.createBuffer([data]),
            { tagNumber: 2 },
          ),
          BuilderSchema.primitive(
            "flag",
            (data: boolean) => TestData.createBuffer([data ? 0xff : 0x00]),
            { tagNumber: 1 },
          ),
        ],
        { tagNumber: 16 },
      );

      const parsingSchema = ParserSchema.constructed(
        "compatible",
        [
          ParserSchema.primitive(
            "text",
            (buffer) => new TextDecoder().decode(buffer),
            { tagNumber: 12 },
          ),
          ParserSchema.primitive(
            "number",
            (buffer) => new Uint8Array(buffer)[0],
            { tagNumber: 2 },
          ),
          ParserSchema.primitive(
            "flag",
            (buffer) => new Uint8Array(buffer)[0] !== 0x00,
            { tagNumber: 1 },
          ),
        ],
        { tagNumber: 16 },
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      const testData = {
        text: "Cross-package test",
        number: 123,
        flag: true,
      };

      // When: Encode and decode across packages
      const encoded = builder.build(testData);
      const decoded = parser.parse(encoded);

      // Then: Should decode correctly
      expect(decoded.text).toBe("Cross-package test");
      expect(decoded.number).toBe(123);
      expect(decoded.flag).toBe(true);
    });

    test("should handle async operations across package boundaries", async () => {
      // Given: Schemas with async operations
      const encodingSchema = BuilderSchema.primitive(
        "asyncData",
        async (data: string) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return TestData.createStringBuffer(data);
        },
        { tagNumber: 12 },
      );

      const parsingSchema = ParserSchema.primitive(
        "asyncData",
        async (buffer) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return new TextDecoder().decode(buffer);
        },
        { tagNumber: 12 },
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      const testData = "Async cross-package test";

      // When: Async encode and decode
      const encoded = await builder.build(testData, { async: true });
      const decoded = await parser.parse(encoded, { async: true });

      // Then: Should handle async correctly
      expect(decoded).toBe(testData);
    });

    test("should validate tag constraints across packages", () => {
      // Given: Strict parsing schema with specific tag requirements
      const strictParsingSchema = ParserSchema.primitive(
        "strict",
        Decoders.string,
        {
          tagClass: TagClass.Private,
          tagNumber: 42,
        },
      );

      const correctEncodingSchema = BuilderSchema.primitive(
        "strict",
        (data: string) => TestData.createStringBuffer(data),
        {
          tagClass: TagClass.Private,
          tagNumber: 42,
        },
      );

      const wrongEncodingSchema = BuilderSchema.primitive(
        "wrong",
        (data: string) => TestData.createStringBuffer(data),
        {
          tagClass: TagClass.Universal,
          tagNumber: 12,
        },
      );

      const correctBuilder = new SchemaBuilder(correctEncodingSchema);
      const wrongBuilder = new SchemaBuilder(wrongEncodingSchema);
      const parser = new SchemaParser(strictParsingSchema);

      const testData = "validation test";

      // When: Encode with correct schema
      const correctlyEncoded = correctBuilder.build(testData);
      const correctResult = parser.parse(correctlyEncoded);

      // Then: Should parse successfully
      expect(correctResult).toBe(testData);

      // When: Encode with wrong schema
      const wronglyEncoded = wrongBuilder.build(testData);

      // Then: Should reject with tag validation error
      expect(() => parser.parse(wronglyEncoded)).toThrow(/tag.*mismatch/i);
    });
  });

  describe("Real-world MynaCard integration", () => {
    test("should parse MynaCard data structures built by external systems", () => {
      // Given: Mock MynaCard data that could be built by external systems
      const mockKenhojoData = {
        offsets: [10, 20, 30, 40, 50],
        name: "外部システム太郎",
        address: "神奈川県横浜市西区1-1-1",
        birth: "19801125",
        gender: "1",
      };

      // Build encoding schema that matches MynaCard expectations
      const encodingSchema = BuilderSchema.constructed("kenhojoBasicFour", [
        BuilderSchema.primitive(
          "offsets",
          (offsets: number[]) => {
            const buffer = new ArrayBuffer(offsets.length * 2);
            const view = new DataView(buffer);
            offsets.forEach((offset, i) =>
              view.setUint16(i * 2, offset, false),
            );
            return buffer;
          },
          {
            tagClass: TagClass.Private,
            tagNumber: 0x21,
          },
        ),
        BuilderSchema.primitive(
          "name",
          (name: string) => new TextEncoder().encode(name).buffer,
          {
            tagClass: TagClass.Private,
            tagNumber: 0x22,
          },
        ),
        BuilderSchema.primitive(
          "address",
          (address: string) => new TextEncoder().encode(address).buffer,
          {
            tagClass: TagClass.Private,
            tagNumber: 0x23,
          },
        ),
        BuilderSchema.primitive(
          "birth",
          (birth: string) => new TextEncoder().encode(birth).buffer,
          {
            tagClass: TagClass.Private,
            tagNumber: 0x24,
          },
        ),
        BuilderSchema.primitive(
          "gender",
          (gender: string) => new TextEncoder().encode(gender).buffer,
          {
            tagClass: TagClass.Private,
            tagNumber: 0x25,
          },
        ),
      ]);

      const builder = new SchemaBuilder(encodingSchema);

      // When: Build with external system and parse with production schema
      const encoded = builder.build(mockKenhojoData);
      const parser = new SchemaParser(schemaKenhojoBasicFour);
      const parsed = parser.parse(encoded);

      // Then: Should parse using production MynaCard schema
      expect(parsed.offsets).toEqual([10, 20, 30, 40, 50]);
      expect(parsed.name).toBe("外部システム太郎");
      expect(parsed.address).toBe("神奈川県横浜市西区1-1-1");
      expect(parsed.birth).toBe("19801125");
      expect(parsed.gender).toBe("1");
    });

    test("should handle complex MynaCard signature structures", () => {
      // Given: Mock signature data
      const signatureData = {
        kenhojoMyNumberHash: new Uint8Array([
          0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70, 0x81, 0x92, 0xa3, 0xb4,
          0xc5, 0xd6, 0xe7, 0xf8, 0x09, 0x10, 0x21, 0x32, 0x43, 0x54, 0x65,
          0x76, 0x87, 0x98, 0xa9, 0xba, 0xcb, 0xdc, 0xed, 0xfe, 0x0f,
        ]),
        kenhojoBasicFourHash: new Uint8Array([
          0xf0, 0xe1, 0xd2, 0xc3, 0xb4, 0xa5, 0x96, 0x87, 0x78, 0x69, 0x5a,
          0x4b, 0x3c, 0x2d, 0x1e, 0x0f, 0x01, 0x12, 0x23, 0x34, 0x45, 0x56,
          0x67, 0x78, 0x89, 0x9a, 0xab, 0xbc, 0xcd, 0xde, 0xef, 0xf0,
        ]),
        thisSignature: new Uint8Array([
          0x30, 0x45, 0x02, 0x20, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde,
          0xf0, 0x02, 0x21, 0x00, 0x87,
        ]),
      };

      // Build encoding schema for signature
      const encodingSchema = BuilderSchema.constructed(
        "kenhojoSignature",
        [
          BuilderSchema.primitive(
            "kenhojoMyNumberHash",
            (data: Uint8Array) => data.buffer,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x31,
            },
          ),
          BuilderSchema.primitive(
            "kenhojoBasicFourHash",
            (data: Uint8Array) => data.buffer,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x32,
            },
          ),
          BuilderSchema.primitive(
            "thisSignature",
            (data: Uint8Array) => data.buffer,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x33,
            },
          ),
        ],
        {
          tagClass: TagClass.Private,
          tagNumber: 0x30,
        },
      );

      const builder = new SchemaBuilder(encodingSchema);

      // When: Build and parse signature
      const encoded = builder.build(signatureData);
      const parser = new SchemaParser(schemaKenhojoSignature);
      const parsed = parser.parse(encoded);

      // Then: Should parse signature correctly
      expect(Array.from(parsed.kenhojoMyNumberHash)).toEqual(
        Array.from(signatureData.kenhojoMyNumberHash),
      );
      expect(Array.from(parsed.kenhojoBasicFourHash)).toEqual(
        Array.from(signatureData.kenhojoBasicFourHash),
      );
      expect(Array.from(parsed.thisSignature)).toEqual(
        Array.from(signatureData.thisSignature),
      );
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle large data structures built by SchemaBuilder", () => {
      // Given: Large data structure
      const largeDataSize = 1024;
      const largeContent = new Uint8Array(largeDataSize).fill(0xab);

      const encodingSchema = BuilderSchema.primitive(
        "largeData",
        (data: Uint8Array) => data.buffer,
        { tagNumber: 4 },
      );

      const parsingSchema = ParserSchema.primitive(
        "largeData",
        (buffer) => new Uint8Array(buffer),
        { tagNumber: 4 },
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      // When: Encode and parse large data
      const encoded = builder.build(largeContent);
      const parsed = parser.parse(encoded);

      // Then: Should handle large data correctly
      expect((parsed as Uint8Array).length).toBe(largeDataSize);
      expect((parsed as Uint8Array)[0]).toBe(0xab);
      expect((parsed as Uint8Array)[largeDataSize - 1]).toBe(0xab);
    });

    test("should provide meaningful error messages for schema mismatches", () => {
      // Given: Incompatible schemas
      const encodingSchema = BuilderSchema.primitive(
        "mismatch",
        (data: string) => TestData.createStringBuffer(data),
        {
          tagClass: TagClass.Application,
          tagNumber: 1,
        },
      );

      const parsingSchema = ParserSchema.primitive(
        "mismatch",
        Decoders.string,
        {
          tagClass: TagClass.Private,
          tagNumber: 2,
        },
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      // When: Build with one schema, parse with incompatible schema
      const encoded = builder.build("test");

      // Then: Should provide clear error message
      expect(() => parser.parse(encoded)).toThrow(/tag.*mismatch/i);
    });

    test("should handle empty and minimal TLV structures", () => {
      // Given: Minimal TLV structure
      const minimalSchema = BuilderSchema.primitive(
        "minimal",
        (): ArrayBuffer => new ArrayBuffer(0),
        { tagNumber: 5 },
      );

      const parsingSchema = ParserSchema.primitive(
        "minimal",
        (buffer) => buffer,
        { tagNumber: 5 },
      );

      const builder = new SchemaBuilder(minimalSchema);
      const parser = new SchemaParser(parsingSchema);

      // When: Build and parse minimal structure
      const encoded = builder.build(new ArrayBuffer(0));
      const parsed = parser.parse(encoded);

      // Then: Should handle empty data correctly
      expect(parsed).toBeInstanceOf(ArrayBuffer);
      expect(parsed.byteLength).toBe(0);
    });
  });

  describe("Performance and stress testing", () => {
    test("should handle rapid encode-decode cycles efficiently", () => {
      // Given: Simple schema for performance testing
      const testSchema = ParserSchema.primitive("perf", Decoders.string, {
        tagNumber: 12,
      });
      const buildSchema = BuilderSchema.primitive(
        "perf",
        (data: string) => TestData.createStringBuffer(data),
        { tagNumber: 12 },
      );

      const parser = new SchemaParser(testSchema);
      const builder = new SchemaBuilder(buildSchema);

      const testData = "Performance test data";

      // When: Perform multiple rapid cycles
      const startTime = performance.now();
      const cycles = 100;

      for (let i = 0; i < cycles; i++) {
        const encoded = builder.build(`${testData} ${i}`);
        const decoded = parser.parse(encoded);
        expect(decoded).toBe(`${testData} ${i}`);
      }

      const endTime = performance.now();

      // Then: Should complete efficiently
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    });

    test("should maintain memory efficiency in cross-package operations", () => {
      // Given: Memory-intensive operation
      const memoryTestSchema = ParserSchema.constructed(
        "memTest",
        [
          ParserSchema.primitive("data1", (buffer) => new Uint8Array(buffer), {
            tagNumber: 1,
          }),
          ParserSchema.primitive("data2", (buffer) => new Uint8Array(buffer), {
            tagNumber: 2,
          }),
          ParserSchema.primitive("data3", (buffer) => new Uint8Array(buffer), {
            tagNumber: 3,
          }),
        ],
        { tagNumber: 16 },
      );

      const buildSchema = BuilderSchema.constructed(
        "memTest",
        [
          BuilderSchema.primitive("data1", (data: Uint8Array) => data.buffer, {
            tagNumber: 1,
          }),
          BuilderSchema.primitive("data2", (data: Uint8Array) => data.buffer, {
            tagNumber: 2,
          }),
          BuilderSchema.primitive("data3", (data: Uint8Array) => data.buffer, {
            tagNumber: 3,
          }),
        ],
        { tagNumber: 16 },
      );

      const parser = new SchemaParser(memoryTestSchema);
      const builder = new SchemaBuilder(buildSchema);

      const memoryData = {
        data1: new Uint8Array(100).fill(0x11),
        data2: new Uint8Array(100).fill(0x22),
        data3: new Uint8Array(100).fill(0x33),
      };

      // When: Perform memory-intensive operations
      let totalEncoded = 0;
      let totalParsed = 0;

      for (let i = 0; i < 10; i++) {
        const encoded = builder.build(memoryData);
        totalEncoded += encoded.byteLength;

        const parsed = parser.parse(encoded);
        totalParsed +=
          parsed.data1.length + parsed.data2.length + parsed.data3.length;
      }

      // Then: Should handle memory operations without issues
      expect(totalEncoded).toBeGreaterThan(0);
      expect(totalParsed).toBe(3000); // 10 iterations × 300 bytes each
    });
  });
});

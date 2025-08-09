/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
// テストの異常系検証・柔軟性のためany型やunsafeアクセスを許容
import { describe, expect, test } from "vitest";

import { SchemaBuilder, Schema } from "../../src/builder";
import { TestData, CommonTags } from "./test-helpers";
import type { TagClass } from "../../src/builder/types";

describe("SchemaBuilder - Error handling behavior", () => {
  test("should validate schema consistency for invalid tag numbers", () => {
    // Given: Schema with invalid negative tag number
    const invalidSchema = Schema.primitive("invalid", undefined, {
      tagNumber: -1, // Invalid tag number
    });

    const builder = new SchemaBuilder(invalidSchema);
    const testData = TestData.createBuffer([0x01]);

    // When/Then: Should reject invalid schema during build
    expect(() => builder.build(testData)).toThrow(
      /tag number|invalid|negative/i,
    );
  });

  test("should handle missing required fields in constructed types", () => {
    // Given: SEQUENCE schema with two required fields
    const requiredFieldsSchema = Schema.constructed(
      "required",
      [
        Schema.primitive("field1", undefined, { tagNumber: 1 }),
        Schema.primitive("field2", undefined, { tagNumber: 2 }),
      ],
      CommonTags.SEQUENCE,
    );

    const builder = new SchemaBuilder(requiredFieldsSchema);

    // When/Then: Should throw error for missing required field
    expect(() =>
      builder.build({
        field1: TestData.createBuffer([0x01]),
        // field2 is missing - this should cause an error
      } as any),
    ).toThrow(/missing|required|field2/i);
  });

  test("should handle encoding function errors gracefully", () => {
    // Given: Schema with encoder that always throws
    const errorSchema = Schema.primitive<string, string>(
      "error",
      () => {
        throw new Error("Encoding failed");
      },
      CommonTags.UTF8_STRING,
    );

    const builder = new SchemaBuilder(errorSchema);

    // When/Then: Should propagate encoding errors appropriately
    expect(() => builder.build("test")).toThrow("Encoding failed");
  });

  test("should handle async encoding function errors gracefully", async () => {
    // Given: Schema with async encoder that always throws
    const asyncErrorSchema = Schema.primitive<string, string>(
      "asyncError",
      () => {
        throw new Error("Async encoding failed");
      },
      CommonTags.UTF8_STRING,
    );

    const builder = new SchemaBuilder(asyncErrorSchema);

    // When/Then: Should properly reject Promise for async encoding errors
    await expect(builder.build("test", { async: true })).rejects.toThrow(
      "Async encoding failed",
    );
  });

  test("should handle very large data values efficiently", () => {
    // Given: Schema for large OCTET_STRING data
    const largeDataSchema = Schema.primitive(
      "large",
      undefined,
      CommonTags.OCTET_STRING,
    );
    const builder = new SchemaBuilder(largeDataSchema);
    const largeData = TestData.createLargeBuffer(10000); // 10KB

    // When: Building large data structure
    const result = builder.build(largeData);

    // Then: Should handle large data without errors and produce valid DER
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(10000); // Should include T and L overhead

    // Verify it's valid DER with long-form length encoding
    const bytes = new Uint8Array(result);
    expect(bytes[0]).toBe(0x04); // OCTET_STRING tag
    expect(bytes[1] & 0x80).toBe(0x80); // Long form length indicator
  });

  test("should validate tag class values", () => {
    // Given: Invalid tag class (outside 0-3 range)
    const invalidTagClassSchema = Schema.primitive("invalid", undefined, {
      tagClass: 999 as TagClass, // Invalid tag class
      tagNumber: 1,
    });

    const builder = new SchemaBuilder(invalidTagClassSchema);
    const testData = TestData.createBuffer([0x01]);

    // When/Then: Should reject invalid tag class
    expect(() => builder.build(testData)).toThrow(/tag class|invalid/i);
  });
});

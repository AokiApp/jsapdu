import { describe, expect, test } from "vitest";

import { SchemaBuilder, Schema } from "../../src/builder";
import { Encoders, TestData, CommonTags } from "./test-helpers";

describe("SchemaBuilder - Synchronous and asynchronous building", () => {
  test("should build synchronously by default", () => {
    const schema = Schema.primitive("data", undefined, CommonTags.OCTET_STRING);
    const builder = new SchemaBuilder(schema);
    const testData = TestData.createBuffer([0x01, 0x02, 0x03]);

    const result = builder.build(testData);

    // Builder should return ArrayBuffer
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // OCTET_STRING: tag(1) + length(1) + value(3) = 5 bytes
    expect(result.byteLength).toBe(5);
  });

  test("should build asynchronously when requested", async () => {
    const schema = Schema.primitive<string, string>(
      "asyncField",
      Encoders.asyncString,
      CommonTags.UTF8_STRING,
    );
    const builder = new SchemaBuilder(schema);

    const result = await builder.build("test", { async: true });

    // Async build should also return ArrayBuffer
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // UTF8_STRING: tag(1) + length(1) + value(4) = 6 bytes
    expect(result.byteLength).toBe(6);
  });

  test("should handle mixed sync/async encoding in nested structures", async () => {
    const syncSchema = Schema.primitive<string, string>(
      "sync",
      Encoders.string,
      CommonTags.UTF8_STRING,
    );
    const asyncSchema = Schema.primitive<string, string>(
      "async",
      Encoders.asyncString,
      CommonTags.UTF8_STRING,
    );
    const mixedSchema = Schema.constructed(
      "mixed",
      [syncSchema, asyncSchema],
      CommonTags.SEQUENCE,
    );

    const builder = new SchemaBuilder(mixedSchema);
    const result = await builder.build(
      {
        sync: "sync_data",
        async: "async_data",
      },
      { async: true },
    );

    // Mixed sync/async should produce valid DER-encoded SEQUENCE
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // Verify it's a constructed SEQUENCE
    const bytes = new Uint8Array(result);
    expect(bytes[0]).toBe(0x30); // SEQUENCE tag
    expect(bytes[0] & 0x20).toBe(0x20); // constructed flag
  });
});

import { describe, expect, test } from "vitest";

import { SchemaBuilder, Schema } from "../../src/builder";
import { Encoders, TestData, CommonTags, ExpectHelpers } from "./test-helpers";

describe("SchemaBuilder - Primitive schemas", () => {
  test("should build simple primitive field with default encoding", () => {
    const schema = Schema.primitive("name", undefined, CommonTags.UTF8_STRING);
    const builder = new SchemaBuilder(schema);
    const testData = TestData.createHelloBuffer();

    const result = builder.build(testData);

    // Builder should return ArrayBuffer, not TLVResult
    expect(result).toBeInstanceOf(ArrayBuffer);

    // Verify DER-encoded structure
    ExpectHelpers.expectTagInfo(result, CommonTags.UTF8_STRING);
    ExpectHelpers.expectValidDerEncoding(result);

    // For UTF8_STRING: tag(1) + length(1) + value(5) = 7 bytes total
    expect(result.byteLength).toBe(7);
  });

  test("should build primitive field with custom string encoding", () => {
    const schema = Schema.primitive<string, string>(
      "username",
      Encoders.string,
      CommonTags.APPLICATION_1,
    );
    const builder = new SchemaBuilder(schema);

    const result = builder.build("admin");

    // Verify ArrayBuffer output with APPLICATION tag
    expect(result).toBeInstanceOf(ArrayBuffer);
    ExpectHelpers.expectTagInfo(result, CommonTags.APPLICATION_1);
    ExpectHelpers.expectStringValue(result, "admin");
    ExpectHelpers.expectValidDerEncoding(result);
  });

  test("should build primitive field with numeric encoding", () => {
    const schema = Schema.primitive<string, number>(
      "count",
      Encoders.number,
      CommonTags.INTEGER,
    );
    const builder = new SchemaBuilder(schema);

    const result = builder.build(12345);

    // Verify INTEGER encoding
    expect(result).toBeInstanceOf(ArrayBuffer);
    ExpectHelpers.expectTagInfo(result, CommonTags.INTEGER);
    ExpectHelpers.expectNumberValue(result, 12345);
    ExpectHelpers.expectValidDerEncoding(result);
  });

  test("should build primitive field with boolean encoding", () => {
    const schema = Schema.primitive<string, boolean>(
      "enabled",
      Encoders.boolean,
      CommonTags.CONTEXT_SPECIFIC_0,
    );
    const builder = new SchemaBuilder(schema);

    const trueResult = builder.build(true);
    const falseResult = builder.build(false);

    // Verify BOOLEAN encoding for both values
    expect(trueResult).toBeInstanceOf(ArrayBuffer);
    expect(falseResult).toBeInstanceOf(ArrayBuffer);

    ExpectHelpers.expectTagInfo(trueResult, CommonTags.CONTEXT_SPECIFIC_0);
    ExpectHelpers.expectTagInfo(falseResult, CommonTags.CONTEXT_SPECIFIC_0);

    // Check the actual DER-encoded boolean values in the ArrayBuffer
    const trueBytes = new Uint8Array(trueResult);
    const falseBytes = new Uint8Array(falseResult);

    // Skip T and L to get to V (assuming single byte length)
    expect(trueBytes[trueBytes.length - 1]).toBe(0xff); // true value
    expect(falseBytes[falseBytes.length - 1]).toBe(0x00); // false value
  });
});

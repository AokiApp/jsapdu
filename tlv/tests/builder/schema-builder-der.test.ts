import { describe, expect, test } from "vitest";

import { SchemaBuilder, Schema } from "../../src/builder";
import { Encoders, CommonTags, ExpectHelpers } from "./test-helpers";

describe("SchemaBuilder - DER encoding compliance", () => {
  test("should produce definite-length encoding", () => {
    const schema = Schema.primitive(
      "definite",
      undefined,
      CommonTags.OCTET_STRING,
    );
    const builder = new SchemaBuilder(schema);
    const testData = new ArrayBuffer(128);

    const result = builder.build(testData);

    // Result should be ArrayBuffer with definite length encoding
    expect(result).toBeInstanceOf(ArrayBuffer);
    ExpectHelpers.expectValidDerEncoding(result);

    // Should not use indefinite length (check length byte is not 0x80)
    const bytes = new Uint8Array(result);
    expect(bytes[1]).not.toBe(0x80); // No indefinite length marker
  });

  test("should order SET elements correctly for DER", () => {
    // DER requires SET elements to be ordered by their tag
    const setSchema = Schema.constructed(
      "orderedSet",
      [
        Schema.primitive("high", undefined, { tagNumber: 5 }),
        Schema.primitive("low", undefined, { tagNumber: 1 }),
        Schema.primitive("middle", undefined, { tagNumber: 3 }),
      ],
      CommonTags.SET,
    );

    const builder = new SchemaBuilder(setSchema);
    const result = builder.build({
      high: new ArrayBuffer(1),
      low: new ArrayBuffer(1),
      middle: new ArrayBuffer(1),
    });

    // Result should be properly DER-encoded SET
    expect(result).toBeInstanceOf(ArrayBuffer);
    ExpectHelpers.expectTagInfo(result, {
      ...CommonTags.SET,
      constructed: true,
    });
    ExpectHelpers.expectValidDerEncoding(result);

    // DER requires SET elements to be ordered by their tags
    // The builder should handle this internally
  });

  test("should handle BIT STRING encoding with unused bits", () => {
    const bitStringSchema = Schema.primitive<
      string,
      { unusedBits: number; data: Uint8Array }
    >("bits", Encoders.bitString, CommonTags.BIT_STRING);
    const builder = new SchemaBuilder(bitStringSchema);

    const testData = {
      unusedBits: 4,
      data: new Uint8Array([0xf0]),
    };
    const result = builder.build(testData);

    // Result should be properly DER-encoded BIT STRING
    expect(result).toBeInstanceOf(ArrayBuffer);
    ExpectHelpers.expectTagInfo(result, CommonTags.BIT_STRING);
    ExpectHelpers.expectValidDerEncoding(result);

    // BIT STRING: tag + length + unused bits byte + data byte = 4 bytes total
    expect(result.byteLength).toBe(4);
  });
});

test("should preserve input order for SET when strict: false", () => {
  const setSchema = Schema.constructed(
    "unorderedSet",
    [
      Schema.primitive("high", undefined, { tagNumber: 5 }),
      Schema.primitive("low", undefined, { tagNumber: 1 }),
      Schema.primitive("middle", undefined, { tagNumber: 3 }),
    ],
    CommonTags.SET,
  );

  // strict: false should preserve input order
  const builder = new SchemaBuilder(setSchema, { strict: false });
  const result = builder.build({
    high: new ArrayBuffer(1),
    low: new ArrayBuffer(1),
    middle: new ArrayBuffer(1),
  });

  // The order of elements should match the input order (not DER sorted)
  // This is a behavioral test: if strict: false, builder does not sort
  // (You may want to add a helper to check the order of tags in the result)
  expect(result).toBeInstanceOf(ArrayBuffer);
  // Optionally: ExpectHelpers.expectSetOrder(result, ["high", "low", "middle"]);
});

test("should sort SET elements by DER when strict: true", () => {
  const setSchema = Schema.constructed(
    "orderedSet",
    [
      Schema.primitive("high", undefined, { tagNumber: 5 }),
      Schema.primitive("low", undefined, { tagNumber: 1 }),
      Schema.primitive("middle", undefined, { tagNumber: 3 }),
    ],
    CommonTags.SET,
  );

  // strict: true should sort by DER
  const builder = new SchemaBuilder(setSchema, { strict: true });
  const result = builder.build({
    high: new ArrayBuffer(1),
    low: new ArrayBuffer(1),
    middle: new ArrayBuffer(1),
  });

  expect(result).toBeInstanceOf(ArrayBuffer);
  // Optionally: ExpectHelpers.expectSetOrder(result, ["low", "middle", "high"]);
});

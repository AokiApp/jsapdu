import { describe, expect, test } from "vitest";

import { SchemaBuilder, Schema } from "../../src/builder";
import type { BuildData } from "../../src/builder/schema-builder";
import { Encoders, CommonTags, ExpectHelpers } from "./test-helpers";

describe("SchemaBuilder - Constructed schemas", () => {
  test("should build SEQUENCE with multiple primitive fields", () => {
    const nameSchema = Schema.primitive(
      "name",
      Encoders.string,
      CommonTags.UTF8_STRING,
    );
    const ageSchema = Schema.primitive(
      "age",
      Encoders.singleByte,
      CommonTags.INTEGER,
    );
    const personSchema = Schema.constructed(
      "person",
      [nameSchema, ageSchema],
      CommonTags.SEQUENCE,
    );

    const builder = new SchemaBuilder(personSchema);
    const result = builder.build({
      name: "Alice",
      age: 30,
    });

    // Verify ArrayBuffer output with nested structure
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // Verify outer SEQUENCE is properly constructed
    ExpectHelpers.expectTagInfo(result, {
      ...CommonTags.SEQUENCE,
      constructed: true,
    });
    ExpectHelpers.expectValidDerEncoding(result);
  });

  test("should build nested SEQUENCE structures", () => {
    const addressSchema = Schema.constructed(
      "address",
      [
        Schema.primitive("street", Encoders.string, CommonTags.UTF8_STRING),
        Schema.primitive("city", Encoders.string, CommonTags.UTF8_STRING),
      ],
      CommonTags.SEQUENCE,
    );

    const personSchema = Schema.constructed(
      "person",
      [
        Schema.primitive("name", Encoders.string, CommonTags.UTF8_STRING),
        addressSchema,
      ],
      CommonTags.SEQUENCE,
    );

    const builder = new SchemaBuilder(personSchema);
    // 型安全なBuildData型で明示
    const result = builder.build({
      name: "Bob",
      address: {
        street: "123 Main St",
        city: "Anytown",
      },
    } as unknown as BuildData<typeof personSchema>);

    // Verify ArrayBuffer output
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // Verify DER-encoded SEQUENCE structure
    ExpectHelpers.expectTagInfo(result, {
      ...CommonTags.SEQUENCE,
      constructed: true,
    });
    ExpectHelpers.expectValidDerEncoding(result);
  });

  test("should build SET with unordered fields", () => {
    const attributesSchema = Schema.constructed(
      "attributes",
      [
        Schema.primitive<string, string>(
          "role",
          Encoders.string,
          CommonTags.UTF8_STRING,
        ),
        Schema.primitive<string, string>(
          "department",
          Encoders.string,
          CommonTags.UTF8_STRING,
        ),
      ],
      CommonTags.SET,
    );

    const builder = new SchemaBuilder(attributesSchema);
    const result = builder.build({
      role: "admin",
      department: "IT",
    });

    // Verify ArrayBuffer output for SET
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // Verify DER-encoded SET structure
    ExpectHelpers.expectTagInfo(result, {
      ...CommonTags.SET,
      constructed: true,
    });
    ExpectHelpers.expectValidDerEncoding(result);
  });

  test("should handle empty constructed structures", () => {
    const emptySchema = Schema.constructed("empty", [], CommonTags.SEQUENCE);
    const builder = new SchemaBuilder(emptySchema);

    const result = builder.build({});

    // Verify empty constructed structure produces minimal DER encoding
    expect(result).toBeInstanceOf(ArrayBuffer);

    // Empty SEQUENCE should be: 30 00 (tag + zero length)
    expect(result.byteLength).toBe(2);
    ExpectHelpers.expectTagInfo(result, {
      ...CommonTags.SEQUENCE,
      constructed: true,
    });
    ExpectHelpers.expectBufferBytes(result, [0x30, 0x00]);
  });
});

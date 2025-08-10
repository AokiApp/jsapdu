import { describe, expect, test } from "vitest";
import {
  SchemaParser,
  Schema as ParserSchema,
  TagClass,
} from "../../src/parser";
import { SchemaBuilder, Schema as BuilderSchema } from "@aokiapp/tlv-builder";
import { TestData, Decoders } from "./test-helpers";

/**
 * MynaCard decoders (replicated from mynacard package)
 */
const MynacardDecoders = {
  decodeText: (buffer: ArrayBuffer): string => {
    return new TextDecoder("utf-8").decode(buffer);
  },

  decodeOffsets: (buffer: ArrayBuffer): number[] => {
    const uint8 = new Uint8Array(buffer);
    const offsets = [];
    for (let i = 0; i < uint8.length; i += 2) {
      offsets.push((uint8[i] << 8) | uint8[i + 1]);
    }
    return offsets;
  },

  decodePublicKey: async (buffer: ArrayBuffer): Promise<CryptoKey> => {
    // Parse TLV structure to extract e and n components
    // This implementation properly parses the buffer created by encodePublicKey
    try {
      const bytes = new Uint8Array(buffer);
      let offset = 0;

      // Parse first TLV (e - public exponent)
      if (bytes[offset] !== 0x02) throw new Error("Expected INTEGER tag for e");
      offset++;
      const eLength = bytes[offset++];
      const eBytes = bytes.slice(offset, offset + eLength);
      offset += eLength;

      // Parse second TLV (n - modulus)
      if (bytes[offset] !== 0x02) throw new Error("Expected INTEGER tag for n");
      offset++;
      const nLength = bytes[offset++];
      const nBytes = bytes.slice(offset, offset + nLength);

      // Convert to base64url for JWK format
      const eBase64url = arrayBufferToBase64url(
        eBytes.buffer.slice(
          eBytes.byteOffset,
          eBytes.byteOffset + eBytes.byteLength,
        ),
      );
      const nBase64url = arrayBufferToBase64url(
        nBytes.buffer.slice(
          nBytes.byteOffset,
          nBytes.byteOffset + nBytes.byteLength,
        ),
      );

      // Create JWK object
      const jwk = {
        kty: "RSA",
        alg: "RS256",
        use: "sig",
        e: eBase64url,
        n: nBase64url,
      };

      // Import the public key
      return await crypto.subtle.importKey(
        "jwk",
        jwk,
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256",
        },
        true,
        ["verify"],
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to decode public key: ${errorMessage}`);
    }
  },

  decodeUint8Array: (buffer: ArrayBuffer): Uint8Array => {
    return new Uint8Array(buffer);
  },
};

/**
 * Mynacard-specific encoder functions for creating test data
 */
const MynacardEncoders = {
  encodeText: (text: string): ArrayBuffer => {
    return new TextEncoder().encode(text).buffer as ArrayBuffer;
  },

  encodeOffsets: (offsets: number[]): ArrayBuffer => {
    const buffer = new ArrayBuffer(offsets.length * 2);
    const uint8 = new Uint8Array(buffer);
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      uint8[i * 2] = (offset >> 8) & 0xff;
      uint8[i * 2 + 1] = offset & 0xff;
    }
    return buffer;
  },

  encodeUint8Array: (data: Uint8Array): ArrayBuffer => {
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
  },
};

/**
 * Helper function to convert ArrayBuffer to base64url
 */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(binary, "binary").toString("base64")
      : btoa(binary);

  // Convert base64 to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

describe("MynaCard Schema Integration Tests - Parser from Builder", () => {
  describe("KenhojoBasicFour schema parsing", () => {
    test("should parse kenhojo basic four information correctly", () => {
      // Given: Pre-encoded data using Builder and parsing schema
      const encodingSchema = BuilderSchema.constructed("kenhojoBasicFour", [
        BuilderSchema.primitive("offsets", MynacardEncoders.encodeOffsets, {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        }),
        BuilderSchema.primitive("name", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        BuilderSchema.primitive("address", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x23,
        }),
        BuilderSchema.primitive("birth", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x24,
        }),
        BuilderSchema.primitive("gender", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x25,
        }),
      ]);

      const parsingSchema = ParserSchema.constructed("kenhojoBasicFour", [
        ParserSchema.primitive("offsets", MynacardDecoders.decodeOffsets, {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        }),
        ParserSchema.primitive("name", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        ParserSchema.primitive("address", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x23,
        }),
        ParserSchema.primitive("birth", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x24,
        }),
        ParserSchema.primitive("gender", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x25,
        }),
      ]);

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      const testData = {
        offsets: [15, 25, 35, 45],
        name: "山田太郎",
        address: "大阪府大阪市中央区1-1-1",
        birth: "19880312",
        gender: "1",
      };

      // When: Building then parsing
      const encoded = builder.build(testData);
      const parsed = parser.parse(encoded);

      // Then: Should parse all fields correctly
      expect(parsed.offsets).toEqual([15, 25, 35, 45]);
      expect(parsed.name).toBe("山田太郎");
      expect(parsed.address).toBe("大阪府大阪市中央区1-1-1");
      expect(parsed.birth).toBe("19880312");
      expect(parsed.gender).toBe("1");
    });

    test("should handle empty and edge case values in basic four", () => {
      // Given: Edge case data
      const encodingSchema = BuilderSchema.constructed("kenhojoBasicFour", [
        BuilderSchema.primitive("offsets", MynacardEncoders.encodeOffsets, {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        }),
        BuilderSchema.primitive("name", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        BuilderSchema.primitive("address", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x23,
        }),
      ]);

      const parsingSchema = ParserSchema.constructed("kenhojoBasicFour", [
        ParserSchema.primitive("offsets", MynacardDecoders.decodeOffsets, {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        }),
        ParserSchema.primitive("name", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        ParserSchema.primitive("address", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x23,
        }),
      ]);

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      const edgeCaseData = {
        offsets: [0, 65535], // Min and max 16-bit values
        name: "", // Empty string
        address:
          "非常に長い住所データをテストするために、このように長い文字列を使用します。", // Long Japanese text
      };

      // When: Building then parsing
      const encoded = builder.build(edgeCaseData);
      const parsed = parser.parse(encoded);

      // Then: Should handle edge cases correctly
      expect(parsed.offsets).toEqual([0, 65535]);
      expect(parsed.name).toBe("");
      expect(parsed.address).toBe(
        "非常に長い住所データをテストするために、このように長い文字列を使用します。",
      );
    });
  });

  describe("KenhojoSignature schema parsing", () => {
    test("should parse signature data with binary hashes", () => {
      // Given: Signature schema and test data
      const encodingSchema = BuilderSchema.constructed(
        "kenhojoSignature",
        [
          BuilderSchema.primitive(
            "kenhojoMyNumberHash",
            MynacardEncoders.encodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x31,
            },
          ),
          BuilderSchema.primitive(
            "kenhojoBasicFourHash",
            MynacardEncoders.encodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x32,
            },
          ),
          BuilderSchema.primitive(
            "thisSignature",
            MynacardEncoders.encodeUint8Array,
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

      const parsingSchema = ParserSchema.constructed(
        "kenhojoSignature",
        [
          ParserSchema.primitive(
            "kenhojoMyNumberHash",
            MynacardDecoders.decodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x31,
            },
          ),
          ParserSchema.primitive(
            "kenhojoBasicFourHash",
            MynacardDecoders.decodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x32,
            },
          ),
          ParserSchema.primitive(
            "thisSignature",
            MynacardDecoders.decodeUint8Array,
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
      const parser = new SchemaParser(parsingSchema);

      // SHA-256 hash-like data (32 bytes)
      const testData = {
        kenhojoMyNumberHash: new Uint8Array([
          0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33,
          0x44, 0x55, 0x66, 0x77, 0x88, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
          0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
        ]),
        kenhojoBasicFourHash: new Uint8Array([
          0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00, 0xff,
          0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33,
          0x22, 0x11, 0xf0, 0xde, 0xbc, 0x9a, 0x78, 0x56, 0x34, 0x12,
        ]),
        thisSignature: new Uint8Array([
          0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
        ]),
      };

      // When: Building then parsing
      const encoded = builder.build(testData);
      const parsed = parser.parse(encoded);

      // Then: Should parse binary data correctly
      expect(Array.from(parsed.kenhojoMyNumberHash)).toEqual(
        Array.from(testData.kenhojoMyNumberHash),
      );
      expect(Array.from(parsed.kenhojoBasicFourHash)).toEqual(
        Array.from(testData.kenhojoBasicFourHash),
      );
      expect(Array.from(parsed.thisSignature)).toEqual(
        Array.from(testData.thisSignature),
      );
    });
  });

  describe("KenkakuEntries schema parsing", () => {
    test("should parse kenkaku entries with PNG and JP2 data", () => {
      // Given: KenkakuEntries schema with binary image data
      const encodingSchema = BuilderSchema.constructed("kenkakuEntries", [
        BuilderSchema.primitive("offsets", MynacardEncoders.encodeOffsets, {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        }),
        BuilderSchema.primitive("birth", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        BuilderSchema.primitive("gender", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x23,
        }),
        BuilderSchema.primitive("namePng", MynacardEncoders.encodeUint8Array, {
          tagClass: TagClass.Private,
          tagNumber: 0x25,
        }),
        BuilderSchema.primitive("faceJp2", MynacardEncoders.encodeUint8Array, {
          tagClass: TagClass.Private,
          tagNumber: 0x27,
        }),
        BuilderSchema.primitive("expire", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x29,
        }),
      ]);

      const parsingSchema = ParserSchema.constructed("kenkakuEntries", [
        ParserSchema.primitive("offsets", MynacardDecoders.decodeOffsets, {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        }),
        ParserSchema.primitive("birth", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        ParserSchema.primitive("gender", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x23,
        }),
        ParserSchema.primitive("namePng", MynacardDecoders.decodeUint8Array, {
          tagClass: TagClass.Private,
          tagNumber: 0x25,
        }),
        ParserSchema.primitive("faceJp2", MynacardDecoders.decodeUint8Array, {
          tagClass: TagClass.Private,
          tagNumber: 0x27,
        }),
        ParserSchema.primitive("expire", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x29,
        }),
      ]);

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      // Mock image data with recognizable headers
      const pngHeader = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk
      ]);

      const jp2Header = new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x0c,
        0x6a,
        0x50,
        0x20,
        0x20, // JP2 signature box
        0x0d,
        0x0a,
        0x87,
        0x0a,
        0x00,
        0x00,
        0x00,
        0x14, // File type box
      ]);

      const testData = {
        offsets: [50, 100, 150, 200, 250, 300],
        birth: "19921205",
        gender: "2",
        namePng: pngHeader,
        faceJp2: jp2Header,
        expire: "20401231",
      };

      // When: Building then parsing
      const encoded = builder.build(testData);
      const parsed = parser.parse(encoded);

      // Then: Should parse image data correctly
      expect(parsed.offsets).toEqual([50, 100, 150, 200, 250, 300]);
      expect(parsed.birth).toBe("19921205");
      expect(parsed.gender).toBe("2");
      expect(Array.from(parsed.namePng)).toEqual(Array.from(pngHeader));
      expect(Array.from(parsed.faceJp2)).toEqual(Array.from(jp2Header));
      expect(parsed.expire).toBe("20401231");

      // Verify PNG header is preserved
      const parsedPng = parsed.namePng;
      expect(parsedPng[0]).toBe(0x89); // PNG signature first byte
      expect(parsedPng[1]).toBe(0x50); // 'P'
      expect(parsedPng[2]).toBe(0x4e); // 'N'
      expect(parsedPng[3]).toBe(0x47); // 'G'

      // Verify JP2 header is preserved
      const parsedJp2 = parsed.faceJp2;
      expect(parsedJp2[4]).toBe(0x6a); // 'j'
      expect(parsedJp2[5]).toBe(0x50); // 'P'
    });
  });

  describe("KenkakuMyNumber schema parsing", () => {
    test("should parse my number PNG data with public key", () => {
      // Given: KenkakuMyNumber schema
      const encodingSchema = BuilderSchema.constructed(
        "kenkakuMyNumber",
        [
          BuilderSchema.primitive(
            "myNumberPng",
            MynacardEncoders.encodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x41,
            },
          ),
          BuilderSchema.primitive(
            "thisSignature",
            MynacardEncoders.encodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x43,
            },
          ),
        ],
        {
          tagClass: TagClass.Private,
          tagNumber: 0x40,
        },
      );

      const parsingSchema = ParserSchema.constructed(
        "kenkakuMyNumber",
        [
          ParserSchema.primitive(
            "myNumberPng",
            MynacardDecoders.decodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x41,
            },
          ),
          ParserSchema.primitive(
            "thisSignature",
            MynacardDecoders.decodeUint8Array,
            {
              tagClass: TagClass.Private,
              tagNumber: 0x43,
            },
          ),
        ],
        {
          tagClass: TagClass.Private,
          tagNumber: 0x40,
        },
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      // Mock my number PNG (would contain rendered digits)
      const myNumberPng = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x31,
        0x32,
        0x33,
        0x34,
        0x35,
        0x36,
        0x37,
        0x38, // Mock digits: 12345678
        0x39,
        0x30,
        0x31,
        0x32, // 9012
      ]);

      const testData = {
        myNumberPng: myNumberPng,
        thisSignature: new Uint8Array([
          0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe,
        ]),
      };

      // When: Building then parsing
      const encoded = builder.build(testData);
      const parsed = parser.parse(encoded);

      // Then: Should parse my number data correctly
      expect(Array.from(parsed.myNumberPng)).toEqual(Array.from(myNumberPng));
      expect(Array.from(parsed.thisSignature)).toEqual([
        0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe,
      ]);
    });
  });

  describe("Certificate schema parsing with async operations", () => {
    test("should parse certificate structure asynchronously", async () => {
      // Given: Certificate schema with async public key decoding
      const encodingSchema = BuilderSchema.constructed(
        "certificate",
        [
          BuilderSchema.primitive("contents", MynacardEncoders.encodeText, {
            tagClass: TagClass.Application,
            tagNumber: 0x4e,
          }),
          BuilderSchema.primitive(
            "thisSignature",
            MynacardEncoders.encodeUint8Array,
            {
              tagClass: TagClass.Application,
              tagNumber: 0x37,
            },
          ),
        ],
        {
          tagClass: TagClass.Application,
          tagNumber: 0x21,
        },
      );

      const parsingSchema = ParserSchema.constructed(
        "certificate",
        [
          ParserSchema.primitive(
            "contents",
            async (buffer) => {
              await new Promise((resolve) => setTimeout(resolve, 1));
              return MynacardDecoders.decodeText(buffer);
            },
            {
              tagClass: TagClass.Application,
              tagNumber: 0x4e,
            },
          ),
          ParserSchema.primitive(
            "thisSignature",
            MynacardDecoders.decodeUint8Array,
            {
              tagClass: TagClass.Application,
              tagNumber: 0x37,
            },
          ),
        ],
        {
          tagClass: TagClass.Application,
          tagNumber: 0x21,
        },
      );

      const builder = new SchemaBuilder(encodingSchema);
      const parser = new SchemaParser(parsingSchema);

      const testData = {
        contents: "Certificate Authority",
        thisSignature: new Uint8Array([
          0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22,
        ]),
      };

      // When: Building then parsing asynchronously
      const encoded = builder.build(testData);
      const parsed = await parser.parse(encoded, { async: true });

      // Then: Should parse certificate structure correctly with async
      expect(parsed.contents).toBe("Certificate Authority");
      expect(Array.from(parsed.thisSignature)).toEqual([
        0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22,
      ]);
    });
  });

  describe("Complex mynacard data scenarios", () => {
    test("should parse realistic mynacard data sequence", () => {
      // Given: Complex nested structure mimicking real mynacard data
      const complexSchema = ParserSchema.constructed(
        "mynacardData",
        [
          ParserSchema.constructed("basicInfo", [
            ParserSchema.primitive("name", MynacardDecoders.decodeText, {
              tagClass: TagClass.Private,
              tagNumber: 0x22,
            }),
            ParserSchema.primitive("address", MynacardDecoders.decodeText, {
              tagClass: TagClass.Private,
              tagNumber: 0x23,
            }),
          ]),
          ParserSchema.constructed("visualInfo", [
            ParserSchema.primitive(
              "namePng",
              MynacardDecoders.decodeUint8Array,
              {
                tagClass: TagClass.Private,
                tagNumber: 0x25,
              },
            ),
            ParserSchema.primitive(
              "faceJp2",
              MynacardDecoders.decodeUint8Array,
              {
                tagClass: TagClass.Private,
                tagNumber: 0x27,
              },
            ),
          ]),
          ParserSchema.constructed(
            "cryptoInfo",
            [
              ParserSchema.primitive(
                "hash",
                MynacardDecoders.decodeUint8Array,
                {
                  tagClass: TagClass.Private,
                  tagNumber: 0x31,
                },
              ),
              ParserSchema.primitive(
                "signature",
                MynacardDecoders.decodeUint8Array,
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
          ),
        ],
        {
          tagClass: TagClass.Application,
          tagNumber: 0x20,
        },
      );

      const complexEncodingSchema = BuilderSchema.constructed(
        "mynacardData",
        [
          BuilderSchema.constructed("basicInfo", [
            BuilderSchema.primitive("name", MynacardEncoders.encodeText, {
              tagClass: TagClass.Private,
              tagNumber: 0x22,
            }),
            BuilderSchema.primitive("address", MynacardEncoders.encodeText, {
              tagClass: TagClass.Private,
              tagNumber: 0x23,
            }),
          ]),
          BuilderSchema.constructed("visualInfo", [
            BuilderSchema.primitive(
              "namePng",
              MynacardEncoders.encodeUint8Array,
              {
                tagClass: TagClass.Private,
                tagNumber: 0x25,
              },
            ),
            BuilderSchema.primitive(
              "faceJp2",
              MynacardEncoders.encodeUint8Array,
              {
                tagClass: TagClass.Private,
                tagNumber: 0x27,
              },
            ),
          ]),
          BuilderSchema.constructed(
            "cryptoInfo",
            [
              BuilderSchema.primitive(
                "hash",
                MynacardEncoders.encodeUint8Array,
                {
                  tagClass: TagClass.Private,
                  tagNumber: 0x31,
                },
              ),
              BuilderSchema.primitive(
                "signature",
                MynacardEncoders.encodeUint8Array,
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
          ),
        ],
        {
          tagClass: TagClass.Application,
          tagNumber: 0x20,
        },
      );

      const builder = new SchemaBuilder(complexEncodingSchema);
      const parser = new SchemaParser(complexSchema);

      const realisticData = {
        basicInfo: {
          name: "佐藤花子",
          address: "東京都新宿区歌舞伎町1-2-3 マンション405号室",
        },
        visualInfo: {
          namePng: new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          ]),
          faceJp2: new Uint8Array([
            0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20,
          ]),
        },
        cryptoInfo: {
          hash: new Uint8Array([
            0x5d, 0x41, 0x40, 0x2a, 0xbc, 0x4b, 0x2a, 0x76, 0xb9, 0x71, 0x9d,
            0x91, 0x10, 0x17, 0xc5, 0x92, 0x10, 0x9c, 0xf0, 0xdc, 0x4d, 0x3b,
            0x7c, 0xba, 0xa1, 0x9c, 0x80, 0x59, 0x14, 0x8a, 0x8b, 0x9d,
          ]),
          signature: new Uint8Array([
            0x30, 0x45, 0x02, 0x20, 0x12, 0x34, 0x56, 0x78, 0x02, 0x21, 0x00,
            0x87, 0x65, 0x43, 0x21, 0x0f,
          ]),
        },
      };

      // When: Building then parsing
      const encoded = builder.build(realisticData);
      const parsed = parser.parse(encoded);

      // Then: Should parse the complex structure correctly
      expect(parsed.basicInfo.name).toBe("佐藤花子");
      expect(parsed.basicInfo.address).toBe(
        "東京都新宿区歌舞伎町1-2-3 マンション405号室",
      );
      expect(Array.from(parsed.visualInfo.namePng)).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(Array.from(parsed.visualInfo.faceJp2)).toEqual([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20,
      ]);
      expect(parsed.cryptoInfo.hash).toBeInstanceOf(Uint8Array);
      expect(parsed.cryptoInfo.signature).toBeInstanceOf(Uint8Array);
      expect(Array.from(parsed.cryptoInfo.hash)).toEqual(
        Array.from(realisticData.cryptoInfo.hash),
      );
      expect(Array.from(parsed.cryptoInfo.signature)).toEqual(
        Array.from(realisticData.cryptoInfo.signature),
      );
    });
  });

  describe("Error handling and edge cases", () => {
    test("should handle invalid TLV format in public key decoding", async () => {
      // Given: Invalid TLV buffer (missing INTEGER tag)
      const invalidBuffer = new Uint8Array([0x03, 0x04, 0x01, 0x02, 0x03, 0x04])
        .buffer; // BIT_STRING instead of INTEGER

      // When/Then: Should throw appropriate error
      await expect(
        MynacardDecoders.decodePublicKey(invalidBuffer),
      ).rejects.toThrow(/Expected INTEGER tag for e/i);
    });

    test("should handle insufficient buffer size in public key decoding", async () => {
      // Given: Buffer too small to contain valid TLV structure
      const smallBuffer = new Uint8Array([0x02]).buffer; // Only tag, no length

      // When/Then: Should throw appropriate error
      await expect(
        MynacardDecoders.decodePublicKey(smallBuffer),
      ).rejects.toThrow(/Failed to decode public key/i);
    });

    test("should handle empty buffer in offset decoding", () => {
      // Given: Empty buffer
      const emptyBuffer = new ArrayBuffer(0);

      // When: Decoding offsets from empty buffer
      const result = MynacardDecoders.decodeOffsets(emptyBuffer);

      // Then: Should return empty array
      expect(result).toEqual([]);
    });

    test("should handle odd-length buffer in offset decoding", () => {
      // Given: Buffer with odd number of bytes (offsets should be pairs)
      const oddBuffer = new Uint8Array([0x00, 0x10, 0x00]).buffer;

      // When: Decoding offsets
      const result = MynacardDecoders.decodeOffsets(oddBuffer);

      // Then: Current implementation processes all pairs, including incomplete ones
      // The last incomplete byte (0x00) becomes offset 0
      expect(result).toEqual([16, 0]); // 0x00,0x10 = 16 and 0x00 (incomplete) = 0
    });

    test("should handle schema validation errors", () => {
      // Given: Schema expecting specific tag but data has different tag
      const strictSchema = ParserSchema.primitive(
        "strict",
        MynacardDecoders.decodeText,
        {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        },
      );
      const parser = new SchemaParser(strictSchema);

      // Wrong tag (0x22 instead of expected 0x21)
      const wrongTagBuffer = TestData.createTlvBuffer(
        0xe2, // Private class, tag 0x22
        TestData.createStringBuffer("wrong tag"),
      );

      // When/Then: Should throw schema validation error
      expect(() => parser.parse(wrongTagBuffer)).toThrow(/tag.*mismatch/i);
    });

    test("should handle async decoding errors gracefully", async () => {
      // Given: Schema with async decoder that throws
      const errorSchema = ParserSchema.primitive(
        "errorField",
        async () => {
          throw new Error("Async decoding failed");
        },
        { tagClass: TagClass.Private, tagNumber: 0x10 },
      );
      const parser = new SchemaParser(errorSchema);
      const testBuffer = TestData.createTlvBuffer(
        0xd0, // Private class (0xC0), primitive, tag 0x10 = 0xD0
        TestData.createStringBuffer("test data"),
      );

      // When/Then: Should properly reject with async error
      await expect(parser.parse(testBuffer, { async: true })).rejects.toThrow(
        "Async decoding failed",
      );
    });

    test("should handle malformed Japanese text encoding", () => {
      // Given: Buffer with invalid UTF-8 sequence
      const invalidUtf8Buffer = new Uint8Array([0xff, 0xfe, 0xfd]).buffer;

      // When: Decoding as text (should handle replacement characters)
      const result = MynacardDecoders.decodeText(invalidUtf8Buffer);

      // Then: Should not throw but return replacement characters
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("should validate required fields in constructed schemas", () => {
      // Given: Schema with required fields but incomplete data
      const incompleteSchema = ParserSchema.constructed(
        "incomplete",
        [
          ParserSchema.primitive("field1", MynacardDecoders.decodeText, {
            tagClass: TagClass.Universal,
            tagNumber: 12, // UTF8_STRING
          }),
          ParserSchema.primitive("field2", MynacardDecoders.decodeText, {
            tagClass: TagClass.Universal,
            tagNumber: 2, // INTEGER (different tag number)
          }),
        ],
        {
          tagClass: TagClass.Universal,
          tagNumber: 16, // SEQUENCE
        },
      );

      // Create buffer with only first field (missing second field)
      const field1Buffer = TestData.createTlvBuffer(
        0x0c, // Universal UTF8_STRING
        TestData.createStringBuffer("field1 data"),
      );
      const incompleteBuffer = TestData.createConstructedTlvBuffer(0x30, [
        field1Buffer,
      ]); // SEQUENCE with only one field

      const parser = new SchemaParser(incompleteSchema);

      // When/Then: Should throw error when trying to parse missing field (bounds error is expected)
      expect(() => parser.parse(incompleteBuffer)).toThrow(
        /outside the bounds|missing|required|not found/i,
      );
    });
  });

  describe("Error handling with mynacard schemas", () => {
    test("should handle tag validation errors for mynacard-specific tags", () => {
      // Given: Schema expecting Private tag but data has different tag
      const schema = ParserSchema.primitive(
        "name",
        MynacardDecoders.decodeText,
        {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        },
      );
      const parser = new SchemaParser(schema);

      // Create TLV with wrong tag (Universal instead of Private)
      const wrongTagBuffer = TestData.createTlvBuffer(
        0x0c,
        MynacardEncoders.encodeText("test"),
      );

      // When/Then: Should throw tag class mismatch error
      expect(() => parser.parse(wrongTagBuffer)).toThrow(/tag class mismatch/i);
    });

    test("should handle malformed offset data", () => {
      // Given: Schema expecting valid offset data but malformed input
      const schema = ParserSchema.primitive(
        "offsets",
        MynacardDecoders.decodeOffsets,
        {
          tagClass: TagClass.Private,
          tagNumber: 0x21,
        },
      );
      const parser = new SchemaParser(schema);

      // Create TLV with odd number of bytes (offsets require pairs) with correct Private tag 0x21 (33)
      // Since tag 33 >= 31, use extended form: [0xDF, 0x21] for Private class, primitive, tag 33
      const valueBytes = TestData.createBuffer([0x00, 0x01, 0x02]);
      const malformedBytes = new Uint8Array(2 + 1 + valueBytes.byteLength); // tag(2) + length(1) + value
      malformedBytes[0] = 0xdf; // Private class, primitive, extended form
      malformedBytes[1] = 0x21; // Tag number 33
      malformedBytes[2] = valueBytes.byteLength; // Length
      malformedBytes.set(new Uint8Array(valueBytes), 3); // Value
      const malformedBuffer = malformedBytes.buffer;

      // When: Parsing (decoder should handle gracefully)
      const result = parser.parse(malformedBuffer);

      // Then: Should return all processed offsets (incomplete pairs get padded with 0)
      expect(result.length).toBe(2); // Two pairs: [0x00,0x01] and [0x02,undefined->0]
      expect(result[0]).toBe(1); // (0x00 << 8) | 0x01
      expect(result[1]).toBe(512); // (0x02 << 8) | 0x00
    });
  });
});

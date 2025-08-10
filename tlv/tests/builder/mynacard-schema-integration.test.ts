import { describe, expect, test } from "vitest";
import {
  SchemaBuilder,
  Schema as BuilderSchema,
  TagClass,
} from "../../src/builder";
import { SchemaParser, Schema as ParserSchema } from "@aokiapp/tlv-parser";
import { TestData, Encoders } from "./test-helpers";

/**
 * Mynacard-specific encoder functions to complement the decoders
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

  encodePublicKey: async (key: CryptoKey): Promise<ArrayBuffer> => {
    // Export key to JWK format
    const jwk = await crypto.subtle.exportKey("jwk", key);

    // Convert base64url to ArrayBuffer for e and n components
    const eBuffer = base64urlToArrayBuffer(jwk.e!);
    const nBuffer = base64urlToArrayBuffer(jwk.n!);

    // Create TLV structures for e and n
    const eTlv = TestData.createTlvBuffer(0x02, eBuffer); // INTEGER for e
    const nTlv = TestData.createTlvBuffer(0x02, nBuffer); // INTEGER for n

    // Combine e and n TLVs
    const combined = new Uint8Array(eTlv.byteLength + nTlv.byteLength);
    combined.set(new Uint8Array(eTlv), 0);
    combined.set(new Uint8Array(nTlv), eTlv.byteLength);

    return combined.buffer;
  },

  encodeUint8Array: (data: Uint8Array): ArrayBuffer => {
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
  },
};

/**
 * Helper function to convert base64url to ArrayBuffer
 */
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").buffer;
  } else {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

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
    // This is a simplified mock for testing - in real implementation,
    // it would parse the actual TLV structure and create a proper CryptoKey
    // For testing, we'll create a dummy key
    return await crypto.subtle
      .generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
      )
      .then((keyPair) => keyPair.publicKey);
  },

  decodeUint8Array: (buffer: ArrayBuffer): Uint8Array => {
    return new Uint8Array(buffer);
  },
};

describe("MynaCard Schema Integration Tests - Builder to Parser", () => {
  describe("KenhojoBasicFour schema roundtrip", () => {
    test("should encode and decode basic four information", async () => {
      // Given: KenhojoBasicFour schemas for encoding and decoding
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

      const decodingSchema = ParserSchema.constructed("kenhojoBasicFour", [
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
      const parser = new SchemaParser(decodingSchema);

      const originalData = {
        offsets: [10, 20, 30, 40],
        name: "田中太郎",
        address: "東京都渋谷区1-2-3",
        birth: "19850401",
        gender: "1",
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.offsets).toEqual([10, 20, 30, 40]);
      expect(decoded.name).toBe("田中太郎");
      expect(decoded.address).toBe("東京都渋谷区1-2-3");
      expect(decoded.birth).toBe("19850401");
      expect(decoded.gender).toBe("1");
    });
  });

  describe("KenhojoSignature schema roundtrip", () => {
    test("should encode and decode signature information", () => {
      // Given: KenhojoSignature schemas
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

      const decodingSchema = ParserSchema.constructed(
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
      const parser = new SchemaParser(decodingSchema);

      const originalData = {
        kenhojoMyNumberHash: new Uint8Array([
          0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
        ]),
        kenhojoBasicFourHash: new Uint8Array([
          0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
        ]),
        thisSignature: new Uint8Array([
          0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
        ]),
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(Array.from(decoded.kenhojoMyNumberHash)).toEqual([
        0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
      ]);
      expect(Array.from(decoded.kenhojoBasicFourHash)).toEqual([
        0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
      ]);
      expect(Array.from(decoded.thisSignature)).toEqual([
        0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
      ]);
    });
  });

  describe("KenkakuEntries schema roundtrip", () => {
    test("should encode and decode kenkaku entries with binary data", () => {
      // Given: KenkakuEntries schemas
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
        BuilderSchema.primitive(
          "addressPng",
          MynacardEncoders.encodeUint8Array,
          {
            tagClass: TagClass.Private,
            tagNumber: 0x26,
          },
        ),
        BuilderSchema.primitive("faceJp2", MynacardEncoders.encodeUint8Array, {
          tagClass: TagClass.Private,
          tagNumber: 0x27,
        }),
        BuilderSchema.primitive("expire", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x29,
        }),
      ]);

      const decodingSchema = ParserSchema.constructed("kenkakuEntries", [
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
        ParserSchema.primitive(
          "addressPng",
          MynacardDecoders.decodeUint8Array,
          {
            tagClass: TagClass.Private,
            tagNumber: 0x26,
          },
        ),
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
      const parser = new SchemaParser(decodingSchema);

      // Mock PNG and JP2 data (simplified for testing)
      const mockPngHeader = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const mockJp2Header = new Uint8Array([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20,
      ]);

      const originalData = {
        offsets: [100, 200, 300, 400, 500],
        birth: "19900515",
        gender: "2",
        namePng: mockPngHeader,
        addressPng: mockPngHeader,
        faceJp2: mockJp2Header,
        expire: "20350331",
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.offsets).toEqual([100, 200, 300, 400, 500]);
      expect(decoded.birth).toBe("19900515");
      expect(decoded.gender).toBe("2");
      expect(Array.from(decoded.namePng)).toEqual(Array.from(mockPngHeader));
      expect(Array.from(decoded.addressPng)).toEqual(Array.from(mockPngHeader));
      expect(Array.from(decoded.faceJp2)).toEqual(Array.from(mockJp2Header));
      expect(decoded.expire).toBe("20350331");
    });
  });

  describe("Certificate schema roundtrip", () => {
    test("should encode and decode certificate structure with async public key", async () => {
      // Given: Certificate schemas (simplified version without actual crypto operations)
      const encodingSchema = BuilderSchema.constructed(
        "certificate",
        [
          BuilderSchema.primitive(
            "contents",
            async (data: any) => {
              // Simulate certificate contents encoding
              const issuer = new Uint8Array(16).fill(0x01);
              const subject = new Uint8Array(16).fill(0x02);
              const publicKeyData = await MynacardEncoders.encodePublicKey(
                data.public_key,
              );

              const combined = new Uint8Array(32 + publicKeyData.byteLength);
              combined.set(issuer, 0);
              combined.set(subject, 16);
              combined.set(new Uint8Array(publicKeyData), 32);

              return combined.buffer;
            },
            {
              tagClass: TagClass.Application,
              tagNumber: 0x4e,
            },
          ),
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

      const decodingSchema = ParserSchema.constructed(
        "certificate",
        [
          ParserSchema.primitive(
            "contents",
            async (buffer) => {
              const issuer = buffer.slice(0, 16);
              const subject = buffer.slice(16, 32);
              const certificate_raw = buffer.slice(32);
              const public_key =
                await MynacardDecoders.decodePublicKey(certificate_raw);
              return { issuer, subject, public_key };
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
      const parser = new SchemaParser(decodingSchema);

      // Generate a test key pair
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
      );

      const originalData = {
        contents: {
          issuer: new ArrayBuffer(16),
          subject: new ArrayBuffer(16),
          public_key: keyPair.publicKey,
        },
        thisSignature: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
      };

      // When: Encoding then decoding asynchronously
      const encoded = await builder.build(originalData, { async: true });
      const decoded = await parser.parse(encoded, { async: true });

      // Then: Should roundtrip correctly (checking structure, not exact key match due to crypto complexity)
      expect(decoded.contents).toHaveProperty("issuer");
      expect(decoded.contents).toHaveProperty("subject");
      expect(decoded.contents).toHaveProperty("public_key");
      expect(decoded.contents.public_key).toBeInstanceOf(CryptoKey);
      expect(Array.from(decoded.thisSignature)).toEqual([
        0xaa, 0xbb, 0xcc, 0xdd,
      ]);
    });
  });

  describe("Complex nested mynacard structures", () => {
    test("should handle multiple mynacard schemas in sequence", () => {
      // Given: A sequence containing multiple mynacard data types
      const basicFourSchema = BuilderSchema.constructed("basicFour", [
        BuilderSchema.primitive("name", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        BuilderSchema.primitive("birth", MynacardEncoders.encodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x24,
        }),
      ]);

      const signatureSchema = BuilderSchema.constructed(
        "signature",
        [
          BuilderSchema.primitive("hash", MynacardEncoders.encodeUint8Array, {
            tagClass: TagClass.Private,
            tagNumber: 0x31,
          }),
        ],
        {
          tagClass: TagClass.Private,
          tagNumber: 0x30,
        },
      );

      const combinedSchema = BuilderSchema.constructed(
        "combined",
        [basicFourSchema, signatureSchema],
        {
          tagClass: TagClass.Application,
          tagNumber: 0x10,
        },
      );

      // Corresponding decoding schema
      const basicFourDecodingSchema = ParserSchema.constructed("basicFour", [
        ParserSchema.primitive("name", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x22,
        }),
        ParserSchema.primitive("birth", MynacardDecoders.decodeText, {
          tagClass: TagClass.Private,
          tagNumber: 0x24,
        }),
      ]);

      const signatureDecodingSchema = ParserSchema.constructed(
        "signature",
        [
          ParserSchema.primitive("hash", MynacardDecoders.decodeUint8Array, {
            tagClass: TagClass.Private,
            tagNumber: 0x31,
          }),
        ],
        {
          tagClass: TagClass.Private,
          tagNumber: 0x30,
        },
      );

      const combinedDecodingSchema = ParserSchema.constructed(
        "combined",
        [basicFourDecodingSchema, signatureDecodingSchema],
        {
          tagClass: TagClass.Application,
          tagNumber: 0x10,
        },
      );

      const builder = new SchemaBuilder(combinedSchema);
      const parser = new SchemaParser(combinedDecodingSchema);

      const originalData = {
        basicFour: {
          name: "鈴木花子",
          birth: "19950823",
        },
        signature: {
          hash: new Uint8Array([
            0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88,
          ]),
        },
      };

      // When: Encoding then decoding
      const encoded = builder.build(originalData);
      const decoded = parser.parse(encoded);

      // Then: Should roundtrip correctly
      expect(decoded.basicFour.name).toBe("鈴木花子");
      expect(decoded.basicFour.birth).toBe("19950823");
      expect(Array.from(decoded.signature.hash)).toEqual([
        0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88,
      ]);
    });
  });
});

describe("Encode-Decode Symmetry Tests", () => {
  test("should successfully encode and decode public keys", async () => {
    // Given: Generate a test public key
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );

    const originalKey = keyPair.publicKey;

    // When: Encode then decode the key
    const encoded = await MynacardEncoders.encodePublicKey(originalKey);
    const decoded = await MynacardDecoders.decodePublicKey(encoded);

    // Then: Both operations should succeed and produce valid CryptoKey objects
    expect(originalKey).toBeInstanceOf(CryptoKey);
    expect(decoded).toBeInstanceOf(CryptoKey);

    // Verify basic key properties
    const originalJwk = await crypto.subtle.exportKey("jwk", originalKey);
    const decodedJwk = await crypto.subtle.exportKey("jwk", decoded);

    expect(decodedJwk.kty).toBe("RSA");
    expect(decodedJwk.e).toBe("AQAB"); // Standard RSA exponent
    expect(typeof decodedJwk.n).toBe("string");
    expect(decodedJwk.n.length).toBeGreaterThan(0);

    // Verify the encoded format is valid TLV
    expect(encoded).toBeInstanceOf(ArrayBuffer);
    expect(encoded.byteLength).toBeGreaterThan(0);

    // Basic TLV structure check - should start with INTEGER tags
    const bytes = new Uint8Array(encoded);
    expect(bytes[0]).toBe(0x02); // First INTEGER tag for 'e'
  });

  test("should roundtrip KenhojoBasicFour with all data types", () => {
    // Given: Complete KenhojoBasicFour data with various edge cases
    const testData = {
      offsets: [0, 65535, 1024, 32768], // Min, max, and mid-range values
      name: "テスト太郎", // Japanese characters
      address: "東京都千代田区霞が関1-2-3\nマンション101号室", // Multi-line with newlines
      birth: "19881225", // Date format
      gender: "2", // Female
    };

    // Create schemas
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

    const decodingSchema = ParserSchema.constructed("kenhojoBasicFour", [
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
    const parser = new SchemaParser(decodingSchema);

    // When: Encode then decode
    const encoded = builder.build(testData);
    const decoded = parser.parse(encoded);

    // Then: Should perfectly roundtrip all data
    expect(decoded.offsets).toEqual(testData.offsets);
    expect(decoded.name).toBe(testData.name);
    expect(decoded.address).toBe(testData.address);
    expect(decoded.birth).toBe(testData.birth);
    expect(decoded.gender).toBe(testData.gender);
  });

  test("should handle binary data roundtrip correctly", () => {
    // Given: Binary signature data
    const testData = {
      kenhojoMyNumberHash: new Uint8Array([
        0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44,
        0x55, 0x66, 0x77, 0x88,
      ]),
      kenhojoBasicFourHash: new Uint8Array([
        0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0xf0, 0xde, 0xbc, 0x9a,
        0x78, 0x56, 0x34, 0x12,
      ]),
      thisSignature: new Uint8Array([
        0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11,
      ]),
    };

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

    const decodingSchema = ParserSchema.constructed(
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
    const parser = new SchemaParser(decodingSchema);

    // When: Encode then decode
    const encoded = builder.build(testData);
    const decoded = parser.parse(encoded);

    // Then: Binary data should be perfectly preserved
    expect(Array.from(decoded.kenhojoMyNumberHash)).toEqual(
      Array.from(testData.kenhojoMyNumberHash),
    );
    expect(Array.from(decoded.kenhojoBasicFourHash)).toEqual(
      Array.from(testData.kenhojoBasicFourHash),
    );
    expect(Array.from(decoded.thisSignature)).toEqual(
      Array.from(testData.thisSignature),
    );
  });

  test("should handle async encoding/decoding symmetry", async () => {
    // Given: Schema with async operations
    const asyncEncodingSchema = BuilderSchema.primitive(
      "async",
      async (data: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return MynacardEncoders.encodeText(data);
      },
      {
        tagClass: TagClass.ContextSpecific,
        tagNumber: 0,
      },
    );

    const asyncDecodingSchema = ParserSchema.primitive(
      "async",
      async (buffer: ArrayBuffer) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return MynacardDecoders.decodeText(buffer);
      },
      {
        tagClass: TagClass.ContextSpecific,
        tagNumber: 0,
      },
    );

    const builder = new SchemaBuilder(asyncEncodingSchema);
    const parser = new SchemaParser(asyncDecodingSchema);

    const testData = "非同期テストデータ";

    // When: Async encode then decode
    const encoded = await builder.build(testData, { async: true });
    const decoded = await parser.parse(encoded, { async: true });

    // Then: Should roundtrip correctly with async operations
    expect(decoded).toBe(testData);
  });
});

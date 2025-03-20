import { BasicTLVParser, Schema } from "@aokiapp/tlv-parser";
import { TLVRootSchema } from "@aokiapp/tlv-parser/tlv";
import { TagClass } from "@aokiapp/tlv-parser/types";

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64url");
  } else {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}

function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buffer);
}

export const schemaCertificate = {
  name: "certificate",
  tagClass: TagClass.Application,
  constructed: true,
  tagNumber: 0x21,
  fields: [
    {
      name: "contents",
      tagClass: TagClass.Application,
      tagNumber: 0x4e,
      async encode(buffer) {
        const uint8 = new Uint8Array(buffer);
        const issuer = uint8.subarray(0, 16);
        const subject = uint8.subarray(16, 32);
        const certificate_raw = uint8.subarray(32);
        const eParsed = BasicTLVParser.parse(certificate_raw.buffer);
        const subBuffer = uint8.subarray(32 + eParsed.endOffset);
        const nParsed = BasicTLVParser.parse(subBuffer.buffer);
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(eParsed.value),
            n: arrayBufferToBase64url(nParsed.value),
            key_ops: ["verify"],
            ext: true,
          },
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"],
        );
        return {
          issuer,
          subject,
          public_key,
        };
      },
    },
    {
      name: "thisSignature",
      tagClass: TagClass.Application,
      tagNumber: 0x37,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenhojoMyNumber = {
  name: "kenhojoMyNumber",
  tagClass: TagClass.Private,
  constructed: true,
  tagNumber: 0x10,
  encode(buffer) {
    return new TextDecoder("utf-8").decode(buffer);
  },
} as const satisfies TLVRootSchema<string>;

export const schemaKenhojoBasicFour = Schema.constructed("kenhojoBasicFour", [
  Schema.primitive(
    "offsets",
    (buffer) => {
      const uint8 = new Uint8Array(buffer);
      const offsets = [];
      for (let i = 0; i < uint8.length; i += 2) {
        offsets.push((uint8[i] << 8) | uint8[i + 1]);
      }
      return offsets;
    },
    {
      tagClass: TagClass.Private,
      tagNumber: 0x21,
    },
  ),
  Schema.primitive("name", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x22,
  }),
  Schema.primitive("address", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x23,
  }),
  Schema.primitive("birth", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x24,
  }),
  Schema.primitive("gender", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x25,
  }),
]);

export const schemaKenhojoSignature = Schema.constructed(
  "kenhojoSignature",
  [
    Schema.primitive(
      "kenhojoMyNumberSignature",
      (buffer) => new Uint8Array(buffer),
      { tagClass: TagClass.Private, tagNumber: 0x31 },
    ),
    Schema.primitive(
      "kenhojoAttributesSignature",
      (buffer) => new Uint8Array(buffer),
      { tagClass: TagClass.Private, tagNumber: 0x32 },
    ),
    Schema.primitive("thisSignature", (buffer) => new Uint8Array(buffer), {
      tagClass: TagClass.Private,
      tagNumber: 0x33,
    }),
  ],
  {
    tagClass: TagClass.Private,
    tagNumber: 0x30,
  },
);

export const schemaKenkakuBirth = {
  name: "kenkakuBirth",
  tagClass: TagClass.Private,
  constructed: true,
  tagNumber: 0x10,
  fields: [
    {
      name: "birth",
      tagClass: TagClass.Private,
      tagNumber: 0x11,
      constructed: false,
    },
    {
      name: "publicKey",
      tagClass: TagClass.Private,
      tagNumber: 0x32,
      constructed: false,
      async encode(buffer) {
        const uint8 = new Uint8Array(buffer);
        const eParsed = BasicTLVParser.parse(uint8.buffer);
        const subBuffer = uint8.subarray(eParsed.endOffset);
        const nParsed = BasicTLVParser.parse(subBuffer.buffer);
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(eParsed.value),
            n: arrayBufferToBase64url(nParsed.value),
            key_ops: ["verify"],
            ext: true,
          },
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"],
        );
        return public_key;
      },
    },
    {
      name: "thisSignature",
      tagClass: TagClass.Private,
      tagNumber: 0x33,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenkakuEntries = {
  name: "kenkakuBirth",
  tagClass: TagClass.Private,
  constructed: true,
  tagNumber: 0x20,
  fields: [
    {
      name: "offsets",
      tagClass: TagClass.Private,
      tagNumber: 0x21,
      constructed: false,
    },
    {
      name: "birth",
      tagClass: TagClass.Private,
      tagNumber: 0x22,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "gender",
      tagClass: TagClass.Private,
      tagNumber: 0x23,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "publicKey",
      tagClass: TagClass.Private,
      tagNumber: 0x24,
      constructed: false,
      async encode(buffer) {
        const uint8 = new Uint8Array(buffer);
        const eParsed = BasicTLVParser.parse(uint8.buffer);
        const subBuffer = uint8.subarray(eParsed.endOffset);
        const nParsed = BasicTLVParser.parse(subBuffer.buffer);
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(eParsed.value),
            n: arrayBufferToBase64url(nParsed.value),
            key_ops: ["verify"],
            ext: true,
          },
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"],
        );
        return public_key;
      },
    },
    {
      name: "namePng",
      tagClass: TagClass.Private,
      tagNumber: 0x25,
      constructed: false,
    },
    {
      name: "addressPng",
      tagClass: TagClass.Private,
      tagNumber: 0x26,
      constructed: false,
    },
    {
      name: "faceJp2",
      tagClass: TagClass.Private,
      tagNumber: 0x27,
      constructed: false,
    },
    {
      name: "thisSignature",
      tagClass: TagClass.Private,
      tagNumber: 0x28,
      constructed: false,
    },
    {
      name: "expire",
      tagClass: TagClass.Private,
      tagNumber: 0x29,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "securityCodePng",
      tagClass: TagClass.Private,
      tagNumber: 0x2a,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenkakuMyNumber = {
  name: "kenkakuMyNumber",
  tagClass: TagClass.Private,
  constructed: true,
  tagNumber: 0x40,
  fields: [
    {
      name: "myNumberPng",
      tagClass: TagClass.Private,
      tagNumber: 0x41,
      constructed: false,
    },
    {
      name: "publicKey",
      tagClass: TagClass.Private,
      tagNumber: 0x42,
      constructed: false,
      async encode(buffer) {
        const uint8 = new Uint8Array(buffer);
        const eParsed = BasicTLVParser.parse(uint8.buffer);
        const subBuffer = uint8.subarray(eParsed.endOffset);
        const nParsed = BasicTLVParser.parse(subBuffer.buffer);
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(eParsed.value),
            n: arrayBufferToBase64url(nParsed.value),
            key_ops: ["verify"],
            ext: true,
          },
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"],
        );
        return public_key;
      },
    },
    {
      name: "thisSignature",
      tagClass: TagClass.Private,
      tagNumber: 0x43,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

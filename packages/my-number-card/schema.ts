import { TLVParser, TLVRootSchema } from "@aokiapp/interface/tlv";
import { arrayBufferToBase64url } from "@aokiapp/interface/utils";

export const schemaCertificate = {
  name: "certificate",
  tagClass: "Application",
  constructed: true,
  tagNumber: 0x21,
  fields: [
    {
      name: "contents",
      tagClass: "Application",
      tagNumber: 0x4e,
      async encode(buffer) {
        const issuer = new Uint8Array(buffer, 0, 16);
        const subject = new Uint8Array(buffer, 16, 16);
        const certificate_raw = new Uint8Array(
          buffer,
          32,
          buffer.byteLength - 32,
        );
        const e = new TLVParser();
        const e_parsed = await e.parse(certificate_raw);

        const n = new TLVParser();
        const n_parsed = await n.parse(
          new Uint8Array(
            buffer,
            32 + e_parsed.endOffset,
            buffer.byteLength - (32 + e_parsed.endOffset),
          ),
        );
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(e_parsed.value),
            n: arrayBufferToBase64url(n_parsed.value),
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
      tagClass: "Application",
      tagNumber: 0x37,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenhojoMyNumber = {
  name: "kenhojoMyNumber",
  tagClass: "Private",
  constructed: true,
  tagNumber: 0x10,
  encode(buffer) {
    return new TextDecoder("utf-8").decode(buffer);
  },
} as const satisfies TLVRootSchema<string>;

export const schemaKenhojoBasicFour = {
  name: "kenhojoBasicFour",
  tagClass: "Private",
  constructed: true,
  tagNumber: 0x20,
  fields: [
    {
      name: "offsets",
      tagClass: "Private",
      tagNumber: 0x21,
      constructed: false,
    },
    {
      name: "name",
      tagClass: "Private",
      tagNumber: 0x22,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "address",
      tagClass: "Private",
      tagNumber: 0x23,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "birth",
      tagClass: "Private",
      tagNumber: 0x24,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "gender",
      tagClass: "Private",
      tagNumber: 0x25,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenhojoSignature = {
  name: "kenhojoSignature",
  tagClass: "Private",
  constructed: true,
  tagNumber: 0x30,
  fields: [
    {
      name: "kenhojoMyNumberSignature",
      tagClass: "Private",
      tagNumber: 0x31,
      constructed: false,
    },
    {
      name: "kenhojoAttributesSignature",
      tagClass: "Private",
      tagNumber: 0x32,
      constructed: false,
    },
    {
      name: "thisSignature",
      tagClass: "Private",
      tagNumber: 0x33,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenkakuBirth = {
  name: "kenkakuBirth",
  tagClass: "Private",
  constructed: true,
  tagNumber: 0x10,
  fields: [
    {
      name: "birth",
      tagClass: "Private",
      tagNumber: 0x11,
      constructed: false,
    },
    {
      name: "publicKey",
      tagClass: "Private",
      tagNumber: 0x32,
      constructed: false,
      async encode(buffer) {
        const certificate_raw = new Uint8Array(buffer, 0, buffer.byteLength);
        const e = new TLVParser();
        const e_parsed = await e.parse(certificate_raw);

        const n = new TLVParser();
        const n_parsed = await n.parse(
          new Uint8Array(
            buffer,
            e_parsed.endOffset,
            buffer.byteLength - e_parsed.endOffset,
          ),
        );
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(e_parsed.value),
            n: arrayBufferToBase64url(n_parsed.value),
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
      tagClass: "Private",
      tagNumber: 0x33,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenkakuEntries = {
  name: "kenkakuBirth",
  tagClass: "Private",
  constructed: true,
  tagNumber: 0x20,
  fields: [
    {
      name: "offsets",
      tagClass: "Private",
      tagNumber: 0x21,
      constructed: false,
    },
    {
      name: "birth",
      tagClass: "Private",
      tagNumber: 0x22,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "gender",
      tagClass: "Private",
      tagNumber: 0x23,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "publicKey",
      tagClass: "Private",
      tagNumber: 0x24,
      constructed: false,
      async encode(buffer) {
        const certificate_raw = new Uint8Array(buffer, 0, buffer.byteLength);
        const e = new TLVParser();
        const e_parsed = await e.parse(certificate_raw);

        const n = new TLVParser();
        const n_parsed = await n.parse(
          new Uint8Array(
            buffer,
            e_parsed.endOffset,
            buffer.byteLength - e_parsed.endOffset,
          ),
        );
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(e_parsed.value),
            n: arrayBufferToBase64url(n_parsed.value),
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
      tagClass: "Private",
      tagNumber: 0x25,
      constructed: false,
    },
    {
      name: "addressPng",
      tagClass: "Private",
      tagNumber: 0x26,
      constructed: false,
    },
    {
      name: "faceJp2",
      tagClass: "Private",
      tagNumber: 0x27,
      constructed: false,
    },
    {
      name: "thisSignature",
      tagClass: "Private",
      tagNumber: 0x28,
      constructed: false,
    },
    {
      name: "expire",
      tagClass: "Private",
      tagNumber: 0x29,
      constructed: false,
      encode(buffer) {
        return new TextDecoder("utf-8").decode(buffer);
      },
    },
    {
      name: "securityCodePng",
      tagClass: "Private",
      tagNumber: 0x2a,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

export const schemaKenkakuMyNumber = {
  name: "kenkakuMyNumber",
  tagClass: "Private",
  constructed: true,
  tagNumber: 0x40,
  fields: [
    {
      name: "myNumberPng",
      tagClass: "Private",
      tagNumber: 0x41,
      constructed: false,
    },
    {
      name: "publicKey",
      tagClass: "Private",
      tagNumber: 0x42,
      constructed: false,
      async encode(buffer) {
        const certificate_raw = new Uint8Array(buffer, 0, buffer.byteLength);
        const e = new TLVParser();
        const e_parsed = await e.parse(certificate_raw);

        const n = new TLVParser();
        const n_parsed = await n.parse(
          new Uint8Array(
            buffer,
            e_parsed.endOffset,
            buffer.byteLength - e_parsed.endOffset,
          ),
        );
        const public_key = await crypto.subtle.importKey(
          "jwk",
          {
            kty: "RSA",
            e: arrayBufferToBase64url(e_parsed.value),
            n: arrayBufferToBase64url(n_parsed.value),
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
      tagClass: "Private",
      tagNumber: 0x43,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

import { Schema, TagClass } from "@aokiapp/tlv/parser";
import { decodeOffsets, decodePublicKey, decodeText } from "./utils.js";

export const schemaCertificate = Schema.constructed(
  "certificate",
  [
    Schema.primitive(
      "contents",
      async (buffer) => {
        const issuer = buffer.slice(0, 16);
        const subject = buffer.slice(16, 32);
        const certificate_raw = buffer.slice(32);
        const public_key = await decodePublicKey(certificate_raw);
        return { issuer, subject, public_key };
      },
      {
        tagClass: TagClass.Application,
        tagNumber: 0x4e,
      },
    ),
    Schema.primitive("thisSignature", (buffer) => new Uint8Array(buffer), {
      tagClass: TagClass.Application,
      tagNumber: 0x37,
    }),
  ],
  {
    tagClass: TagClass.Application,
    tagNumber: 0x21,
  },
);

export const schemaKenhojoBasicFour = Schema.constructed("kenhojoBasicFour", [
  Schema.primitive("offsets", decodeOffsets, {
    tagClass: TagClass.Private,
    tagNumber: 0x21,
  }),
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
      "kenhojoMyNumberHash",
      (buffer) => new Uint8Array(buffer),
      { tagClass: TagClass.Private, tagNumber: 0x31 },
    ),
    Schema.primitive(
      "kenhojoBasicFourHash",
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

export const schemaKenhojoAuthKey = Schema.constructed(
  "kenhojoAuthKey",
  [
    Schema.primitive("publicKey", decodePublicKey, {
      tagClass: TagClass.Private,
      tagNumber: 0x51,
    }),
    Schema.primitive("thisSignature", (buffer) => new Uint8Array(buffer), {
      tagClass: TagClass.Private,
      tagNumber: 0x52,
    }),
  ],
  {
    tagClass: TagClass.Private,
    tagNumber: 0x50,
  },
);

export const schemaKenkakuBirth = Schema.constructed("kenkakuBirth", [
  Schema.primitive("birth", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x11,
  }),
  Schema.primitive("publicKey", decodePublicKey, {
    tagClass: TagClass.Private,
    tagNumber: 0x12,
  }),
  Schema.primitive("thisSignature", (buffer) => new Uint8Array(buffer), {
    tagClass: TagClass.Private,
    tagNumber: 0x13,
  }),
]);

export const schemaKenkakuEntries = Schema.constructed("kenkakuEntries", [
  Schema.primitive("offsets", decodeOffsets, {
    tagClass: TagClass.Private,
    tagNumber: 0x21,
  }),
  Schema.primitive("birth", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x22,
  }),
  Schema.primitive("gender", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x23,
  }),
  Schema.primitive("publicKey", decodePublicKey, {
    tagClass: TagClass.Private,
    tagNumber: 0x24,
  }),
  Schema.primitive("namePng", (buffer) => new Uint8Array(buffer), {
    tagClass: TagClass.Private,
    tagNumber: 0x25,
  }),
  Schema.primitive("addressPng", (buffer) => new Uint8Array(buffer), {
    tagClass: TagClass.Private,
    tagNumber: 0x26,
  }),
  Schema.primitive("faceJp2", (buffer) => new Uint8Array(buffer), {
    tagClass: TagClass.Private,
    tagNumber: 0x27,
  }),
  Schema.primitive("thisSignature", (buffer) => new Uint8Array(buffer), {
    tagClass: TagClass.Private,
    tagNumber: 0x28,
  }),
  Schema.primitive("expire", decodeText, {
    tagClass: TagClass.Private,
    tagNumber: 0x29,
  }),
  Schema.primitive("securityCodePng", (buffer) => new Uint8Array(buffer), {
    tagClass: TagClass.Private,
    tagNumber: 0x2a,
  }),
]);

export const schemaKenkakuMyNumber = Schema.constructed(
  "kenkakuMyNumber",
  [
    Schema.primitive("myNumberPng", (buffer) => new Uint8Array(buffer), {
      tagClass: TagClass.Private,
      tagNumber: 0x41,
    }),
    Schema.primitive("publicKey", decodePublicKey, {
      tagClass: TagClass.Private,
      tagNumber: 0x42,
    }),
    Schema.primitive("thisSignature", (buffer) => new Uint8Array(buffer), {
      tagClass: TagClass.Private,
      tagNumber: 0x43,
    }),
  ],
  {
    tagClass: TagClass.Private,
    tagNumber: 0x40,
  },
);

import { Schema, TagClass } from "@aokiapp/tlv/parser";
import { decodeOffsets, decodeText } from "./utils.js";

// Note: Explicit 'any' type is used because @aokiapp/tlv doesn't export its internal schema types.
// This is a known limitation of the library. Type inference for parse results still works at runtime.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaCertificate: any = Schema.constructed(
  "certificate",
  {
    tagClass: TagClass.Application,
    tagNumber: 0x21,
  },
  [
    Schema.primitive(
      "contents",
      {
        tagClass: TagClass.Application,
        tagNumber: 0x4e,
      },
      (buffer: ArrayBuffer) => {
        const issuer = buffer.slice(0, 16);
        const subject = buffer.slice(16, 32);
        const publicKeyRaw = buffer.slice(32);
        return { issuer, subject, publicKeyRaw };
      },
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Application,
        tagNumber: 0x37,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
  ],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaKenhojoBasicFour: any = Schema.constructed(
  "kenhojoBasicFour",
  {},
  [
    Schema.primitive(
      "offsets",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x21,
      },
      decodeOffsets,
    ),
    Schema.primitive(
      "name",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x22,
      },
      decodeText,
    ),
    Schema.primitive(
      "address",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x23,
      },
      decodeText,
    ),
    Schema.primitive(
      "birth",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x24,
      },
      decodeText,
    ),
    Schema.primitive(
      "gender",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x25,
      },
      decodeText,
    ),
  ],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaKenhojoSignature: any = Schema.constructed(
  "kenhojoSignature",
  {
    tagClass: TagClass.Private,
    tagNumber: 0x30,
  },
  [
    Schema.primitive(
      "kenhojoMyNumberHash",
      { tagClass: TagClass.Private, tagNumber: 0x31 },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
    Schema.primitive(
      "kenhojoBasicFourHash",
      { tagClass: TagClass.Private, tagNumber: 0x32 },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x33,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
  ],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaKenhojoAuthKey: any = Schema.constructed(
  "kenhojoAuthKey",
  {
    tagClass: TagClass.Private,
    tagNumber: 0x50,
  },
  [
    Schema.primitive(
      "publicKeyRaw",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x51,
      },
      (buffer: ArrayBuffer) => buffer,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x52,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
  ],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaKenkakuBirth: any = Schema.constructed(
  "kenkakuBirth",
  {},
  [
    Schema.primitive(
      "birth",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x11,
      },
      decodeText,
    ),
    Schema.primitive(
      "publicKeyRaw",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x12,
      },
      (buffer: ArrayBuffer) => buffer,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x13,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
  ],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaKenkakuEntries: any = Schema.constructed(
  "kenkakuEntries",
  {},
  [
    Schema.primitive(
      "offsets",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x21,
      },
      decodeOffsets,
    ),
    Schema.primitive(
      "birth",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x22,
      },
      decodeText,
    ),
    Schema.primitive(
      "gender",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x23,
      },
      decodeText,
    ),
    Schema.primitive(
      "publicKeyRaw",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x24,
      },
      (buffer: ArrayBuffer) => buffer,
    ),
    Schema.primitive(
      "namePng",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x25,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
    Schema.primitive(
      "addressPng",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x26,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
    Schema.primitive(
      "faceJp2",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x27,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x28,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
    Schema.primitive(
      "expire",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x29,
      },
      decodeText,
    ),
    Schema.primitive(
      "securityCodePng",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x2a,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
  ],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schemaKenkakuMyNumber: any = Schema.constructed(
  "kenkakuMyNumber",
  {
    tagClass: TagClass.Private,
    tagNumber: 0x40,
  },
  [
    Schema.primitive(
      "myNumberPng",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x41,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
    Schema.primitive(
      "publicKeyRaw",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x42,
      },
      (buffer: ArrayBuffer) => buffer,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x43,
      },
      (buffer: ArrayBuffer) => new Uint8Array(buffer),
    ),
  ],
);

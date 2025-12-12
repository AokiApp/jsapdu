import { Schema, TagClass } from "@aokiapp/tlv/parser";
import { decodeOffsets, decodeText } from "./utils.js";

// Common decoder functions
const decodeAsUint8Array = (buffer: ArrayBuffer) => new Uint8Array(buffer);
const decodeAsArrayBuffer = (buffer: ArrayBuffer) => buffer;

export const schemaCertificate = Schema.constructed(
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
      decodeAsUint8Array,
    ),
  ],
);

export const schemaKenhojoBasicFour = Schema.constructed(
  "kenhojoBasicFour",
  {
    tagClass: TagClass.Private,
    tagNumber: 0x20,
  },
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

export const schemaKenhojoSignature = Schema.constructed(
  "kenhojoSignature",
  {
    tagClass: TagClass.Private,
    tagNumber: 0x30,
  },
  [
    Schema.primitive(
      "kenhojoMyNumberHash",
      { tagClass: TagClass.Private, tagNumber: 0x31 },
      decodeAsUint8Array,
    ),
    Schema.primitive(
      "kenhojoBasicFourHash",
      { tagClass: TagClass.Private, tagNumber: 0x32 },
      decodeAsUint8Array,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x33,
      },
      decodeAsUint8Array,
    ),
  ],
);

export const schemaKenhojoAuthKey = Schema.constructed(
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
      decodeAsArrayBuffer,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x52,
      },
      decodeAsUint8Array,
    ),
  ],
);

export const schemaKenkakuBirth = Schema.constructed(
  "kenkakuBirth",
  {
    tagClass: TagClass.Private,
    tagNumber: 0x10,
  },
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
      decodeAsArrayBuffer,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x13,
      },
      decodeAsUint8Array,
    ),
  ],
);

export const schemaKenkakuEntries = Schema.constructed(
  "kenkakuEntries",
  {
    tagClass: TagClass.Private,
    tagNumber: 0x20,
  },
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
      decodeAsArrayBuffer,
    ),
    Schema.primitive(
      "namePng",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x25,
      },
      decodeAsUint8Array,
    ),
    Schema.primitive(
      "addressPng",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x26,
      },
      decodeAsUint8Array,
    ),
    Schema.primitive(
      "faceJp2",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x27,
      },
      decodeAsUint8Array,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x28,
      },
      decodeAsUint8Array,
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
      decodeAsUint8Array,
    ),
  ],
);

export const schemaKenkakuMyNumber = Schema.constructed(
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
      decodeAsUint8Array,
    ),
    Schema.primitive(
      "publicKeyRaw",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x42,
      },
      decodeAsArrayBuffer,
    ),
    Schema.primitive(
      "thisSignature",
      {
        tagClass: TagClass.Private,
        tagNumber: 0x43,
      },
      decodeAsUint8Array,
    ),
  ],
);

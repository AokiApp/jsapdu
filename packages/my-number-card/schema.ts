import { TLVRootSchema } from "@aokiapp/interface/tlv";

export const schemaCertificate = {
  name: "certificate",
  tagClass: "Application",
  constructed: true,
  tagNumber: 0x21,
  fields: [
    {
      name: "certificate",
      tagClass: "Application",
      tagNumber: 0x4e,
      constructed: false,
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
  encode: "utf-8",
} as const satisfies TLVRootSchema;

export const schemaKenhojoAttributes = {
  name: "kenhojoAttributes",
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
      encode: "utf-8",
    },
    {
      name: "address",
      tagClass: "Private",
      tagNumber: 0x23,
      constructed: false,
      encode: "utf-8",
    },
    {
      name: "birth",
      tagClass: "Private",
      tagNumber: 0x24,
      constructed: false,
      encode: "utf-8",
    },
    {
      name: "gender",
      tagClass: "Private",
      tagNumber: 0x25,
      constructed: false,
      encode: "utf-8",
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
      encode: "utf-8",
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
      encode: "utf-8",
    },
    {
      name: "gender",
      tagClass: "Private",
      tagNumber: 0x23,
      constructed: false,
      encode: "utf-8",
    },
    {
      name: "publicKey",
      tagClass: "Private",
      tagNumber: 0x24,
      constructed: false,
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
      encode: "utf-8",
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
    },
    {
      name: "thisSignature",
      tagClass: "Private",
      tagNumber: 0x43,
      constructed: false,
    },
  ],
} as const satisfies TLVRootSchema;

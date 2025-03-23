import { BasicTLVParser, SchemaParser } from "@aokiapp/tlv-parser";
import {
  hexStringToUint8Array,
  schemaCertificate,
  schemaKenhojoBasicFour,
  schemaKenhojoSignature,
  schemaKenkakuEntries,
  schemaKenkakuMyNumber,
} from "@aokiapp/mynacard";

export const kenkakuEntries = hexStringToUint8Array(
  process.env.KENKAKU_02 || "",
);

export const kenkakuInformation = hexStringToUint8Array(
  process.env.KENKAKU_03 || "",
);

export const kenkakuCertificate = hexStringToUint8Array(
  process.env.KENKAKU_04 || "",
);

export const kenkakuMyNumber = hexStringToUint8Array(
  process.env.KENKAKU_05 || "",
);

export const kenhojoMyNumber = hexStringToUint8Array(
  process.env.KENHOJO_01 || "",
);

export const kenhojoBasicFour = hexStringToUint8Array(
  process.env.KENHOJO_02 || "",
);

export const kenhojoSignature = hexStringToUint8Array(
  process.env.KENHOJO_03 || "",
);

export const kenhojoCertificate = hexStringToUint8Array(
  process.env.KENHOJO_04 || "",
);

export const kenhojoInformation = hexStringToUint8Array(
  process.env.KENHOJO_05 || "",
);

export const kenhojoEf0006 = hexStringToUint8Array(
  process.env.KENHOJO_06 || "",
);

export const kenhojoAuthKey = hexStringToUint8Array(
  process.env.KENHOJO_07 || "",
);

const kenhojoMyNumberParsed = BasicTLVParser.parse(kenhojoMyNumber.buffer);
console.log("=== KENHOJO MY NUMBER DATA ===");
console.log(kenhojoMyNumberParsed.value);
console.log("=== KENHOJO MY NUMBER DATA ===");

const kenhojoBasicFourParser = new SchemaParser(schemaKenhojoBasicFour);
console.log("=== KENHOJO BASIC FOUR DATA ===");
console.log(kenhojoBasicFourParser.parse(kenhojoBasicFour.buffer));
console.log("=== KENHOJO BASIC FOUR DATA ===");

const kenhojoSignatureParser = new SchemaParser(schemaKenhojoSignature);
console.log("=== KENHOJO SIGNATURE DATA ===");
console.log(kenhojoSignatureParser.parse(kenhojoSignature.buffer));
console.log("=== KENHOJO SIGNATURE DATA ===");

const kenhojoCertificateParser = new SchemaParser(schemaCertificate);
const kenhojoCertificateParsed = await kenhojoCertificateParser.parse(
  kenhojoCertificate.buffer,
  { async: true },
);
console.log("=== KENHOJO CERTIFICATE DATA ===");
console.log(kenhojoCertificateParsed);
console.log("=== KENHOJO CERTIFICATE DATA ===");

const kenkakuEntriesParser = new SchemaParser(schemaKenkakuEntries);
const kenkakuEntriesParsed = kenkakuEntriesParser.parse(kenkakuEntries.buffer, {
  async: true,
});
console.log("=== KENKAKU ENTRIES DATA ===");
console.log(kenkakuEntriesParsed);
console.log("=== KENKAKU ENTRIES DATA ===");

const kenkakuMyNumberParser = new SchemaParser(schemaKenkakuMyNumber);
const kenkakuMyNumberParsed = kenkakuMyNumberParser.parse(
  kenkakuMyNumber.buffer,
  { async: true },
);
console.log("=== KENKAKU MY NUMBER DATA ===");
console.log(kenkakuMyNumberParsed);
console.log("=== KENKAKU MY NUMBER DATA ===");

import {
  schemaCertificate,
  schemaKenhojoBasicFour,
  schemaKenhojoSignature,
  schemaKenkakuEntries,
  schemaKenkakuMyNumber,
} from "@aokiapp/mynacard";
import { BasicTLVParser, SchemaParser } from "@aokiapp/tlv-parser";

import {
  calculateBasicFourHash,
  calculateMyNumberHash,
  uint8ArrayToHexString,
} from "./utils.js";

function hexStringToUint8Array(hexString: string): Uint8Array<ArrayBuffer> {
  // Check if the input is in hexadecimal format
  if (!/^[0-9a-fA-F\s]+$/.test(hexString)) {
    throw new Error("Invalid hexadecimal string: Contains non-hex characters.");
  }

  // Remove whitespace
  hexString = hexString.replace(/\s+/g, "");

  // Check if the length is even
  if (hexString.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal string: Length must be even.");
  }

  // Create Uint8Array
  const uint8Array = new Uint8Array(hexString.length / 2);

  // Convert two characters at a time
  for (let i = 0; i < hexString.length; i += 2) {
    uint8Array[i / 2] = Number("0x" + hexString.slice(i, i + 2));
  }

  return uint8Array;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  } else {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);
    return base64;
  }
}

const {
  // KENKAKU_01, // 誕生日,
  KENKAKU_02, // 券面内容
  // KENKAKU_03, // AP基本情報
  KENKAKU_04, // 証明書
  KENKAKU_05, // 個人番号写真
  // KENKAKU_06, // 不明
  KENHOJO_01, // 個人番号
  KENHOJO_02, // 基本4情報
  KENHOJO_03, // 署名
  KENHOJO_04, // 証明書
  // KENHOJO_05, // AP基本情報
  // KENHOJO_06, // 不明
  // KENHOJO_07, // 認証鍵
  // KENHOJO_08, // 不明
} = process.env;

// const kenkakuBirth = KENKAKU_01 && hexStringToUint8Array(KENKAKU_01);
const kenkakuEntries = KENKAKU_02 && hexStringToUint8Array(KENKAKU_02);
// const kenkakuInformation = KENKAKU_03 && hexStringToUint8Array(KENKAKU_03);
const kenkakuCertificate = KENKAKU_04 && hexStringToUint8Array(KENKAKU_04);
const kenkakuMyNumber = KENKAKU_05 && hexStringToUint8Array(KENKAKU_05);
// const kenkakuEf0006 = KENKAKU_06 && hexStringToUint8Array(KENKAKU_06);

const kenhojoMyNumber = KENHOJO_01 && hexStringToUint8Array(KENHOJO_01);
const kenhojoBasicFour = KENHOJO_02 && hexStringToUint8Array(KENHOJO_02);
const kenhojoSignature = KENHOJO_03 && hexStringToUint8Array(KENHOJO_03);
const kenhojoCertificate = KENHOJO_04 && hexStringToUint8Array(KENHOJO_04);
// const kenhojoInformation = KENHOJO_05 && hexStringToUint8Array(KENHOJO_05);
// const kenhojoEf0006 = KENHOJO_06 && hexStringToUint8Array(KENHOJO_06);
// const kenhojoAuthKey = KENHOJO_07 && hexStringToUint8Array(KENHOJO_07);

if (kenkakuEntries) {
  const parser = new SchemaParser(schemaKenkakuEntries);
  const parsed = await parser.parse(kenkakuEntries.buffer, { async: true });
  console.log("=== KENKAKU ENTRIES (02) DATA ===");
  console.log("Offsets:", parsed.offsets);
  console.log("Birth:", parsed.birth);
  console.log("Gender:", parsed.gender);
  const nameBase64 = arrayBufferToBase64(parsed.namePng.buffer);
  console.log(`Name: data:image/png;base64,${nameBase64}`);
  const addressBase64 = arrayBufferToBase64(parsed.addressPng.buffer);
  console.log(`Address: data:image/png;base64,${addressBase64}`);
  const faceBase64 = arrayBufferToBase64(parsed.faceJp2.buffer);
  console.log(`Face: data:image/jp2;base64,${faceBase64}`);
  console.log("Expire:", parsed.expire);
  const securityCodeBase64 = arrayBufferToBase64(parsed.securityCodePng.buffer);
  console.log(`Security Code: data:image/png;base64,${securityCodeBase64}`);
  console.log("=== KENKAKU ENTRIES (02) DATA ===");
}

console.log();

if (kenkakuCertificate) {
  const parser = new SchemaParser(schemaCertificate);
  const parsed = await parser.parse(kenkakuCertificate.buffer, { async: true });
  console.log("=== KENKAKU CERTIFICATE (04) DATA ===");
  console.log(parsed);
  console.log("=== KENKAKU CERTIFICATE (04) DATA ===");
}

console.log();

if (kenkakuMyNumber) {
  const parser = new SchemaParser(schemaKenkakuMyNumber);
  const parsed = await parser.parse(kenkakuMyNumber.buffer, { async: true });
  console.log("=== KENKAKU MY NUMBER (05) DATA ===");
  const myNumberBase64 = arrayBufferToBase64(parsed.myNumberPng.buffer);
  console.log(`data:image/png;base64,${myNumberBase64}`);
  console.log("=== KENKAKU MY NUMBER (05) DATA ===");
}

console.log();

if (kenhojoMyNumber) {
  const parsed = BasicTLVParser.parse(kenhojoMyNumber.buffer);
  const buffer = kenhojoMyNumber.buffer.slice(
    0,
    kenhojoMyNumber.buffer.byteLength - 2,
  );
  const hash = await calculateMyNumberHash(buffer);
  console.log("=== KENHOJO MY NUMBER (01) DATA ===");
  console.log(new TextDecoder().decode(parsed.value));
  console.log(`Hash: ${uint8ArrayToHexString(new Uint8Array(hash))}`);
  console.log("=== KENHOJO MY NUMBER (01) DATA ===");
}

console.log();

if (kenhojoBasicFour) {
  const parser = new SchemaParser(schemaKenhojoBasicFour);
  const parsed = parser.parse(kenhojoBasicFour.buffer);
  const hash = await calculateBasicFourHash(kenhojoBasicFour.buffer);
  console.log("=== KENHOJO BASIC FOUR (02) DATA ===");
  console.log(`Name: ${parsed.name}`);
  console.log(`Address: ${parsed.address}`);
  console.log(`Birth: ${parsed.birth}`);
  console.log(`Gender: ${parsed.gender}`);
  console.log(`Hash: ${uint8ArrayToHexString(new Uint8Array(hash))}`);
  console.log("=== KENHOJO BASIC FOUR (02) DATA ===");
}

console.log();

if (kenhojoSignature) {
  const parser = new SchemaParser(schemaKenhojoSignature);
  console.log("=== KENHOJO SIGNATURE (03) DATA ===");
  const parsed = parser.parse(kenhojoSignature.buffer);
  console.log(
    "Kenhojo My Number Hash:",
    uint8ArrayToHexString(parsed.kenhojoMyNumberHash),
  );
  console.log(
    "Kenhojo Basic Four Hash:",
    uint8ArrayToHexString(parsed.kenhojoBasicFourHash),
  );
  console.log("=== KENHOJO SIGNATURE (03) DATA ===");
}

console.log();

if (kenhojoCertificate) {
  const parser = new SchemaParser(schemaCertificate);
  const parsed = await parser.parse(kenhojoCertificate.buffer, { async: true });
  console.log("=== KENHOJO CERTIFICATE (04) DATA ===");
  console.log(parsed);
  console.log("=== KENHOJO CERTIFICATE (04) DATA ===");
}

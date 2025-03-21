import { BasicTLVParser } from "@aokiapp/tlv-parser";

export function hexStringToUint8Array(hexString: string): Uint8Array {
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

export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
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

export async function decodePublicKey(buffer: ArrayBuffer): Promise<CryptoKey> {
  const eParsed = BasicTLVParser.parse(buffer);
  const subBuffer = buffer.slice(eParsed.endOffset);
  const nParsed = BasicTLVParser.parse(subBuffer);
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
}

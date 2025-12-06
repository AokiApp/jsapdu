import { BasicTLVParser } from "@aokiapp/tlv/parser";

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

export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buffer);
}

export function decodeOffsets(buffer: ArrayBuffer): number[] {
  const uint8 = new Uint8Array(buffer);
  const offsets = [];
  for (let i = 0; i < uint8.length; i += 2) {
    offsets.push((uint8[i] << 8) | uint8[i + 1]);
  }
  return offsets;
}

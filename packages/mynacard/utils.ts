import { BasicTLVParser } from "@aokiapp/tlv-parser";

/**
 * Prompts the user for a password in the terminal, masking input with asterisks.
 * @param query The prompt message to display
 * @returns A promise that resolves with the entered password
 */
export async function askPassword(query: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    // Ensure stdin is TTY before proceeding
    if (!stdin.isTTY) {
      reject(new Error("stdin is not a TTY, cannot read password securely"));
      return;
    }

    let password = "";

    stdout.write(query);

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (char: string) => {
      switch (char) {
        case "\r":
        case "\n":
          stdout.write("\n");
          cleanup();
          resolve(password);
          break;
        case "\u0003": // Ctrl+C
          stdout.write("\nCanceled\n");
          cleanup();
          reject(new Error("Password input canceled"));
          break;
        case "\u007F": // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write("\b \b");
          }
          break;
        default:
          if (char.charCodeAt(0) >= 32) {
            // Only accept printable characters
            password += char;
            stdout.write("*");
          }
          break;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
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

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

export function toUint8Array(data: Uint8Array | number[] | string): Uint8Array {
  if (typeof data === "string") {
    return new Uint8Array(
      data.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
  }
  return data instanceof Uint8Array ? data : Uint8Array.from(data);
}

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

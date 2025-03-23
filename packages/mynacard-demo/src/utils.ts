import { PcscPlatform } from "@aokiapp/pcsc";

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

export async function getPlatform() {
  if (typeof process !== "undefined" && process.versions?.node) {
    const pcsclite = await import("pcsclite");
    return new PcscPlatform(pcsclite.default());
  } else {
    throw new Error("Unsupported platform");
  }
}

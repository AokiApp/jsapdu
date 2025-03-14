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

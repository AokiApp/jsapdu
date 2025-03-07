import { KENHOJO_AP, INS } from "./constant";

/**
 * The CommandApdu class is for constructing and parsing APDU commands (standard and extended).
 * This class works in both Node.js and browser environments.
 */

class CommandApdu {
  public readonly cla: number;
  public readonly ins: number;
  public readonly p1: number;
  public readonly p2: number;
  public readonly data: Uint8Array | null;
  public readonly le: number | null;

  /**
   * Constructor
   *
   * @param cla - CLA byte (0x00 to 0xFF)
   * @param ins - INS byte (0x00 to 0xFF)
   * @param p1 - P1 parameter (0x00 to 0xFF)
   * @param p2 - P2 parameter (0x00 to 0xFF)
   * @param data - Optional data payload (Uint8Array or null)
   * @param le - Optional expected response data length (number or null)
   */
  constructor(
    cla: number,
    ins: number,
    p1: number,
    p2: number,
    data: Uint8Array | null = null,
    le: number | null = null,
  ) {
    // Validate input bytes
    [cla, ins, p1, p2].forEach((byte, index) => {
      if (!Number.isInteger(byte) || byte < 0x00 || byte > 0xff) {
        throw new RangeError(
          `Byte ${index} (value: ${byte}) must be an integer between 0x00 and 0xFF.`,
        );
      }
    });

    this.cla = cla;
    this.ins = ins;
    this.p1 = p1;
    this.p2 = p2;
    this.data = data;
    this.le = le;
  }

  /**
   * Method to serialize CommandApdu to Uint8Array
   *
   * @returns {Uint8Array} Uint8Array representing the APDU command
   */
  public toUint8Array(): Uint8Array {
    const header = new Uint8Array([this.cla, this.ins, this.p1, this.p2]);
    let body = new Uint8Array(0);
    let isExtended = false;

    // Determine Lc and Le
    if (this.data !== null && this.data.length > 255) {
      isExtended = true;
    }
    if (this.le !== null && this.le > 256) {
      isExtended = true;
    }

    if (this.data !== null && this.le !== null) {
      if (isExtended) {
        // Extended APDU (both data and Le exist)
        const extendedBody = new Uint8Array(1 + 2 + this.data.length + 2);
        let offset = 0;
        extendedBody[offset++] = 0x00; // Extended APDU indicator
        extendedBody[offset++] = (this.data.length >>> 8) & 0xff; // Lc high byte
        extendedBody[offset++] = this.data.length & 0xff; // Lc low byte
        extendedBody.set(this.data, offset); // Data
        offset += this.data.length;
        extendedBody[offset++] = (this.le >>> 8) & 0xff; // Le high byte
        extendedBody[offset++] = this.le & 0xff; // Le low byte
        body = extendedBody;
      } else {
        // Standard APDU (both data and Le exist)
        const standardBody = new Uint8Array(1 + this.data.length + 1);
        let offset = 0;
        standardBody[offset++] = this.data.length; // Lc
        standardBody.set(this.data, offset); // Data
        offset += this.data.length;
        standardBody[offset++] = this.le; // Le
        body = standardBody;
      }
    } else if (this.data !== null) {
      if (isExtended) {
        // Extended APDU (data only)
        const extendedBody = new Uint8Array(1 + 2 + this.data.length);
        let offset = 0;
        extendedBody[offset++] = 0x00; // Extended APDU indicator
        extendedBody[offset++] = (this.data.length >>> 8) & 0xff; // Lc high byte
        extendedBody[offset++] = this.data.length & 0xff; // Lc low byte
        extendedBody.set(this.data, offset); // Data
        body = extendedBody;
      } else {
        // Standard APDU (data only)
        const standardBody = new Uint8Array(1 + this.data.length);
        let offset = 0;
        standardBody[offset++] = this.data.length; // Lc
        standardBody.set(this.data, offset); // Data
        body = standardBody;
      }
    } else if (this.le !== null) {
      if (isExtended) {
        // Extended APDU (Le only)
        const extendedBody = new Uint8Array(1 + 2);
        extendedBody[0] = 0x00; // Extended APDU indicator
        extendedBody[1] = (this.le >>> 8) & 0xff; // Le high byte
        extendedBody[2] = this.le & 0xff; // Le low byte
        body = extendedBody;
      } else {
        // Standard APDU (Le only)
        const standardBody = new Uint8Array(1);
        standardBody[0] = this.le; // Le
        body = standardBody;
      }
    }

    // Combine header and body
    const apdu = new Uint8Array(header.length + body.length);
    apdu.set(header, 0);
    apdu.set(body, header.length);
    return apdu;
  }

  /**
   * Method to serialize CommandApdu to a hexadecimal string
   *
   * @returns {string} Hexadecimal string of the APDU command
   */
  public toHexString(): string {
    const byteArray = this.toUint8Array();
    return Array.from(byteArray)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  /**
   * Static method to parse a Uint8Array into a CommandApdu
   *
   * @param byteArray - Uint8Array to parse
   * @returns {CommandApdu} Parsed CommandApdu instance
   */
  public static fromUint8Array(byteArray: Uint8Array): CommandApdu {
    if (!(byteArray instanceof Uint8Array)) {
      throw new TypeError("Input must be a Uint8Array.");
    }

    if (byteArray.length < 4) {
      throw new RangeError("Input is too short to be a valid APDU command.");
    }

    const cla = byteArray[0];
    const ins = byteArray[1];
    const p1 = byteArray[2];
    const p2 = byteArray[3];
    let data: Uint8Array | null = null;
    let le: number | null = null;
    let index = 4;

    if (byteArray.length === 4) {
      // Case 1: Only CLA, INS, P1, P2
      return new CommandApdu(cla, ins, p1, p2);
    }

    if (byteArray.length === 5) {
      le = byteArray[4] === 0 ? 256 : byteArray[4];
      // Case 2: CLA, INS, P1, P2, Le
      return new CommandApdu(cla, ins, p1, p2, null, le);
    }

    /* If Command APDU is not case 2 and firstIndicator is 0x00, it is extended APDU */
    const firstIndicator = byteArray[index];
    if (firstIndicator !== 0x00) {
      // Case 3 or 4: CLA, INS, P1, P2, Lc, Data, [Le]
      const lc = byteArray[index];
      index += 1;

      if (byteArray.length === index + lc) {
        // Case 3: CLA, INS, P1, P2, Lc, Data
        data = byteArray.slice(index, index + lc);
        return new CommandApdu(cla, ins, p1, p2, data, null);
      } else if (byteArray.length === index + lc + 1) {
        // Case 4: CLA, INS, P1, P2, Lc, Data, Le
        data = byteArray.slice(index, index + lc);
        le = byteArray[index + lc];
        return new CommandApdu(cla, ins, p1, p2, data, le);
      } else {
        throw new RangeError("APDU structure is invalid.");
      }
    } else {
      // Extended APDU
      index += 1;
      if (byteArray.length < index + 2) {
        throw new RangeError(
          "For extended APDU, length of Lc or Le is insufficient.",
        );
      }

      // Read the next two bytes
      const lcOrLe = (byteArray[index] << 8) | byteArray[index + 1];
      index += 2;

      if (byteArray.length === index) {
        // Case 2 Extended: CLA, INS, P1, P2, 00, Le1, Le2
        le = lcOrLe === 0 ? 65536 : lcOrLe;
        return new CommandApdu(cla, ins, p1, p2, null, le);
      }

      const lc = lcOrLe;

      if (byteArray.length < index + lc) {
        throw new RangeError("Data is insufficient for the specified Lc.");
      }

      data = byteArray.slice(index, index + lc);
      index += lc;

      if (byteArray.length === index) {
        return new CommandApdu(cla, ins, p1, p2, data, null);
      }

      if (byteArray.length === index + 2) {
        // Case 4 Extended: CLA, INS, P1, P2, 00, Data, Le1, Le2
        le = (byteArray[index] << 8) | byteArray[index + 1] ? 65536 : lcOrLe;
        return new CommandApdu(cla, ins, p1, p2, data, le);
      }
      throw new RangeError("Extended APDU structure is invalid.");
    }
  }

  /**
   * Static method to create a CommandApdu from a hexadecimal string
   *
   * @param hexString - Hexadecimal string
   * @returns {CommandApdu} Parsed CommandApdu instance
   */
  public static fromHexString(hexString: string): CommandApdu {
    if (typeof hexString !== "string") {
      throw new TypeError("Input must be a string.");
    }
    if (hexString.length % 2 !== 0) {
      throw new RangeError("Length of hexadecimal string must be even.");
    }
    const byteArray = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < byteArray.length; i++) {
      const byte = hexString.substring(i * 2, i * 2 + 2);
      const parsed = parseInt(byte, 16);
      if (isNaN(parsed)) {
        throw new RangeError(`Invalid hexadecimal character: ${byte}`);
      }
      byteArray[i] = parsed;
    }
    return CommandApdu.fromUint8Array(byteArray);
  }

  /**
   * Method to return the APDU command as a human-readable hexadecimal string
   *
   * @returns {string} Hexadecimal string of the APDU command
   */
  public toString(): string {
    return this.toHexString();
  }
}

export function select(
  p1: number,
  p2: number,
  data: Uint8Array | number[],
  le: number | null = null,
): CommandApdu {
  if ((p2 & 0x0c) === 0x0c && le !== null) {
    throw new Error("Invalid P2 and Le combination.");
  }

  if (data instanceof Uint8Array) {
    const apdu = new CommandApdu(0x00, 0xa4, p1, p2, data, le);
    return apdu;
  }

  const apdu = new CommandApdu(0x00, 0xa4, p1, p2, new Uint8Array(data), le);
  return apdu;
}

/**
 * The CommandApdu class is for constructing and parsing APDU commands (standard and extended).
 * This class works in both Node.js and browser environments.
 */

export class CommandApdu {
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
        // Case 4 Extended: CLA, INS, P1, P2, 00, Data
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
function toUint8Array(data: Uint8Array | number[] | string): Uint8Array {
  if (typeof data === "string") {
    return new Uint8Array(
      data.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
  }
  return data instanceof Uint8Array ? data : Uint8Array.from(data);
}

export function select(
  p1: number,
  p2: number,
  data: Uint8Array | number[] | string,
  le: number | null = null,
): CommandApdu {
  if ((p2 & 0x0c) === 0x0c && le !== null) {
    throw new Error("Invalid P2 and Le combination for SELECT.");
  }
  return new CommandApdu(0x00, 0xa4, p1, p2, toUint8Array(data), le);
}

export function selectDf(
  data: Uint8Array | number[] | string,
  fciRequested: boolean = false,
): CommandApdu {
  const dfData = toUint8Array(data);
  if (dfData.length < 1 || dfData.length > 16) {
    throw new Error("Invalid DF identifier.");
  }
  return fciRequested
    ? select(0x04, 0x00, dfData, 0x00)
    : select(0x04, 0x0c, dfData, null);
}

export function selectEf(data: Uint8Array | number[] | string): CommandApdu {
  const efData = toUint8Array(data);
  if (efData.length !== 2) {
    throw new Error("Invalid EF identifier.");
  }
  return select(0x02, 0x0c, efData, null);
}

/**
 * Construct a VERIFY command APDU
 * @param data - PIN data (1 to 16 bytes)
 * @param options - Options for VERIFY command
 * @returns {CommandApdu} VERIFY command APDU
 * @throws {Error} If EF identifier is invalid or if PIN data string is not numeric
 */
export function verify(
  data: Uint8Array | number[] | string,
  options: {
    ef?: number | string;
    isCurrent?: boolean;
  },
): CommandApdu {
  let p2: number = 0x80; // デフォルトはカレントDF用
  let ef: number = 0x00;

  if (options.ef !== undefined) {
    if (typeof options.ef === "string") {
      ef = parseInt(options.ef, 10);
    } else {
      ef = options.ef;
    }
    if (ef > 0x1e) {
      throw new Error("Invalid EF identifier.");
    }

    p2 = 0x80 + ef;
  } else if (options.isCurrent) {
    p2 = 0x80;
  }

  let pinData: Uint8Array;
  if (typeof data === "string") {
    if (!/^\d+$/.test(data)) {
      throw new Error("PIN data string must contain only digits.");
    }
    pinData = Uint8Array.from(
      data.split("").map((digit) => digit.charCodeAt(0)),
    );
  } else {
    pinData = toUint8Array(data);
  }

  return new CommandApdu(0x00, 0x20, 0x00, p2, pinData);
}

export function readBinary(
  offset: number,
  length: number,
  isExtended = false,
  useMaxLe = false,
  options?: {
    isCurrentEF?: boolean;
    shortEfId?: number;
    useRelativeAddress15Bit?: boolean;
    useRelativeAddress8Bit?: boolean;
  },
): CommandApdu {
  if (
    (isExtended && (offset > 0xffff || length > 0xffff)) ||
    (!isExtended && (offset > 0xffff || length > 0xff))
  ) {
    throw new Error(
      `Offset or length is out of range for ${
        isExtended ? "extended" : "standard"
      } APDU.`,
    );
  }

  const leValue = useMaxLe ? (isExtended ? 65536 : 256) : length;
  let p1 = (offset >>> 8) & 0xff;
  let p2 = offset & 0xff;

  if (options) {
    if (options.isCurrentEF) p2 = 0x00;
    if (options.shortEfId !== undefined) {
      p1 = 0;
      p2 = 0x80 | (options.shortEfId & 0x1f);
    }
    if (options.useRelativeAddress15Bit) {
      p1 = (offset >>> 8) & 0x7f;
    }
    if (options.useRelativeAddress8Bit) {
      p1 = 0;
      p2 = offset & 0xff;
    }
  }

  return new CommandApdu(0x00, 0xb0, p1, p2, null, leValue);
}

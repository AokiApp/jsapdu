/**
 * The CommandApdu class is for constructing and parsing APDU commands (standard and extended).
 * This class works in both Node.js and browser environments.
 */
export class CommandApdu {
  public readonly cla: number;
  public readonly ins: number;
  public readonly p1: number;
  public readonly p2: number;
  public readonly data: Uint8Array<ArrayBuffer> | null;
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
    data: Uint8Array<ArrayBuffer> | null = null,
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
   * @returns Uint8Array representing the APDU command
   */
  public toUint8Array(): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array([this.cla, this.ins, this.p1, this.p2]);
    const hasData = this.data !== null && this.data.length > 0;
    const dataLen = hasData ? this.data.length : 0;
    const isExtended =
      (hasData && dataLen > 255) || (this.le !== null && this.le > 256);

    let bodyLen = 0;
    if (hasData && this.le !== null) {
      bodyLen = isExtended ? 1 + 2 + dataLen + 2 : 1 + dataLen + 1;
    } else if (hasData) {
      bodyLen = isExtended ? 1 + 2 + dataLen : 1 + dataLen;
    } else if (this.le !== null) {
      bodyLen = isExtended ? 1 + 2 : 1;
    }

    const bodyBuffer = new ArrayBuffer(bodyLen);
    const view = new DataView(bodyBuffer);
    let offset = 0;

    if (hasData && this.le !== null) {
      if (isExtended) {
        view.setUint8(offset++, 0x00);
        view.setUint16(offset, dataLen);
        offset += 2;
        new Uint8Array(bodyBuffer).set(this.data, offset);
        offset += dataLen;
        view.setUint16(offset, this.le);
      } else {
        view.setUint8(offset++, dataLen);
        new Uint8Array(bodyBuffer).set(this.data, offset);
        offset += dataLen;
        view.setUint8(offset, this.le);
      }
    } else if (hasData) {
      if (isExtended) {
        view.setUint8(offset++, 0x00);
        view.setUint16(offset, dataLen);
        offset += 2;
        new Uint8Array(bodyBuffer).set(this.data, offset);
      } else {
        view.setUint8(offset++, dataLen);
        new Uint8Array(bodyBuffer).set(this.data, offset);
      }
    } else if (this.le !== null) {
      if (isExtended) {
        view.setUint8(offset++, 0x00);
        view.setUint16(offset, this.le);
      } else {
        view.setUint8(offset, this.le);
      }
    }

    const apdu = new Uint8Array(header.length + bodyLen);
    apdu.set(header, 0);
    apdu.set(new Uint8Array(bodyBuffer), header.length);
    return apdu;
  }

  /**
   * Method to serialize CommandApdu to a hexadecimal string
   *
   * @returns Hexadecimal string of the APDU command
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
   * @returns Parsed CommandApdu instance
   */
  public static fromUint8Array(
    byteArray: Uint8Array<ArrayBuffer>,
  ): CommandApdu {
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
    let data: Uint8Array<ArrayBuffer> | null = null;
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
        le = (byteArray[index] << 8) | byteArray[index + 1];
        if (le === 0) {
          le = 65536;
        }
        return new CommandApdu(cla, ins, p1, p2, data, le);
      }
      throw new RangeError("Extended APDU structure is invalid.");
    }
  }

  /**
   * Method to return the APDU command as a human-readable hexadecimal string
   *
   * @returns Hexadecimal string of the APDU command
   */
  public toString(): string {
    return this.toHexString();
  }
}

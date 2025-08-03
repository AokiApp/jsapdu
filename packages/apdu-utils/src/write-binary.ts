import { CommandApdu, INS } from "@aokiapp/jsapdu-interface";
import { toUint8Array } from "./utils.js";

/**
 * Construct a WRITE BINARY command APDU (standard ISO-7816-4)
 * P1/P2 specify the offset; data bytes follow in the command body.
 *
 * @param offset  Offset in the file (0–65 535)
 * @param data    Data to write (Uint8Array | number[] | hex string)
 * @param isExtended  Use extended-length APDU (Lc > 255)
 * @param options  Addressing mode flags
 */
function writeBinary(
  offset: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
  isExtended = false,
  options?: {
    isCurrentEF?: boolean;      // P2 = 0x00   (current EF)
    shortEfId?: number;         // P1 = 0x80|id (short EF id addressing)
    useRelativeAddress15Bit?: boolean; // 15-bit relative addressing
    useRelativeAddress8Bit?: boolean;  // 8-bit relative addressing
  },
): CommandApdu {
  const payload = toUint8Array(data);

  if (
    (isExtended && (offset > 0xffff || payload.length > 0xffff)) ||
    (!isExtended && (offset > 0xffff || payload.length > 0xff))
  ) {
    throw new Error(
      `Offset or data length out of range for ${
        isExtended ? "extended" : "standard"
      } APDU.`,
    );
  }

  let p1 = (offset >>> 8) & 0xff;
  let p2 = offset & 0xff;

  if (options) {
    if (options.isCurrentEF) p2 = 0x00;
    if (options.shortEfId !== undefined) {
      if (options.shortEfId < 0 || options.shortEfId > 0x1f) {
        throw new Error("Invalid short EF identifier.");
      }
      p1 = 0x80 | (options.shortEfId & 0x1f);
      p2 = 0;
    }
    if (options.useRelativeAddress15Bit) {
      p1 = (offset >>> 8) & 0x7f;
    }
    if (options.useRelativeAddress8Bit) {
      p1 = 0x00;
      p2 = offset & 0xff;
    }
  }

  return new CommandApdu(0x00, INS.WRITE_BINARY, p1, p2, payload);
}

export { writeBinary };
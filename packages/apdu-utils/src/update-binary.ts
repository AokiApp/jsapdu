import { CommandApdu, INS } from "@aokiapp/jsapdu-interface";
import { toUint8Array } from "./utils.js";

/**
 * Construct an UPDATE BINARY command APDU
 * @param offset - Offset in the binary file
 * @param data - Data to write
 * @param isExtended - Whether to use extended APDU format
 * @param options - Additional options
 * @returns UPDATE BINARY command APDU
 */
function updateBinary(
  offset: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
  isExtended = false,
  options?: {
    isCurrentEF?: boolean;
    shortEfId?: number;
    useRelativeAddress15Bit?: boolean;
    useRelativeAddress8Bit?: boolean;
  },
): CommandApdu {
  const updateData = toUint8Array(data);
  
  if (
    (isExtended && (offset > 0xFFFF || updateData.length > 0xFFFF)) ||
    (!isExtended && (offset > 0xFFFF || updateData.length > 0xFF))
  ) {
    throw new Error(
      `Offset or data length is out of range for ${
        isExtended ? "extended" : "standard"
      } APDU.`,
    );
  }

  let p1 = (offset >>> 8) & 0xFF;
  let p2 = offset & 0xFF;

  if (options) {
    if (options.isCurrentEF) {
      p2 = 0x00;
    }
    if (options.shortEfId !== undefined) {
      if (options.shortEfId < 0 || options.shortEfId > 0x1F) {
        throw new Error("Invalid short EF identifier");
      }
      p1 = 0x80 | (options.shortEfId & 0x1F);
      p2 = 0;
    }
    if (options.useRelativeAddress15Bit) {
      p1 = (offset >>> 8) & 0x7F;
    }
    if (options.useRelativeAddress8Bit) {
      p1 = 0;
      p2 = offset & 0xFF;
    }
  }

  return new CommandApdu(0x00, INS.UPDATE_BINARY, p1, p2, updateData, null);
}

/**
 * Update binary data in the current EF
 * @param offset - Offset in the file
 * @param data - Data to write
 * @returns UPDATE BINARY command APDU
 */
function updateCurrentEfBinary(
  offset: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
): CommandApdu {
  return updateBinary(offset, data, false, { isCurrentEF: true });
}

/**
 * Update binary data in EF specified by short EF identifier
 * @param shortEfId - Short EF identifier (0-31)
 * @param offset - Offset in the file
 * @param data - Data to write
 * @returns UPDATE BINARY command APDU
 */
function updateEfBinary(
  shortEfId: number,
  offset: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
): CommandApdu {
  return updateBinary(offset, data, false, { shortEfId });
}

export { updateBinary, updateCurrentEfBinary, updateEfBinary };
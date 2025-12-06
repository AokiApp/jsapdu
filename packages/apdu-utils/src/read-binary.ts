import { CommandApdu, INS } from "@aokiapp/jsapdu-interface";

function readBinary(
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
      p1 = 0x80 | (options.shortEfId & 0x1f);
      p2 = 0;
    }
    if (options.useRelativeAddress15Bit) {
      p1 = (offset >>> 8) & 0x7f;
    }
    if (options.useRelativeAddress8Bit) {
      p1 = 0;
      p2 = offset & 0xff;
    }
  }

  return new CommandApdu(0x00, INS.READ_BINARY, p1, p2, null, leValue);
}

function readEfBinaryFull(shortEfId: number): CommandApdu {
  if (shortEfId < 0 || shortEfId > 0x1f) {
    throw new Error("Invalid short EF identifier.");
  }
  const p1 = 0x80 | shortEfId;
  return new CommandApdu(0x00, INS.READ_BINARY, p1, 0x00, null, 65536);
}

function readCurrentEfBinaryFull(): CommandApdu {
  return new CommandApdu(0x00, INS.READ_BINARY, 0x00, 0x00, null, 65536);
}

export { readBinary, readCurrentEfBinaryFull, readEfBinaryFull };

import { CommandApdu, INS } from "@aokiapp/jsapdu-interface";

/**
 * Construct a MANAGE CHANNEL command APDU
 *
 * ISO 7816-4 §11.1
 *   P1 = 0x00  -> OPEN (allocate new logical channel)
 *        0x80  -> CLOSE (close provided channel number)
 *   P2 = desired logical channel number (0 = let card choose)
 *
 * For OPEN, Le is usually 1 to receive the allocated channel number.
 * For CLOSE, no Le is required.
 */

/** Open a new logical channel. Le defaults to 1 to return channel number. */
function openLogicalChannel(p2 = 0x00, le = 1): CommandApdu {
  if (p2 > 0x13) throw new Error("Invalid channel number (0–19)");
  return new CommandApdu(0x00, INS.MANAGE_CHANNEL, 0x00, p2, null, le);
}

/** Close an existing logical channel. */
function closeLogicalChannel(channelNumber: number): CommandApdu {
  if (channelNumber < 1 || channelNumber > 0x13) {
    throw new Error("Channel number must be 1–19");
  }
  return new CommandApdu(0x00, INS.MANAGE_CHANNEL, 0x80, channelNumber & 0xff);
}

export { openLogicalChannel, closeLogicalChannel };
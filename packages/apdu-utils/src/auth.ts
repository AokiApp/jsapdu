import { CommandApdu, INS } from "@aokiapp/jsapdu-interface";
import { toUint8Array } from "./utils.js";

/**
 * Build a GET CHALLENGE APDU
 * @param le  expected length of challenge (default 8)
 */
function getChallenge(le = 8): CommandApdu {
  if (le <= 0 || le > 0xff) throw new Error("Le must be 1–255 bytes");
  return new CommandApdu(0x00, INS.GET_CHALLENGE, 0x00, 0x00, null, le);
}

/**
 * Build an EXTERNAL AUTHENTICATE APDU
 * @param keyId  key reference (P2)
 * @param data   authentication data
 * @param algo   algorithm indicator (P1) – default 0x00 (proprietary)
 */
function externalAuthenticate(
  keyId: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
  algo = 0x00,
): CommandApdu {
  if (keyId < 0 || keyId > 0xff) throw new Error("Invalid key reference");
  const payload = toUint8Array(data);
  return new CommandApdu(0x00, INS.EXTERNAL_AUTHENTICATE, algo & 0xff, keyId & 0xff, payload);
}

/**
 * Build an INTERNAL AUTHENTICATE APDU
 * @param data  authentication data (host cryptogram etc.)
 * @param algo  algorithm indicator (P1) – default 0x00
 */
function internalAuthenticate(
  data: Uint8Array<ArrayBuffer> | number[] | string,
  algo = 0x00,
): CommandApdu {
  const payload = toUint8Array(data);
  return new CommandApdu(0x00, INS.INTERNAL_AUTHENTICATE, algo & 0xff, 0x00, payload);
}

export { getChallenge, externalAuthenticate, internalAuthenticate };
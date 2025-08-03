import { CommandApdu, INS } from "@aokiapp/jsapdu-interface";

/**
 * Construct a GET DATA command APDU
 * @param p1 - Parameter 1
 * @param p2 - Parameter 2  
 * @param le - Expected length of response data
 * @returns GET DATA command APDU
 */
function getData(p1: number, p2: number, le?: number): CommandApdu {
  if (p1 > 0xFF || p2 > 0xFF) {
    throw new Error("P1 and P2 must be single bytes (0x00-0xFF)");
  }
  
  const leValue = le !== undefined ? le : 0x00;
  return new CommandApdu(0x00, INS.GET_DATA, p1, p2, null, leValue);
}

/**
 * Get data using BER-TLV tag
 * @param tag - BER-TLV tag (2 bytes)
 * @param le - Expected length of response data
 * @returns GET DATA command APDU
 */
function getDataBerTlv(tag: number, le?: number): CommandApdu {
  if (tag > 0xFFFF) {
    throw new Error("BER-TLV tag must be 2 bytes (0x0000-0xFFFF)");
  }
  
  const p1 = (tag >> 8) & 0xFF;
  const p2 = tag & 0xFF;
  return getData(p1, p2, le);
}

/**
 * Get data using simple TLV tag
 * @param tag - Simple TLV tag (1 byte)
 * @param le - Expected length of response data
 * @returns GET DATA command APDU
 */
function getDataSimpleTlv(tag: number, le?: number): CommandApdu {
  if (tag > 0xFF) {
    throw new Error("Simple TLV tag must be 1 byte (0x00-0xFF)");
  }
  
  return getData(0x00, tag, le);
}

export { getData, getDataBerTlv, getDataSimpleTlv };
import { CommandApdu, INS } from "@aokiapp/jsapdu-interface";
import { toUint8Array } from "./utils.js";

/* ------------------------------------------------------------------
 * ISO-7816-4 RECORD-ORIENTED APDU HELPERS
 * ------------------------------------------------------------------
 *  READ RECORD    (0xB2)
 *  WRITE RECORD   (0xD2)
 *  UPDATE RECORD  (0xDC)
 *  APPEND RECORD  (0xE2)
 *
 *  P1  = record number (1-255, or 0 for “current/next” depending on mode)
 *  P2  = (SFI << 3) | refMode
 *           refMode 0b100 = absolute SFI   (most common)
 *                    0b010 = next record
 *                    0b001 = previous record
 *  Le / Lc follow usual rules.
 * -----------------------------------------------------------------*/

/** Reference mode bits for READ/WRITE/UPDATE/APPEND RECORD P2 */
export enum RecordRefMode {
  ABSOLUTE = 0x04,
  NEXT = 0x02,
  PREVIOUS = 0x03,
}

/**
 * Build a READ RECORD APDU
 * @param recordNo  Record number (1–255, 0 for current)
 * @param sfi       Short File Identifier (0–31)
 * @param le        Expected length (defaults to 0 = maximal)
 * @param mode      Reference mode (absolute / next / previous)
 */
function readRecord(
  recordNo: number,
  sfi: number,
  le = 0x00,
  mode: RecordRefMode = RecordRefMode.ABSOLUTE,
): CommandApdu {
  if (sfi < 0 || sfi > 0x1f) throw new Error("Invalid SFI (0-31)");
  if (recordNo < 0 || recordNo > 0xff) throw new Error("Invalid record number");

  const p1 = recordNo & 0xff;
  const p2 = ((sfi & 0x1f) << 3) | (mode & 0x07);
  return new CommandApdu(0x00, INS.READ_RECORD, p1, p2, null, le);
}

/**
 * Build a WRITE RECORD APDU (create or overwrite)
 */
function writeRecord(
  recordNo: number,
  sfi: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
  mode: RecordRefMode = RecordRefMode.ABSOLUTE,
): CommandApdu {
  const payload = toUint8Array(data);
  if (payload.length === 0) throw new Error("Write payload must not be empty");
  if (sfi < 0 || sfi > 0x1f) throw new Error("Invalid SFI (0-31)");
  if (recordNo < 0 || recordNo > 0xff) throw new Error("Invalid record number");

  const p1 = recordNo & 0xff;
  const p2 = ((sfi & 0x1f) << 3) | (mode & 0x07);
  return new CommandApdu(0x00, INS.WRITE_RECORD, p1, p2, payload);
}

/**
 * Build an UPDATE RECORD APDU (modify existing record)
 */
function updateRecord(
  recordNo: number,
  sfi: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
  mode: RecordRefMode = RecordRefMode.ABSOLUTE,
): CommandApdu {
  const payload = toUint8Array(data);
  if (sfi < 0 || sfi > 0x1f) throw new Error("Invalid SFI (0-31)");
  if (recordNo < 0 || recordNo > 0xff) throw new Error("Invalid record number");

  const p1 = recordNo & 0xff;
  const p2 = ((sfi & 0x1f) << 3) | (mode & 0x07);
  return new CommandApdu(0x00, INS.UPDATE_RECORD, p1, p2, payload);
}

/**
 * Build an APPEND RECORD APDU (add new record at end of EF)
 * P1 shall be 0x00, P2 = (SFI<<3)|0x02 per ISO-7816-4 §7.5.6
 */
function appendRecord(
  sfi: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
): CommandApdu {
  const payload = toUint8Array(data);
  if (sfi < 0 || sfi > 0x1f) throw new Error("Invalid SFI (0-31)");
  const p1 = 0x00;
  const p2 = ((sfi & 0x1f) << 3) | 0x02;
  return new CommandApdu(0x00, INS.APPEND_RECORD, p1, p2, payload);
}

export { readRecord, writeRecord, updateRecord, appendRecord };
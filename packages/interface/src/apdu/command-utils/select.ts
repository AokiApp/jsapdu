import { INS } from "../../constants";
import { toUint8Array } from "../../utils";
import { CommandApdu } from "../command-apdu";

function select(
  p1: number,
  p2: number,
  data: Uint8Array<ArrayBuffer> | number[] | string,
  le: number | null = null,
): CommandApdu {
  if ((p2 & 0x0c) === 0x0c && le !== null) {
    throw new Error("Invalid P2 and Le combination for SELECT.");
  }
  return new CommandApdu(0x00, INS.SELECT, p1, p2, toUint8Array(data), le);
}

function selectDf(
  data: Uint8Array<ArrayBuffer> | number[] | string,
  fciRequested = false,
): CommandApdu {
  const dfData = toUint8Array(data);
  if (dfData.length < 1 || dfData.length > 16) {
    throw new Error("Invalid DF identifier.");
  }
  return fciRequested
    ? select(0x04, 0x00, dfData, 0x00)
    : select(0x04, 0x0c, dfData, null);
}

function selectEf(
  data: Uint8Array<ArrayBuffer> | number[] | string,
): CommandApdu {
  const efData = toUint8Array(data);
  if (efData.length !== 2) {
    throw new Error("Invalid EF identifier.");
  }
  return select(0x02, 0x0c, efData, null);
}

export { select, selectDf, selectEf };

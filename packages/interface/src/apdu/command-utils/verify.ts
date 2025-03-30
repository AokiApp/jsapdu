import { toUint8Array } from "../../utils.js";
import { CommandApdu } from "../command-apdu.js";

/**
 * Construct a VERIFY command APDU
 * @param data - PIN data (1 to 16 bytes)
 * @param options - Options for VERIFY command
 * @returns VERIFY command APDU
 * @throws If EF identifier is invalid or if PIN data string is not numeric
 */
function verify(
  data: Uint8Array<ArrayBuffer> | number[] | string,
  options: {
    ef?: number | string;
    isCurrent?: boolean;
  },
): CommandApdu {
  let p2 = 0x80; // デフォルトはカレントDF用
  let ef = 0x00;

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

  let pinData: Uint8Array<ArrayBuffer>;
  if (typeof data === "string") {
    pinData = Uint8Array.from(
      data.split("").map((digit) => digit.charCodeAt(0)),
    );
  } else {
    pinData = toUint8Array(data);
  }

  return new CommandApdu(0x00, 0x20, 0x00, p2, pinData);
}

export { verify };

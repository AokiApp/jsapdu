import { readEfBinaryFull, selectDf, verify } from "@aokiapp/apdu-utils";
import { SmartCardDevice, SmartCardPlatform } from "@aokiapp/jsapdu-interface";
import {
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaKenkakuEntries,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv/parser";

import { KenkakuEntriesParsed } from "../types.js";
import { askPassword, getPlatform } from "../utils.js";

async function main() {
  let platform: SmartCardPlatform | undefined;
  let device: SmartCardDevice | undefined;
  try {
    platform = await getPlatform();
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].id);
    const session = await device.startSession();

    const selectResponse = await session.transmit(selectDf(KENKAKU_AP));

    if (selectResponse.sw1 !== 0x90 || selectResponse.sw2 !== 0x00) {
      throw new Error("Failed to select DF");
    }

    const pin = await askPassword("Enter PIN-A: ");

    const verifyResponse = await session.transmit(
      verify(pin, { ef: KENKAKU_AP_EF.PIN_A }),
    );

    if (verifyResponse.sw1 !== 0x90 || verifyResponse.sw2 !== 0x00) {
      throw new Error("PIN verification failed");
    }

    const readBinaryResponse = await session.transmit(
      readEfBinaryFull(KENKAKU_AP_EF.ENTRIES),
    );

    if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
      throw new Error("Failed to read binary");
    }

    const buffer = readBinaryResponse.arrayBuffer();
    const parser = new SchemaParser(schemaKenkakuEntries);
    const parsed = parser.parse(buffer) as KenkakuEntriesParsed;

    const digest_1 = await crypto.subtle.digest(
      "SHA-256",
      buffer.slice(parsed.offsets[0], parsed.offsets[2]),
    );
    const digest_2 = await crypto.subtle.digest(
      "SHA-256",
      buffer.slice(parsed.offsets[3], parsed.offsets[4]),
    );
    const digest_3 = await crypto.subtle.digest(
      "SHA-256",
      buffer.slice(parsed.offsets[5], parsed.offsets[5]),
    );
    const digest = new ArrayBuffer(32 * 3);
    new Uint8Array(digest).set(new Uint8Array(digest_1), 0);
    new Uint8Array(digest).set(new Uint8Array(digest_2), 32);
    new Uint8Array(digest).set(new Uint8Array(digest_3), 64);

    console.log(parsed);
    console.log(digest);
  } catch (error) {
    console.error("error:", error);
  } finally {
    await device?.release();
    await platform?.release();
  }
}

await main();

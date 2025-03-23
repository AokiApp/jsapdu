import { readEfBinaryFull, selectDf, verify } from "@aokiapp/interface";
import {
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaKenkakuEntries,
} from "@aokiapp/mynacard";
import { PcscPlatformManager } from "@aokiapp/pcsc";
import { SchemaParser } from "@aokiapp/tlv-parser";

import { askPassword } from "../utils.js";

async function main() {
  try {
    const manager = new PcscPlatformManager();
    const platform = manager.getPlatform();
    await platform.init();
    const devices = await platform.getDevices();
    const device = await devices[0].acquireDevice();
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
    const parsed = await parser.parse(buffer, { async: true });

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

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

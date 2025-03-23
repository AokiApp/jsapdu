import { readEfBinaryFull, selectDf, verify } from "@aokiapp/interface";
import {
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaKenkakuMyNumber,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv-parser";

import { askPassword, getPlatform } from "../utils.js";

async function main() {
  try {
    const platform = await getPlatform();
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
      readEfBinaryFull(KENKAKU_AP_EF.MY_NUMBER),
    );

    if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
      throw new Error("Failed to read binary");
    }

    const buffer = readBinaryResponse.arrayBuffer();
    const parser = new SchemaParser(schemaKenkakuMyNumber);
    const parsed = await parser.parse(buffer, { async: true });

    console.log(parsed);
    console.log(parsed.publicKey.algorithm);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

await main();

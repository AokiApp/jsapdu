import { readEfBinaryFull, selectDf, verify } from "@aokiapp/apdu-utils";
import { SmartCardDevice, SmartCardPlatform } from "@aokiapp/jsapdu-interface";
import {
  decodePublicKey,
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaKenkakuMyNumber,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv/parser";

import { KenkakuMyNumberParsed } from "../types.js";
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
      readEfBinaryFull(KENKAKU_AP_EF.MY_NUMBER),
    );

    if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
      throw new Error("Failed to read binary");
    }

    const buffer = readBinaryResponse.arrayBuffer();
    const parser = new SchemaParser(schemaKenkakuMyNumber);
    const parsed = parser.parse(buffer) as KenkakuMyNumberParsed;

    console.log(parsed);

    // The publicKeyRaw is now a raw ArrayBuffer. To get a CryptoKey, use decodePublicKey:
    const publicKey = await decodePublicKey(parsed.publicKeyRaw);
    console.log("Public key algorithm:", publicKey.algorithm);
  } catch (error) {
    console.error("error:", error);
  } finally {
    await device?.release();
    await platform?.release();
  }
}

await main();

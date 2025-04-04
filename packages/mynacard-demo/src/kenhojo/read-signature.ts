import { readEfBinaryFull, selectDf, verify } from "@aokiapp/apdu-utils";
import { SmartCardDevice, SmartCardPlatform } from "@aokiapp/interface";
import {
  KENHOJO_AP,
  KENHOJO_AP_EF,
  schemaKenhojoSignature,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv-parser";

import { askPassword, getPlatform, uint8ArrayToHexString } from "../utils.js";

async function main() {
  let platform: SmartCardPlatform | undefined;
  let device: SmartCardDevice | undefined;
  try {
    platform = await getPlatform();
    await platform.init();
    const devices = await platform.getDevices();
    device = await devices[0].acquireDevice();
    const session = await device.startSession();

    const selectResponse = await session.transmit(selectDf(KENHOJO_AP));

    if (selectResponse.sw1 !== 0x90 || selectResponse.sw2 !== 0x00) {
      throw new Error("Failed to select DF");
    }

    const pin = await askPassword("Enter PIN: ");

    const verifyResponse = await session.transmit(
      verify(pin, { ef: KENHOJO_AP_EF.PIN }),
    );

    if (verifyResponse.sw1 !== 0x90 || verifyResponse.sw2 !== 0x00) {
      throw new Error("PIN verification failed");
    }

    const readBinaryResponse = await session.transmit(
      readEfBinaryFull(KENHOJO_AP_EF.SIGNATURE),
    );

    if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
      throw new Error("Failed to read binary");
    }

    const buffer = readBinaryResponse.arrayBuffer();
    const parser = new SchemaParser(schemaKenhojoSignature);
    const parsed = parser.parse(buffer);

    console.log(
      "Kenhojo My Number Hash:",
      uint8ArrayToHexString(parsed.kenhojoMyNumberHash),
    );
    console.log(
      "Kenhojo Basic Four Hash:",
      uint8ArrayToHexString(parsed.kenhojoBasicFourHash),
    );

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  } finally {
    await device?.release();
    await platform?.release();
  }
}

await main();

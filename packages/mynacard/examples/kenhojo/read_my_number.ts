import { readEfBinaryFull, selectDf, verify } from "@aokiapp/interface";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard";
import { PcscPlatformManager } from "@aokiapp/pcsc";
import { BasicTLVParser } from "@aokiapp/tlv-parser";

import { askPassword } from "../utils";

async function main() {
  try {
    const manager = new PcscPlatformManager();
    const platform = manager.getPlatform();
    await platform.init();
    const devices = await platform.getDevices();
    const device = await devices[0].acquireDevice();
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
      readEfBinaryFull(KENHOJO_AP_EF.MY_NUMBER),
    );

    if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
      throw new Error("Failed to read binary");
    }

    const parsed = BasicTLVParser.parse(readBinaryResponse.data.buffer);

    console.log(parsed.value);

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      readBinaryResponse.data.buffer,
    );
    console.log(new Uint8Array(hashBuffer));

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

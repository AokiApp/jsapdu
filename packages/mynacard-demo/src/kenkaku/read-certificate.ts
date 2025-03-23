import { readEfBinaryFull, selectDf } from "@aokiapp/interface";
import {
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaCertificate,
} from "@aokiapp/mynacard";
import { PcscPlatformManager } from "@aokiapp/pcsc";
import { SchemaParser } from "@aokiapp/tlv-parser";

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

    const readBinaryResponse = await session.transmit(
      readEfBinaryFull(KENKAKU_AP_EF.CERTIFICATE),
    );

    if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
      throw new Error("Failed to read binary");
    }

    const buffer = readBinaryResponse.arrayBuffer();
    const parser = new SchemaParser(schemaCertificate);
    const parsed = await parser.parse(buffer, { async: true });

    console.log(parsed);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

await main();

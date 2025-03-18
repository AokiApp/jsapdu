import { readEfBinaryFull, selectDf } from "@aokiapp/interface/apdu";
import { KENKAKU_AP, KENKAKU_AP_EF } from "@aokiapp/mynacard/constant";
import { PcscPlatformManager } from "@aokiapp/pcsc";
import { TLVParser } from "@aokiapp/tlv-parser/tlv";
import { schemaCertificate } from "@aokiapp/mynacard/schema";

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

    const parser = new TLVParser(schemaCertificate);
    const parsed = await parser.parse(readBinaryResponse.data);

    console.log(parsed);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

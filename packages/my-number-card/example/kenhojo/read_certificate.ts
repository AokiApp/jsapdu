import { readEfBinaryFull, selectDf } from "@aokiapp/interface/apdu";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/interface/constant";
import { PcscPlatformManager } from "@aokiapp/interface/pcsc";
import { TLVParser } from "@aokiapp/interface/tlv";
import { schemaCertificate } from "../../schema";

async function main() {
  try {
    const manager = new PcscPlatformManager();
    const platform = manager.getPlatform();
    await platform.init();
    const devices = await platform.getDevices();
    const device = await devices[0].acquireDevice();
    const session = await device.startSession();

    await session.transmit(selectDf(KENHOJO_AP).toUint8Array());

    const res = await session.transmit(
      readEfBinaryFull(KENHOJO_AP_EF.CERTIFICATE).toUint8Array(),
    );

    const parser = new TLVParser(schemaCertificate);
    const parsed = await parser.parse(res);

    console.log(parsed.contents);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

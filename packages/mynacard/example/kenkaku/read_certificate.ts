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

    await session.transmit(selectDf(KENKAKU_AP).toUint8Array());

    const res = await session.transmit(
      readEfBinaryFull(KENKAKU_AP_EF.CERTIFICATE).toUint8Array(),
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

import { readEfBinaryFull, selectDf, verify } from "@aokiapp/interface/apdu";
import { KENKAKU_AP, KENKAKU_AP_EF } from "@aokiapp/interface/constant";
import { PcscPlatformManager } from "@aokiapp/interface/pcsc";
import { TLVParser } from "@aokiapp/interface/tlv";
import { schemaKenkakuEntries } from "../../schema";
import { askPassword } from "@aokiapp/interface/utils";

async function main() {
  try {
    const manager = new PcscPlatformManager();
    const platform = manager.getPlatform();
    await platform.init();
    const devices = await platform.getDevices();
    const device = await devices[0].acquireDevice();
    const session = await device.startSession();

    await session.transmit(selectDf(KENKAKU_AP).toUint8Array());

    const pin = await askPassword("Enter PIN-A: ");

    const verifyResponse = await session.transmit(
      verify(pin, {
        ef: KENKAKU_AP_EF.PIN_A,
      }).toUint8Array(),
    );
    console.log(verifyResponse);

    const res = await session.transmit(
      readEfBinaryFull(KENKAKU_AP_EF.ENTRIES).toUint8Array(),
    );

    const parser = new TLVParser(schemaKenkakuEntries);
    const parsed = await parser.parse(res);

    console.log(parsed);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

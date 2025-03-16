import { readEfBinaryFull, selectDf, verify } from "@aokiapp/interface/apdu";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/interface/constant";
import { PcscPlatformManager } from "@aokiapp/interface/pcsc";
import { askPassword } from "@aokiapp/interface/utils";
import { schemaKenhojoMyNumber } from "../../schema";
import { TLVParser } from "@aokiapp/interface/tlv";

async function main() {
  try {
    const manager = new PcscPlatformManager();
    const platform = manager.getPlatform();
    await platform.init();
    const devices = await platform.getDevices();
    const device = await devices[0].acquireDevice();
    const session = await device.startSession();

    await session.transmit(selectDf(KENHOJO_AP).toUint8Array());

    const pin = await askPassword("Enter PIN: ");

    const verifyResponse = await session.transmit(
      verify(pin, {
        ef: KENHOJO_AP_EF.PIN,
      }).toUint8Array(),
    );
    console.log(verifyResponse);

    const res = await session.transmit(
      readEfBinaryFull(KENHOJO_AP_EF.MY_NUMBER).toUint8Array(),
    );

    const parser = new TLVParser(schemaKenhojoMyNumber);
    const parsed = await parser.parse(res);

    console.log(parsed);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

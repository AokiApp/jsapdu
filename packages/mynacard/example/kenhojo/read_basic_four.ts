import { readEfBinaryFull, selectDf, verify } from "@aokiapp/interface/apdu";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard/constant";
import { schemaKenhojoBasicFour } from "@aokiapp/mynacard/schema";
import { PcscPlatformManager } from "@aokiapp/pcsc";
import { TLVParser } from "@aokiapp/tlv-parser/tlv";
import { askPassword } from "@aokiapp/mynacard/utils";

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
      readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
    );

    if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
      throw new Error("Failed to read binary");
    }

    const parser = new TLVParser(schemaKenhojoBasicFour);
    const parsed = await parser.parse(readBinaryResponse.data);

    console.log(parsed);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

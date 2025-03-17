import { readEfBinaryFull, selectDf, verify } from "@aokiapp/interface/apdu";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard/constant";
import { schemaKenhojoSignature } from "@aokiapp/mynacard/schema";
import { PcscPlatformManager } from "@aokiapp/pcsc";
import { askPassword } from "@aokiapp/mynacard/utils";
import { TLVParser } from "@aokiapp/tlv-parser/tlv";

async function main() {
  try {
    const manager = new PcscPlatformManager();
    const platform = manager.getPlatform();
    await platform.init();
    const devices = await platform.getDevices();
    const device = await devices[0].acquireDevice();
    const session = await device.startSession();

    const selectResponse = await session.transmit(
      selectDf(KENHOJO_AP).toUint8Array(),
    );
    console.log(selectResponse);

    const pin = await askPassword("Enter PIN: ");

    const verifyResponse = await session.transmit(
      verify(pin, {
        ef: KENHOJO_AP_EF.PIN,
      }).toUint8Array(),
    );
    console.log(verifyResponse);

    const res = await session.transmit(
      readEfBinaryFull(KENHOJO_AP_EF.SIGNATURE).toUint8Array(),
    );

    const parser = new TLVParser(schemaKenhojoSignature);
    const parsed = await parser.parse(res);

    console.log(parsed.kenhojoAttributesSignature);

    await device.release();
    await platform.release();
  } catch (error) {
    console.error("error:", error);
  }
}

main();

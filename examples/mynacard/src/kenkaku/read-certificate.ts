import { readEfBinaryFull, selectDf, verify } from "@aokiapp/apdu-utils";
import {
  SmartCard,
  SmartCardDevice,
  SmartCardPlatform,
} from "@aokiapp/jsapdu-interface";
import {
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaCertificate,
  schemaKenkakuBirth,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv/parser";

import { askPassword, getPlatform } from "../utils.js";

async function readBirth(session: SmartCard) {
  const readBinaryResponse = await session.transmit(
    readEfBinaryFull(KENKAKU_AP_EF.BIRTH),
  );

  if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
    throw new Error("Failed to read binary");
  }

  const buffer = readBinaryResponse.arrayBuffer();
  const parser = new SchemaParser(schemaKenkakuBirth);
  const parsed = await parser.parse(buffer, { async: true });

  console.log(parsed);

  return parsed;
}

async function readIntermediateCertificate(session: SmartCard) {
  const readBinaryResponse = await session.transmit(
    readEfBinaryFull(KENKAKU_AP_EF.INTERMEDIATE_CERTIFICATE),
  );

  if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
    throw new Error("Failed to read binary");
  }

  const buffer = readBinaryResponse.arrayBuffer();
  const parser = new SchemaParser(schemaCertificate);
  const parsed = await parser.parse(buffer, { async: true });

  console.log(parsed);

  return parsed;
}

async function main() {
  let platform: SmartCardPlatform | undefined;
  let device: SmartCardDevice | undefined;
  try {
    platform = await getPlatform();
    await platform.init();
    const deviceInfo = await platform.getDeviceInfo();
    const device = await platform.acquireDevice(deviceInfo[0].id);
    const session = await device.startSession();

    const selectResponse = await session.transmit(selectDf(KENKAKU_AP));

    if (selectResponse.sw1 !== 0x90 || selectResponse.sw2 !== 0x00) {
      throw new Error("Failed to select DF");
    }

    const pin = await askPassword("Enter BIRTH-PIN: ");

    const verifyResponse = await session.transmit(
      verify(pin, { ef: KENKAKU_AP_EF.BIRTH_PIN }),
    );

    if (verifyResponse.sw1 !== 0x90 || verifyResponse.sw2 !== 0x00) {
      throw new Error("PIN verification failed");
    }

    await readIntermediateCertificate(session);
    await readBirth(session);
  } catch (error) {
    console.error("error:", error);
  } finally {
    await device?.release();
    await platform?.release();
  }
}

await main();

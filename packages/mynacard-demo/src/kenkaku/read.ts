import { readEfBinaryFull, selectDf, verify } from "@aokiapp/apdu-utils";
import {
  SmartCard,
  SmartCardDevice,
  SmartCardPlatform,
} from "@aokiapp/interface";
import {
  KENKAKU_AP,
  KENKAKU_AP_EF,
  schemaCertificate,
  schemaKenkakuEntries,
  schemaKenkakuMyNumber,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv-parser";

import { arrayBufferToBase64, askPassword, getPlatform } from "../utils.js";

async function readEntries(session: SmartCard) {
  const readBinaryResponse = await session.transmit(
    readEfBinaryFull(KENKAKU_AP_EF.ENTRIES),
  );

  if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
    throw new Error("Failed to read binary");
  }

  const buffer = readBinaryResponse.arrayBuffer();
  const parser = new SchemaParser(schemaKenkakuEntries);
  const parsed = await parser.parse(buffer, { async: true });

  const offsets = [
    [parsed.offsets[0], parsed.offsets[2]],
    [parsed.offsets[3], parsed.offsets[4]],
    [parsed.offsets[5], parsed.offsets[5]],
  ];
  const digest = new ArrayBuffer(32 * offsets.length);
  const digestView = new Uint8Array(digest);

  for (let i = 0; i < offsets.length; i++) {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      buffer.slice(offsets[i][0], offsets[i][1]),
    );
    digestView.set(new Uint8Array(hash), i * 32);
  }

  console.log("Birth:", parsed.birth);
  console.log("Gender:", parsed.gender);
  const nameBase64 = arrayBufferToBase64(parsed.namePng.buffer);
  console.log(`Name: data:image/png;base64,${nameBase64}`);
  const addressBase64 = arrayBufferToBase64(parsed.addressPng.buffer);
  console.log(`Address: data:image/png;base64,${addressBase64}`);
  const faceBase64 = arrayBufferToBase64(parsed.faceJp2.buffer);
  console.log(`Face: data:image/jp2;base64,${faceBase64}`);
  console.log("Expire:", parsed.expire);
  const securityCodeBase64 = arrayBufferToBase64(parsed.securityCodePng.buffer);
  console.log(`Security Code: data:image/png;base64,${securityCodeBase64}`);

  console.log(digest);

  return parsed;
}

async function readCertificate(session: SmartCard) {
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

async function readMyNumber(session: SmartCard) {
  const readBinaryResponse = await session.transmit(
    readEfBinaryFull(KENKAKU_AP_EF.MY_NUMBER),
  );

  if (readBinaryResponse.sw1 !== 0x90 || readBinaryResponse.sw2 !== 0x00) {
    throw new Error("Failed to read binary");
  }

  const buffer = readBinaryResponse.arrayBuffer();
  const parser = new SchemaParser(schemaKenkakuMyNumber);
  const parsed = await parser.parse(buffer, { async: true });

  console.log(parsed);

  const myNumberBase64 = arrayBufferToBase64(parsed.myNumberPng.buffer);
  console.log(`My Number: data:image/png;base64,${myNumberBase64}`);

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

    const pin = await askPassword("Enter PIN-A: ");

    const verifyResponse = await session.transmit(
      verify(pin, { ef: KENKAKU_AP_EF.PIN_A }),
    );

    if (verifyResponse.sw1 !== 0x90 || verifyResponse.sw2 !== 0x00) {
      throw new Error("PIN verification failed");
    }

    console.log("/** begin certificate **/");
    await readCertificate(session);
    console.log("/** end certificate **/");

    console.log("/** begin entries **/");
    await readEntries(session);
    console.log("/** end entries **/");

    console.log("/** begin my number **/");
    await readMyNumber(session);
    console.log("/** end my number **/");

    console.log("/** done **/");
  } catch (error) {
    console.error("error:", error);
  } finally {
    await device?.release();
    await platform?.release();
  }
}

await main();

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CommandApdu,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
} from "@aokiapp/jsapdu-interface";
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";

let platform: SmartCardPlatform;
let device: SmartCardDevice | null;
let card: SmartCard | null;
let deviceInfos: SmartCardDeviceInfo[] = [];

beforeEach(async () => {
  const platformManager = PcscPlatformManager.getInstance();
  platform = platformManager.getPlatform();
  await platform.init();
  deviceInfos = await platform.getDeviceInfo();
  device = null;
  card = null;
});

afterEach(async () => {
  if (card) await card.release().catch(() => {});
  if (device) await device.release().catch(() => {});
  if (platform) await platform.release().catch(() => {});
});

describe("マイナンバーカード E2Eテスト（独立型）", () => {
  it("リーダーが1つ以上取得できる", () => {
    expect(deviceInfos.length, "リーダーが見つかりません").toBeGreaterThan(0);
  });

  it("カードリーダーが取得できる", async () => {
    if (deviceInfos.length === 0) return;
    let acquired = false;
    const errorMsgs: string[] = [];
    for (let i = 0; i < deviceInfos.length; i++) {
      try {
        device = await platform.acquireDevice(deviceInfos[i].id);
        acquired = true;
        break;
      } catch (e) {
        const errMsg =
          e && typeof e === "object" && "message" in e
            ? `[${deviceInfos[i].id}] ${(e as Error).message}`
            : `[${deviceInfos[i].id}] ${String(e)}`;
        errorMsgs.push(errMsg);
      }
    }
    if (!acquired && errorMsgs.length > 0) {
      expect.fail("どのリーダーもacquireできません:\n" + errorMsgs.join("\n"));
    }
    expect(acquired, "どのリーダーもacquireできません").toBe(true);
  });

  it("カードが挿入されている", async () => {
    if (deviceInfos.length === 0) return;
    const errorMsgs: string[] = [];
    for (let i = 0; i < deviceInfos.length; i++) {
      try {
        device = await platform.acquireDevice(deviceInfos[i].id);
        const isCardPresent = await device.isCardPresent();
        if (isCardPresent) {
          expect(isCardPresent).toBe(true);
          return;
        }
      } catch (e) {
        const errMsg =
          e && typeof e === "object" && "message" in e
            ? `[${deviceInfos[i].id}] ${(e as Error).message}`
            : `[${deviceInfos[i].id}] ${String(e)}`;
        errorMsgs.push(errMsg);
      }
    }
    if (errorMsgs.length > 0) {
      expect.fail(
        "どのリーダーにもカードが挿入されていません:\n" + errorMsgs.join("\n"),
      );
    } else {
      expect.fail("どのリーダーにもカードが挿入されていません");
    }
  });

  it("ATRが取得できる", async () => {
    if (deviceInfos.length === 0) return;
    const errorMsgs: string[] = [];
    for (let i = 0; i < deviceInfos.length; i++) {
      try {
        device = await platform.acquireDevice(deviceInfos[i].id);
        const isCardPresent = await device.isCardPresent();
        if (!isCardPresent) continue;
        card = await device.startSession();
        const atr = await card.getAtr();
        expect(atr.length, "ATR長が0").toBeGreaterThan(0);
        return;
      } catch (e) {
        const errMsg =
          e && typeof e === "object" && "message" in e
            ? `[${deviceInfos[i].id}] ${(e as Error).message}`
            : `[${deviceInfos[i].id}] ${String(e)}`;
        errorMsgs.push(errMsg);
      }
    }
    if (errorMsgs.length > 0) {
      expect.fail("ATRが取得できませんでした:\n" + errorMsgs.join("\n"));
    } else {
      expect.fail("ATRが取得できませんでした");
    }
  });

  it("SELECT FILEのレスポンスが取得できる", async () => {
    if (deviceInfos.length === 0) return;
    const errorMsgs: string[] = [];
    for (let i = 0; i < deviceInfos.length; i++) {
      try {
        device = await platform.acquireDevice(deviceInfos[i].id);
        const isCardPresent = await device.isCardPresent();
        if (!isCardPresent) continue;
        card = await device.startSession();
        const selectApdu = new CommandApdu(
          0x00,
          0xa4,
          0x04,
          0x00,
          Uint8Array.from([0xa0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00]),
          null,
        );
        const selectResp = await card.transmit(selectApdu);
        expect(selectResp.sw1, "sw1がnumber型でない").toBeTypeOf("number");
        expect(selectResp.sw2, "sw2がnumber型でない").toBeTypeOf("number");
        return;
      } catch (e) {
        const errMsg =
          e && typeof e === "object" && "message" in e
            ? `[${deviceInfos[i].id}] ${(e as Error).message}`
            : `[${deviceInfos[i].id}] ${String(e)}`;
        errorMsgs.push(errMsg);
      }
    }
    if (errorMsgs.length > 0) {
      expect.fail(
        "SELECT FILEのレスポンスが取得できませんでした:\n" +
          errorMsgs.join("\n"),
      );
    } else {
      expect.fail("SELECT FILEのレスポンスが取得できませんでした");
    }
  });

  it("READ BINARYのレスポンスが取得できる", async () => {
    if (deviceInfos.length === 0) return;
    const errorMsgs: string[] = [];
    for (let i = 0; i < deviceInfos.length; i++) {
      try {
        device = await platform.acquireDevice(deviceInfos[i].id);
        const isCardPresent = await device.isCardPresent();
        if (!isCardPresent) continue;
        card = await device.startSession();
        const readBinaryApdu = new CommandApdu(
          0x00,
          0xb0,
          0x00,
          0x00,
          null,
          0x10,
        );
        const readResp = await card.transmit(readBinaryApdu);
        expect(readResp.sw1, "sw1がnumber型でない").toBeTypeOf("number");
        expect(readResp.sw2, "sw2がnumber型でない").toBeTypeOf("number");
        return;
      } catch (e) {
        const errMsg =
          e && typeof e === "object" && "message" in e
            ? `[${deviceInfos[i].id}] ${(e as Error).message}`
            : `[${deviceInfos[i].id}] ${String(e)}`;
        errorMsgs.push(errMsg);
      }
    }
    if (errorMsgs.length > 0) {
      expect.fail(
        "READ BINARYのレスポンスが取得できませんでした:\n" +
          errorMsgs.join("\n"),
      );
    } else {
      expect.fail("READ BINARYのレスポンスが取得できませんでした");
    }
  });
});

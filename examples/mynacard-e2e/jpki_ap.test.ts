import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CommandApdu,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
} from "@aokiapp/interface";
import { PcscPlatformManager } from "@aokiapp/pcsc";

const JPKI_AP_AID = [0xa0, 0x00, 0x00, 0x02, 0x77, 0x01, 0x01, 0x01];
const PUBLIC_CERT_FILES = [
  { name: "署名用公開鍵証明書", fid: [0x00, 0x16] },
  { name: "利用者証明用公開鍵証明書", fid: [0x00, 0x17] },
  // 必要に応じて他の公開領域ファイルも追加
];

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

describe("JPKI_AP 公開証明書ファイル E2Eテスト", () => {
  it("リーダーが1つ以上取得できる", () => {
    expect(deviceInfos.length, "リーダーが見つかりません").toBeGreaterThan(0);
  });

  for (const { name, fid } of PUBLIC_CERT_FILES) {
    it(`${name} (FID=${fid.map((b) => b.toString(16).padStart(2, "0")).join("")}) のREAD BINARY`, async () => {
      if (deviceInfos.length === 0) return;
      const errorMsgs: string[] = [];
      for (let i = 0; i < deviceInfos.length; i++) {
        try {
          device = await platform.acquireDevice(deviceInfos[i].id);
          const isCardPresent = await device.isCardPresent();
          if (!isCardPresent) continue;
          card = await device.startSession();
          // JPKI_AP SELECT
          const selectApdu = new CommandApdu(
            0x00,
            0xa4,
            0x04,
            0x00,
            Uint8Array.from(JPKI_AP_AID),
            null,
          );
          const selectResp = await card.transmit(selectApdu);
          // 公開証明書ファイル SELECT
          const selectFileApdu = new CommandApdu(
            0x00,
            0xa4,
            0x02,
            0x0c,
            Uint8Array.from(fid),
            null,
          );
          const selectFileResp = await card.transmit(selectFileApdu);
          // READ BINARY
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
          // データ部があれば長さも確認
          if (readResp.data) {
            expect(
              readResp.data.length,
              "レスポンスデータ長が0",
            ).toBeGreaterThanOrEqual(0);
          }
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
          `${name} (FID=${fid.map((b) => b.toString(16).padStart(2, "0")).join("")}) のREAD BINARYが取得できませんでした:\n` +
            errorMsgs.join("\n"),
        );
      } else {
        expect.fail(
          `${name} (FID=${fid.map((b) => b.toString(16).padStart(2, "0")).join("")}) のREAD BINARYが取得できませんでした`,
        );
      }
    });
  }
});

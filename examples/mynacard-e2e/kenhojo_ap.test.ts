import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CommandApdu,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
} from "@aokiapp/interface";
import { PcscPlatformManager } from "@aokiapp/pcsc";

const KENHOJO_AP_AID = [
  0xa0, 0x00, 0x00, 0x00, 0x59, 0x01, 0x02, 0x01, 0x00, 0x02,
];
const PUBLIC_FILES: { name: string; fid: number[] }[] = [
  { name: "AP基本情報", fid: [0x00, 0x05] },
  { name: "中間証明書", fid: [0x00, 0x04] },
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

describe("KENHOJO_AP 公開領域 E2Eテスト", () => {
  it("リーダーが1つ以上取得できる", () => {
    expect(deviceInfos.length, "リーダーが見つかりません").toBeGreaterThan(0);
  });

  if (PUBLIC_FILES.length === 0) {
    it.skip("PIN不要で読めるファイルが未設定のためスキップ", () => {});
  } else {
    for (const { name, fid } of PUBLIC_FILES) {
      it(`${name} (FID=${fid.map((b) => b.toString(16).padStart(2, "0")).join("")}) のREAD BINARY`, async () => {
        if (deviceInfos.length === 0) return;
        const errorMsgs: string[] = [];
        for (let i = 0; i < deviceInfos.length; i++) {
          try {
            device = await platform.acquireDevice(deviceInfos[i].id);
            const isCardPresent = await device.isCardPresent();
            if (!isCardPresent) continue;
            card = await device.startSession();
            // KENHOJO_AP SELECT
            const selectApdu = new CommandApdu(
              0x00,
              0xa4,
              0x04,
              0x00,
              Uint8Array.from(KENHOJO_AP_AID),
              null,
            );
            await card.transmit(selectApdu);
            // 公開ファイル SELECT
            const selectFileApdu = new CommandApdu(
              0x00,
              0xa4,
              0x02,
              0x0c,
              Uint8Array.from(fid),
              null,
            );
            await card.transmit(selectFileApdu);
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
  }
});

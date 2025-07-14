import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CommandApdu } from "@aokiapp/interface";
import { PcscPlatformManager } from "@aokiapp/pcsc";

// AIDs from randr.md
const JPKI_AP_AID = [
  0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00, 0x00, 0x00, 0x01,
]; // JPKI AP
const KENHOJO_AP_AID = [
  0xd3, 0x92, 0x10, 0x00, 0x31, 0x00, 0x01, 0x01, 0x04, 0x08,
]; // 券面事項入力補助AP

let platform: any;
let device: any;
let card: any;
let deviceInfos: any[] = [];

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

describe("randr.md claims verification", () => {
  it("リーダーが1つ以上取得できる", () => {
    expect(deviceInfos.length, "リーダーが見つかりません").toBeGreaterThan(0);
  });

  // Helper to acquire device and start session
  async function acquireCardSession(): Promise<boolean> {
    if (deviceInfos.length === 0) {
      expect.fail(
        "リーダーが見つかりません。スマートカードリーダーが接続されていることを確認してください。",
      );
      return false;
    }
    deviceInfos.forEach((info, idx) => {
      expect(info.id, `リーダー${idx}:`).toBeDefined();
    });

    let errorMsgs: string[] = [];
    for (let i = 0; i < deviceInfos.length; i++) {
      try {
        device = await platform.acquireDevice(deviceInfos[i].id);
        const isCardPresent = await device.isCardPresent();
        if (!isCardPresent) {
          errorMsgs.push(`[${deviceInfos[i].id}] カードが挿入されていません`);
          continue;
        }
        card = await device.startSession();
        return true; // Successfully acquired and started session
      } catch (e: any) {
        errorMsgs.push(`[${deviceInfos[i].id}] ${e?.cause || e}`);
      }
    }
    expect.fail(
      "カードセッションを開始できませんでした:\n" + errorMsgs.join("\n"),
    );
    return false; // Should not be reached
  }

  describe("特定機関認証関連コマンドの検証 (80 A2)", () => {
    it("JPKI APの特定機関認証EFを選択し、80 A2 00 C1で無意味なデータを流すと、無意味なデータは当然CA証明書による署名検証に失敗し、67 00で失敗する", async () => {
      if (!(await acquireCardSession())) return;

      // Select JPKI AP
      const selectJpkiApCommand = new CommandApdu(
        0x00,
        0xa4,
        0x04,
        0x00,
        Buffer.from(JPKI_AP_AID),
        0x00,
      );
      const selectJpkiApResponse = await card.transmit(selectJpkiApCommand);
      expect(selectJpkiApResponse.sw).toBe(0x9000);
      // Construct 80 A2 00 C1 command with dummy data
      // From randr.md: header2: 5F 37 82 01 00 (length 256 bytes)
      const dummyData = Buffer.alloc(256, 0x00); // 256 bytes of dummy data
      const command80A200C1 = new CommandApdu(
        0x80,
        0xa2,
        0x00,
        0xc1,
        dummyData,
        0x00,
      );
      const response = await card.transmit(command80A200C1);

      // Expect 6D 00 (Instruction code not supported or invalid)
      expect(response.sw).toBe(0x6700);
    });
  });

  describe("RSA-PSS署名対応の検証 (80 2A 05 00)", () => {
    it("けんほじょのPINレス署名EFを選択し、80 2A 05 00(JPKI SIGN)で署名を行うと、アルゴリズム05、すなわちPSSで署名できる", async () => {
      if (!(await acquireCardSession())) return;

      // Select Kenhojo AP
      const selectKenhojoApCommand = new CommandApdu(
        0x00,
        0xa4,
        0x04,
        0x00,
        Buffer.from(KENHOJO_AP_AID),
        0x00,
      );
      const selectKenhojoApResponse = await card.transmit(
        selectKenhojoApCommand,
      );
      expect(selectKenhojoApResponse.sw).toBe(0x9000);

      // Construct 80 2A 05 00 command
      // Data: 32-byte hash (dummy)
      // Le: 256 bytes (for RSA 2048 signature)
      const dummyHash = Buffer.alloc(32, 0x01); // Dummy SHA-256 hash
      const command802A0500 = new CommandApdu(
        0x80,
        0x2a,
        0x05,
        0x00,
        dummyHash,
        0x00,
      ); // Le=0x00 means expect all data
      const response = await card.transmit(command802A0500);

      // Expect 90 00 (Success)
      expect(response.sw).toBe(0x9000);

      expect(response.data.length).toBe(256);
    });
  });

  describe("PIN不要な内部認証の検証 (80 2A 00 00)", () => {
    it("券面事項入力補助APのPINレス署名EFで署名でき、その際にPIN認証がいらないことを検証する", async () => {
      if (!(await acquireCardSession())) return;

      // Select Kenhojo AP
      const selectKenhojoApCommand = new CommandApdu(
        0x00,
        0xa4,
        0x04,
        0x00,
        Buffer.from(KENHOJO_AP_AID),
        0x00,
      );
      const selectKenhojoApResponse = await card.transmit(
        selectKenhojoApCommand,
      );
      expect(selectKenhojoApResponse.sw).toBe(0x9000);

      // Construct 80 2A 00 00 command
      // Data: 32-byte hash (dummy)
      // Le: 256 bytes (for RSA 2048 signature)
      const dummyHash = Buffer.alloc(32, 0x02); // Another dummy SHA-256 hash
      const command802A0000 = new CommandApdu(
        0x80,
        0x2a,
        0x00,
        0x00,
        dummyHash,
        0x00,
      ); // Le=0x00 means expect all data
      const response = await card.transmit(command802A0000);

      // Expect 90 00 (Success)
      expect(response.sw).toBe(0x9000);

      // Verify signature length is 256 bytes for RSA 2048
      expect(response.data.length).toBe(256);
      // The test implicitly verifies PIN-less by not performing a VERIFY command.
    });
  });
});

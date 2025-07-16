import z from "zod";

import { makeTool } from "../utils/tooldef.js";

/**
 * Output schema for resetCard tool
 */
const ResetCardOutputSchema = z.object({
  success: z.boolean(),
  atr: z.string(),
  protocol: z.enum(["T=0", "T=1", "T=CL"]),
});

/**
 * Convert ATR bytes to hex string
 */
function atrToHex(atr: Uint8Array): string {
  return Array.from(atr)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export default makeTool(
  "resetCard",
  `### 概要
接続中のスマートカードをハードウェアリセットします。

### 入力パラメータ
なし

### 出力
- success: 成功フラグ
- atr: 新しいATR
- protocol: 通信プロトコル

### 注意事項
- 事前にconnectToCardでカード接続が必要です。
- リセット後はATRやプロトコルが変化する場合があります。
`,
  z.object({}),
  ResetCardOutputSchema,
  async (input, context) => {
    context.log.info("Starting card reset");

    // Check if connected to a card
    if (!context.session.cardConnection || !context.session.card) {
      throw new Error(
        "No active card connection. Please connect to a card first.",
      );
    }

    const connectionInfo = context.session.cardConnection;
    context.log.debug(`Resetting card in reader: ${connectionInfo.readerId}`);

    try {
      // Reset the card
      await context.session.card.reset();
      context.log.debug("Card reset completed");

      // Get new ATR
      const atrBytes = await context.session.card.getAtr();
      const newAtr = atrToHex(atrBytes);
      context.log.debug(`New ATR after reset: ${newAtr}`);

      // Update connection info with new ATR
      connectionInfo.atr = newAtr;
      connectionInfo.lastActivity = new Date();

      // Protocol typically remains the same, but we use the stored value
      const protocol = connectionInfo.protocol;

      const result = {
        success: true,
        atr: newAtr,
        protocol,
      };

      context.log.info("Card reset completed successfully");
      return result;
    } catch (error: any) {
      context.log.error("Card reset failed:", error);
      throw error;
    }
  },
);

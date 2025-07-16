import z from "zod";

import { makeTool } from "../utils/tooldef.js";

/**
 * Output schema for disconnectFromCard tool
 */
const DisconnectFromCardOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  reader: z
    .object({
      id: z.string(),
      name: z.string(),
      isAvailable: z.boolean(),
      hasCard: z.boolean(),
      description: z.string().optional(),
      isIntegrated: z.boolean().optional(),
      isRemovable: z.boolean().optional(),
      supportsApdu: z.boolean().optional(),
      supportsHce: z.boolean().optional(),
    })
    .optional(),
});

export default makeTool(
  "disconnectFromCard",
  `### 概要
現在のカード接続セッションを安全に切断します。

### 入力パラメータ
なし

### 出力
- success: 成功フラグ
- message: 結果メッセージ
- reader: 切断したリーダー情報（省略可）

### 注意事項
- 既に切断済みの場合は何もしません。
- 他の操作を行う前に必ず切断してください。
`,
  z.object({}),
  DisconnectFromCardOutputSchema,
  async (input, context) => {
    context.log.info("Starting card disconnection");

    // Check if connected
    if (!context.session.cardConnection) {
      context.log.warn("No active card connection found");
      return {
        success: true,
        message: "No active card connection to disconnect",
      };
    }

    const connectionInfo = context.session.cardConnection;
    context.log.debug(`Disconnecting from reader: ${connectionInfo.readerId}`);

    let releaseErrors: string[] = [];

    try {
      // Release card if available
      if (context.session.card) {
        try {
          context.log.debug("Releasing card session");
          await context.session.card.release();
          context.log.debug("Card session released successfully");
        } catch (error: any) {
          const errorMsg = `Failed to release card: ${error instanceof Error ? error.message : String(error)}`;
          context.log.error(errorMsg);
          releaseErrors.push(errorMsg);
        }
      }

      // Release device if available
      if (context.session.device) {
        try {
          context.log.debug("Releasing device");
          await context.session.device.release();
          context.log.debug("Device released successfully");
        } catch (error: any) {
          const errorMsg = `Failed to release device: ${error instanceof Error ? error.message : String(error)}`;
          context.log.error(errorMsg);
          releaseErrors.push(errorMsg);
        }
      }

      // Get reader info before clearing session
      const readerInfo = {
        id: connectionInfo.readerId,
        name: connectionInfo.readerId, // We don't have the full name stored
        isAvailable: true, // Assume available after disconnect
        hasCard: false, // We don't know the current state
      };

      // Clear session state
      context.session.cardConnection = undefined;
      context.session.card = undefined;
      context.session.device = undefined;

      let message = `Successfully disconnected from reader ${connectionInfo.readerId}`;
      if (releaseErrors.length > 0) {
        message += ` (with warnings: ${releaseErrors.join(", ")})`;
        context.log.warn("Disconnect completed with warnings", {
          errors: releaseErrors,
        });
      } else {
        context.log.info("Disconnect completed successfully");
      }

      return {
        success: true,
        message,
        reader: readerInfo,
      };
    } catch (error: any) {
      context.log.error("Error during disconnect:", error);

      // Still clear session state even if release failed
      context.session.cardConnection = undefined;
      context.session.card = undefined;
      context.session.device = undefined;

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Disconnect completed with errors: ${errorMessage}`,
      };
    }
  },
);

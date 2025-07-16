import z from "zod";

import { getPlatform } from "../utils/getPlatform.js";
import { makeTool } from "../utils/tooldef.js";

/**
 * Input schema for forceReleaseReader tool
 */
const ForceReleaseReaderInputSchema = z.object({
  readerId: z.string().min(1, "Reader ID is required"),
});

/**
 * Output schema for forceReleaseReader tool
 */
const ForceReleaseReaderOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  readerId: z.string(),
});

export default makeTool(
  "forceReleaseReader",
  `### 概要
指定したリーダーのリソースを強制的に解放します（異常状態時用）。

### 入力パラメータ
- readerId (string): 対象リーダーのID

### 出力
- success: 成功フラグ
- message: 結果メッセージ
- readerId: 対象リーダーID

### 注意事項
- 通常はdisconnectFromCardで十分です。リーダーが「使用中」のまま解放できない場合のみ利用してください。
- 他のクライアントが利用中の場合は失敗することがあります。
`,
  ForceReleaseReaderInputSchema,
  ForceReleaseReaderOutputSchema,
  async (input, context) => {
    context.log.info("Starting forced reader release", {
      readerId: input.readerId,
    });

    // Initialize platform
    const platform = await getPlatform();
    context.log.debug("PC/SC platform initialized");

    try {
      // Check if this is the reader we're currently connected to
      if (context.session.cardConnection?.readerId === input.readerId) {
        context.log.warn(
          `Attempting to force release reader ${input.readerId} which is currently in use by this session`,
        );

        // Force cleanup of current session
        try {
          if (context.session.card) {
            await context.session.card.release();
          }
          if (context.session.device) {
            await context.session.device.release();
          }
        } catch (error: any) {
          context.log.warn("Error during session cleanup:", error);
        }

        // Clear session state
        context.session.cardConnection = undefined;
        context.session.card = undefined;
        context.session.device = undefined;

        return {
          success: true,
          message: `Successfully released reader ${input.readerId} (was in use by this session)`,
          readerId: input.readerId,
        };
      }

      // Check if reader exists
      const deviceInfos = await platform.getDeviceInfo();
      const deviceInfo = deviceInfos.find((info) => info.id === input.readerId);

      if (!deviceInfo) {
        const message = `Reader with ID '${input.readerId}' not found`;
        context.log.warn(message);
        return {
          success: false,
          message,
          readerId: input.readerId,
        };
      }

      // Try to acquire and immediately release the device to force cleanup
      try {
        context.log.debug(
          `Attempting to acquire device for forced release: ${input.readerId}`,
        );
        const device = await platform.acquireDevice(input.readerId);

        // Immediately release it
        await device.release();
        context.log.debug(
          `Device ${input.readerId} acquired and released successfully`,
        );

        const message = `Successfully force-released reader ${input.readerId}`;
        context.log.info(message);

        return {
          success: true,
          message,
          readerId: input.readerId,
        };
      } catch (error: any) {
        // If we can't acquire it, it might already be free or in an error state
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        context.log.debug(
          `Could not acquire device ${input.readerId}: ${errorMessage}`,
        );

        // This might actually be success if the reader was already free
        if (
          errorMessage.includes("already acquired") ||
          errorMessage.includes("in use")
        ) {
          // Reader is actually in use by someone else - this is expected for force release
          const message = `Reader ${input.readerId} appears to be in use by another process. Force release attempted, but may require system-level intervention.`;
          context.log.warn(message);

          return {
            success: false,
            message,
            readerId: input.readerId,
          };
        } else {
          // Reader might already be free
          const message = `Reader ${input.readerId} appears to be already available (${errorMessage})`;
          context.log.info(message);

          return {
            success: true,
            message,
            readerId: input.readerId,
          };
        }
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const message = `Failed to force release reader ${input.readerId}: ${errorMessage}`;
      context.log.error(message, error);

      return {
        success: false,
        message,
        readerId: input.readerId,
      };
    }
  },
);

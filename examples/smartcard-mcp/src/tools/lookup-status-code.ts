import z from "zod";

import { lookupStatusCode } from "../utils/status-codes.js";
import { makeTool } from "../utils/tooldef.js";

/**
 * Input schema for lookupStatusCode tool
 */
const LookupStatusCodeInputSchema = z.object({
  sw: z
    .string()
    .regex(
      /^[0-9A-Fa-f]{4}$/,
      "Status word must be a 4-digit hexadecimal string",
    ),
});

/**
 * Output schema for lookupStatusCode tool
 */
const LookupStatusCodeOutputSchema = z.object({
  sw: z.string(),
  category: z.enum(["success", "warning", "error"]),
  meaning: z.string(),
  action: z.string(),
});

export default makeTool(
  "lookupStatusCode",
  `### 概要
APDU応答のステータスワード（SW）を人間可読な説明に変換します。

### 入力パラメータ
- sw (string): 4桁16進数のステータスワード

### 出力
- sw: 入力値
- category: "success" | "warning" | "error"
- meaning: 意味説明
- action: 推奨アクション

### 注意事項
- transmitApdu等で得たsw値をそのまま入力してください。
`,
  LookupStatusCodeInputSchema,
  LookupStatusCodeOutputSchema,
  async (input, context) => {
    context.log.info("Looking up status code", { sw: input.sw });

    try {
      // Lookup status code information
      const statusInfo = lookupStatusCode(input.sw);

      context.log.debug("Status code lookup result", statusInfo as any);

      const result = {
        sw: statusInfo.sw,
        category: statusInfo.category,
        meaning: statusInfo.meaning,
        action: statusInfo.action,
      };

      context.log.info(
        `Status code lookup completed: ${input.sw} -> ${statusInfo.category}`,
      );
      return result;
    } catch (error: any) {
      context.log.error("Status code lookup failed:", error);

      // Return error information
      return {
        sw: input.sw,
        category: "error" as const,
        meaning: "不正なステータスコード形式",
        action: "4桁の16進数で入力してください",
      };
    }
  },
);

// FastMCP準拠・最小限・型安全なtool定義ユーティリティ
import { Context, Tool, UserError } from "fastmcp";
import { ZodType, z } from "zod";

import { SmartCardMcpSessionStruct } from "../types";

/**
 * MCPツール定義のための型
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodType;
  execute: (input: unknown, context: Context<any>) => Promise<unknown>;
}

function convertContext(context: Context<SmartCardMcpSessionStruct>) {
  if (!context.session) {
    context.session = {} as SmartCardMcpSessionStruct;
  }
  return {
    ...context,
    session: context.session as SmartCardMcpSessionStruct,
  };
}

/**
 * makeTool:
 * - contextはFastMCPのContext<any>をそのまま渡す
 * - 出力はZodでバリデーションし、string/objectどちらも許容
 * - ログは文字列のみ
 * - any/as any禁止
 */
export function makeTool<InputArg extends ZodType, OutputArg extends ZodType>(
  name: string,
  description: string,
  inputArg: InputArg,
  outputArg: OutputArg,
  fn: (
    input: z.infer<InputArg>,
    context: ReturnType<typeof convertContext>,
  ) => Promise<z.infer<OutputArg>>,
): Tool<SmartCardMcpSessionStruct> {
  return {
    name,
    description,
    parameters: inputArg,
    execute: async (input, rawCtx) => {
      try {
        const context = convertContext(rawCtx);

        const result = await fn(input, context);
        const parsedResult = outputArg.safeParse(result);

        if (!parsedResult.success) {
          throw new UserError(
            `Invalid output format: ${parsedResult.error.message}`,
          );
        }
        return {
          type: "text",
          text: JSON.stringify(parsedResult.data, null, 2),
        };
      } catch (error) {
        let msg =
          error && typeof error === "object" && "message" in error
            ? (error as Error).message
            : String(error);
        if (rawCtx?.log) {
          rawCtx.log.error(`Tool: ${name} failed: ${msg}`);
        }
        if (error instanceof UserError) {
          throw error;
        }
        throw new UserError(msg);
      }
    },
  } satisfies Tool<SmartCardMcpSessionStruct>;
}

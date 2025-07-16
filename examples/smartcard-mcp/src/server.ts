import { FastMCP } from "fastmcp";

import * as tools from "./tools/index.js";
import { SmartCardMcpSessionStruct } from "./types.js";

// Ensure global darkhole object exists
if (!globalThis.darkhole) {
  globalThis.darkhole = {
    debug: (...args: any[]) => {},
    info: (...args: any[]) => {},
    warn: (...args: any[]) => {},
    error: (...args: any[]) => {},
    log: (...args: any[]) => {},
  };
}

// declare global darkhole object
declare global {
  var darkhole: {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    log: (...args: any[]) => void;
  };
}
export const server = new FastMCP<SmartCardMcpSessionStruct>({
  name: "mcp-server-smartcard",
  version: "1.0.0",
  instructions: `
スマートカードMCPサーバー

このサーバーは、AI エージェントがスマートカードハードウェアと統一的なインターフェースを通じて連携するための基盤システムを提供します。

主な機能:
- リーダー一覧取得: システム内の利用可能なスマートカードリーダを列挙
- カード接続: 指定リーダのスマートカードとの通信セッションを確立
- APDU送信: スマートカードにAPDUコマンドを送信し応答を受信
- カード切断: スマートカードとの通信セッションを終了
- カードリセット: スマートカードのハードウェアリセットを実行
- ステータスコード解釈: APDUステータスコードを人間可読形式で解釈
- 強制リーダー解放: 利用不能状態のリーダを強制的に解放

セッション管理はFastMCPの機能を使用し、クライアントごとに独立したカード接続状態を管理します。
  `.trim(),
  async authenticate() {
    return {} satisfies SmartCardMcpSessionStruct;
  },
});

// Register all tools
for (const [toolName, tool] of Object.entries(tools)) {
  globalThis.darkhole.log(`Registering tool: ${toolName}`);
  server.addTool(tool);
}

/**
 * Start the MCP server
 */
export function startServer() {
  // Get transport configuration from environment variables
  const transportType =
    (process.env.TRANSPORT_TYPE as "stdio" | "httpStream") || "stdio";
  const port = parseInt(process.env.PORT || "8080", 10);
  const logLevel =
    (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info";

  globalThis.darkhole.log(`Starting Smart Card MCP Server...`);
  globalThis.darkhole.log(`Transport: ${transportType}`);

  if (transportType === "httpStream") {
    globalThis.darkhole.log(`Port: ${port}`);
  }

  globalThis.darkhole.log(`Log Level: ${logLevel}`);
  globalThis.darkhole.log(`Registered ${Object.keys(tools).length} tools`);

  server.start({
    transportType,
    ...(transportType === "httpStream" && {
      httpStream: {
        port,
      },
    }),
  });

  globalThis.darkhole.log("Smart Card MCP Server started successfully!");
}

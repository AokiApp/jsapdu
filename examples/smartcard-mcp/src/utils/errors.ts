/**
 * Error handling utilities for Smart Card MCP Server
 */
import { UserError } from "fastmcp";

import { SmartCardError } from "@aokiapp/interface";

import { SmartcardMcpError } from "../types.js";

/**
 * Maps SmartCardError to SmartcardMcpError
 */
export function mapSmartCardError(error: SmartCardError): SmartcardMcpError {
  const errorMessages: Record<string, string> = {
    NOT_INITIALIZED: "スマートカードシステムが初期化されていません",
    NO_READERS: "スマートカードリーダーが見つかりません",
    READER_ERROR: "リーダーとの通信でエラーが発生しました",
    NOT_CONNECTED: "カードとの接続が確立されていません",
    CARD_NOT_PRESENT: "カードが挿入されていません",
    TRANSMISSION_ERROR: "カードとの通信でエラーが発生しました",
    PROTOCOL_ERROR: "通信プロトコルの確立に失敗しました",
    TIMEOUT: "操作がタイムアウトしました",
    RESOURCE_LIMIT: "システムリソースが不足しています",
    INVALID_PARAMETER: "入力パラメータが不正です",
    ALREADY_CONNECTED: "リーダーは既に使用中です",
    UNSUPPORTED_OPERATION: "サポートされていない操作です",
    PLATFORM_ERROR: "システムエラーが発生しました",
  };

  const message = errorMessages[error.code] || error.message;

  return new SmartcardMcpError(message, error.code, {
    originalMessage: error.message,
    cause: error.cause,
  });
}

/**
 * Handles unknown errors and converts them to appropriate error types
 */
export function handleUnknownError(error: unknown): SmartcardMcpError {
  if (error instanceof SmartCardError) {
    return mapSmartCardError(error);
  }

  if (error instanceof SmartcardMcpError) {
    return error;
  }

  if (error instanceof UserError) {
    return new SmartcardMcpError(error.message, "USER_ERROR");
  }

  const message = error instanceof Error ? error.message : String(error);
  return new SmartcardMcpError(
    `予期しないエラーが発生しました: ${message}`,
    "UNKNOWN_ERROR",
    { originalError: error },
  );
}

/**
 * Gets error code from various error types
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof SmartCardError) {
    return error.code;
  }

  if (error instanceof SmartcardMcpError) {
    return error.code;
  }

  return "UNKNOWN_ERROR";
}

/**
 * Logs error with context
 */
export function logError(error: unknown, context: string, logger?: any): void {
  const errorCode = getErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);

  if (logger) {
    logger.error(`[${context}] ${errorCode}: ${message}`, {
      code: errorCode,
      context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    });
  } else {
    globalThis.darkhole.error(`[${context}] ${errorCode}: ${message}`);
  }
}

/**
 * APDU Status Code interpretation utilities
 */
import { StatusCodeInfo } from "../types.js";

/**
 * APDU Status Code lookup table based on ISO 7816-4
 */
const STATUS_CODE_TABLE: Record<string, Omit<StatusCodeInfo, "sw">> = {
  "9000": {
    category: "success",
    meaning: "正常終了",
    action: "処理継続",
  },
  "6100": {
    category: "warning",
    meaning: "応答データあり",
    action: "GET RESPONSEで取得",
  },
  "6281": {
    category: "warning",
    meaning: "データ破損可能性",
    action: "データ検証実施",
  },
  "6300": {
    category: "warning",
    meaning: "認証失敗",
    action: "認証情報確認",
  },
  "6400": {
    category: "error",
    meaning: "実行エラー",
    action: "コマンド見直し",
  },
  "6700": {
    category: "error",
    meaning: "不正長",
    action: "データ長確認",
  },
  "6900": {
    category: "error",
    meaning: "コマンド不許可",
    action: "セキュリティ状態確認",
  },
  "6A00": {
    category: "error",
    meaning: "不正パラメータ",
    action: "パラメータ修正",
  },
  "6B00": {
    category: "error",
    meaning: "不正P1/P2",
    action: "パラメータ修正",
  },
  "6C00": {
    category: "error",
    meaning: "不正Le",
    action: "Le値修正",
  },
  "6D00": {
    category: "error",
    meaning: "未対応命令",
    action: "命令コード確認",
  },
  "6E00": {
    category: "error",
    meaning: "未対応クラス",
    action: "クラスバイト確認",
  },
  "6F00": {
    category: "error",
    meaning: "データなし",
    action: "前処理確認",
  },
  // Additional common status codes
  "6200": {
    category: "warning",
    meaning: "メモリ残量なし",
    action: "領域確認",
  },
  "63C0": {
    category: "warning",
    meaning: "カウンタ値減少",
    action: "再試行検討",
  },
  "6581": {
    category: "error",
    meaning: "メモリ障害",
    action: "カード確認",
  },
  "6800": {
    category: "error",
    meaning: "CLAサポートなし",
    action: "CLAバイト確認",
  },
  "6981": {
    category: "error",
    meaning: "コマンド実行不可",
    action: "カード状態確認",
  },
  "6982": {
    category: "error",
    meaning: "セキュリティ状態不満足",
    action: "認証実行",
  },
  "6983": {
    category: "error",
    meaning: "認証方法ブロック",
    action: "PINリセット",
  },
  "6984": {
    category: "error",
    meaning: "参照データ無効",
    action: "データ確認",
  },
  "6985": {
    category: "error",
    meaning: "使用条件不満足",
    action: "使用条件確認",
  },
  "6986": {
    category: "error",
    meaning: "コマンド許可なし",
    action: "権限確認",
  },
  "6A80": {
    category: "error",
    meaning: "データフィールド不正",
    action: "データ形式確認",
  },
  "6A81": {
    category: "error",
    meaning: "機能サポートなし",
    action: "カード仕様確認",
  },
  "6A82": {
    category: "error",
    meaning: "ファイル未発見",
    action: "ファイルパス確認",
  },
  "6A83": {
    category: "error",
    meaning: "レコード未発見",
    action: "レコード番号確認",
  },
  "6A84": {
    category: "error",
    meaning: "ファイル領域不足",
    action: "容量確認",
  },
  "6A86": {
    category: "error",
    meaning: "P1P2値不正",
    action: "パラメータ確認",
  },
  "6A88": {
    category: "error",
    meaning: "参照データ未発見",
    action: "データ存在確認",
  },
};

/**
 * Normalizes status word to 4-digit uppercase hex string
 */
function normalizeStatusWord(sw: string): string {
  // Remove spaces, convert to uppercase
  let normalized = sw.replace(/\s+/g, "").toUpperCase();

  // Handle common prefixes
  if (normalized.startsWith("0X")) {
    normalized = normalized.substring(2);
  }

  // Ensure 4 digits
  if (normalized.length === 2) {
    normalized = normalized + "00";
  } else if (normalized.length === 3) {
    normalized = "0" + normalized;
  }

  // Validate hex format
  if (!/^[0-9A-F]{4}$/.test(normalized)) {
    throw new Error(`Invalid status word format: ${sw}`);
  }

  return normalized;
}

/**
 * Looks up APDU status code information
 */
export function lookupStatusCode(sw: string): StatusCodeInfo {
  try {
    const normalizedSw = normalizeStatusWord(sw);

    // Direct lookup
    const directMatch = STATUS_CODE_TABLE[normalizedSw];
    if (directMatch) {
      return {
        sw: normalizedSw,
        ...directMatch,
      };
    }

    // Pattern matching for similar codes
    const sw1 = normalizedSw.substring(0, 2);
    const sw2 = normalizedSw.substring(2, 4);

    // Check for pattern matches (e.g., 61XX, 6CXX)
    const patternKey = sw1 + "00";
    const patternMatch = STATUS_CODE_TABLE[patternKey];
    if (patternMatch) {
      let meaning = patternMatch.meaning;
      let action = patternMatch.action;

      // Specific handling for common patterns
      if (sw1 === "61") {
        meaning = `応答データあり (${parseInt(sw2, 16)}バイト)`;
        action = `GET RESPONSE ${sw2}で取得`;
      } else if (sw1 === "6C") {
        meaning = `不正Le (正しいLe: ${parseInt(sw2, 16)})`;
        action = `Le=${sw2}で再送信`;
      }

      return {
        sw: normalizedSw,
        category: patternMatch.category,
        meaning,
        action,
      };
    }

    // Unknown status code
    return {
      sw: normalizedSw,
      category: "error",
      meaning: "未知のステータスコード",
      action: "カード仕様書を確認してください",
    };
  } catch {
    // Invalid format
    return {
      sw: sw,
      category: "error",
      meaning: "不正なステータスコード形式",
      action: "4桁の16進数で入力してください",
    };
  }
}

/**
 * Checks if status code indicates success
 */
export function isSuccessStatus(sw: string): boolean {
  try {
    const info = lookupStatusCode(sw);
    return info.category === "success";
  } catch {
    return false;
  }
}

/**
 * Checks if status code indicates warning
 */
export function isWarningStatus(sw: string): boolean {
  try {
    const info = lookupStatusCode(sw);
    return info.category === "warning";
  } catch {
    return false;
  }
}

/**
 * Checks if status code indicates error
 */
export function isErrorStatus(sw: string): boolean {
  try {
    const info = lookupStatusCode(sw);
    return info.category === "error";
  } catch {
    return true; // Assume error for invalid format
  }
}

import z from "zod";
import { success } from "zod/v4";

import { CommandApdu } from "@aokiapp/interface";

import { makeTool } from "../utils/tooldef.js";

/**
 * Create a Zod schema for hex string or number with specified max value
 */
const createHexOrNumberSchema = (maxValue: number, description: string) =>
  z.union(
    [
      z.number().min(0).max(maxValue),
      z
        .string()
        .regex(
          /^[0-9A-Fa-f]{2}(\s+[0-9A-Fa-f]{2})*\s*$/,
          "Invalid hex string - must be valid hex octets (2 digits each)",
        )
        .transform((val) => {
          const cleanHex = val.replace(/\s+/g, "");
          if (cleanHex.length === 0) return 0;
          const parsed = parseInt(cleanHex, 16);
          if (isNaN(parsed)) throw new Error("Invalid hex string");
          if (parsed > maxValue) throw new Error(`Value must be 0-${maxValue}`);
          return parsed;
        }),
    ],
    {
      description,
    },
  );

/**
 * Input schema for transmitApdu tool
 */
const TransmitApduInputSchema = z.object({
  cla: createHexOrNumberSchema(255, "CLA must be 0-255 or valid hex string"),
  ins: createHexOrNumberSchema(255, "INS must be 0-255 or valid hex string"),
  p1: createHexOrNumberSchema(255, "P1 must be 0-255 or valid hex string"),
  p2: createHexOrNumberSchema(255, "P2 must be 0-255 or valid hex string"),
  data: z
    .string({
      description:
        "Hex string of APDU data. Can be splitted into octets by spaces e.g. '00', 'be ef', or 'c01a'",
    })
    .regex(/^[0-9A-Fa-f\s]*$/, "Invalid hex string")
    .optional(),
  le: createHexOrNumberSchema(
    65536,
    "Le must be 0-65536 or valid hex string",
  ).optional(),
});

/**
 * Output schema for transmitApdu tool
 */
const TransmitApduOutputSchema = z.object({
  data: z.string(),
  sw: z.string(),
  timing: z.number(),
});

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  // Remove any whitespace and ensure even length
  const cleanHex = hex.replace(/\s+/g, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }

  const result = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    result[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return result as Uint8Array<ArrayBuffer>;
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Build CommandApdu from input
 */
function buildCommandApdu(
  input: z.infer<typeof TransmitApduInputSchema>,
): CommandApdu {
  // Build structured command
  let dataBytes: Uint8Array<ArrayBuffer> | null = null;
  if (input.data && input.data.length > 0) {
    dataBytes = hexToUint8Array(input.data);
  }

  return new CommandApdu(
    input.cla,
    input.ins,
    input.p1,
    input.p2,
    dataBytes,
    input.le,
  );
}

export default makeTool(
  "transmitApdu",
  `### 概要
接続中のスマートカードにAPDUコマンドを送信し、応答を取得します。

### 入力パラメータ
- cla, ins, p1, p2 (numberまたは2桁16進文字列): 各バイト値
- data (string, 省略可): コマンドデータ（16進文字列, スペース区切り可）
- le (numberまたは16進, 省略可): 期待応答長

### 出力
- data: 応答データ（16進文字列）
- sw: ステータスワード（4桁16進）
- timing: 実行時間（ms）

### 注意事項
- 事前にconnectToCardでカード接続が必要です。
- APDUコマンドの構造や値はカード仕様に従ってください。
`,
  TransmitApduInputSchema,
  TransmitApduOutputSchema,
  async (input, context) => {
    context.log.info("Starting APDU transmission", { input });

    // Check if connected to a card
    if (!context.session.cardConnection || !context.session.card) {
      throw new Error(
        "No active card connection. Please connect to a card first.",
      );
    }

    const connectionInfo = context.session.cardConnection;
    context.log.debug(`Using card connection: ${connectionInfo.readerId}`);

    try {
      // Build APDU command
      const commandApdu = buildCommandApdu(input);
      const commandBytes = commandApdu.toUint8Array();
      const commandHex = uint8ArrayToHex(commandBytes);

      context.log.debug(`Transmitting APDU: ${commandHex}`);

      // Update last activity
      connectionInfo.lastActivity = new Date();

      // Measure execution time
      const startTime = performance.now();

      // Send APDU to card
      const responseApdu = await context.session.card.transmit(commandApdu);

      const endTime = performance.now();
      const timing = endTime - startTime;

      const result = {
        data: uint8ArrayToHex(responseApdu.toUint8Array()),
        sw: responseApdu.sw.toString(16).padStart(4, "0").toUpperCase(),
        timing: Math.round(timing * 100) / 100, // Round to 2 decimal places
      };
      context.log.debug(
        `APDU response: data=${result.data}, sw=${result.sw}, timing=${result.timing.toFixed(2)}ms`,
      );
      context.log.info("APDU transmission completed successfully");
      return result;
    } catch (error: any) {
      context.log.error("APDU transmission failed:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`APDU transmission failed: ${errorMessage}`);
    }
  },
);

import z from "zod";

import { CardConnectionInfo, ReaderInfo } from "../types.js";
import { getPlatform } from "../utils/getPlatform.js";
import { makeTool } from "../utils/tooldef.js";

/**
 * Input schema for connectToCard tool
 */
const ConnectToCardInputSchema = z.object({
  useDefaultReader: z.boolean().default(true),
  readerId: z.string().optional(),
});

/**
 * Output schema for connectToCard tool
 */
const ConnectToCardOutputSchema = z.object({
  success: z.boolean(),
  atr: z.string(),
  protocol: z.enum(["T=0", "T=1", "T=CL"]),
  reader: z.object({
    id: z.string(),
    name: z.string(),
    isAvailable: z.boolean(),
    hasCard: z.boolean(),
    description: z.string().optional(),
    isIntegrated: z.boolean().optional(),
    isRemovable: z.boolean().optional(),
    supportsApdu: z.boolean().optional(),
    supportsHce: z.boolean().optional(),
  }),
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

/**
 * Map PC/SC protocol to our protocol type
 */
function mapProtocol(pcscProtocol: number): "T=0" | "T=1" | "T=CL" {
  // Based on PC/SC protocol constants
  if (pcscProtocol === 1) return "T=0";
  if (pcscProtocol === 2) return "T=1";
  return "T=CL"; // Default for contactless or unknown
}

export default makeTool(
  "connectToCard",
  `### 概要
指定したリーダーのスマートカードと通信セッションを確立します。

### 入力パラメータ
- useDefaultReader (boolean, デフォルトtrue): デフォルトリーダーを使うか
- readerId (string, 省略可): 利用するリーダーID（複数リーダーがある場合は必須）

### 出力
- success: 成功フラグ
- atr: カードのATR（16進文字列）
- protocol: 通信プロトコル（"T=0"等）
- reader: 接続したリーダー情報

### 注意事項
- 既に接続済みの場合はエラーになります。disconnectFromCardで切断してから再度実行してください。
- カードが挿入されていないリーダーを指定するとエラーになります。
`,
  ConnectToCardInputSchema,
  ConnectToCardOutputSchema,
  async (input, context) => {
    context.log.info("Starting card connection", { input });

    // Check if already connected
    if (context.session.cardConnection) {
      const existing = context.session.cardConnection;
      context.log.warn(`Already connected to reader ${existing.readerId}`);
      throw new Error(
        `Already connected to reader ${existing.readerId}. Please disconnect first.`,
      );
    }

    // Initialize platform
    const platform = await getPlatform();
    context.log.debug("PC/SC platform initialized");

    // Get available readers (only call once)
    const deviceInfos = await platform.getDeviceInfo();
    if (deviceInfos.length === 0) {
      throw new Error("No smart card readers found on the system");
    }

    // Check card presence for each reader
    const readersWithCards: typeof deviceInfos = [];
    for (const info of deviceInfos) {
      try {
        const device = await platform.acquireDevice(info.id);
        const hasCard = await device.isCardPresent();
        await device.release();

        if (hasCard) {
          readersWithCards.push(info);
        }
      } catch (error) {
        context.log.warn(
          `Failed to check card presence for reader ${info.id}:`,
          String(error),
        );
      }
    }

    if (readersWithCards.length === 0) {
      const readerList = deviceInfos
        .map(
          (info) =>
            `- ${info.id} (${info.friendlyName || info.description || "Unknown"})`,
        )
        .join("\n");
      throw new Error(
        `No cards found in any reader.\n` + `Available readers:\n${readerList}`,
      );
    }

    // Determine reader ID
    let targetReaderId: string;

    if (input.useDefaultReader || !input.readerId) {
      // Check if multiple readers with cards exist and default reader is requested
      if (readersWithCards.length > 1 && input.useDefaultReader) {
        const readerList = readersWithCards
          .map(
            (info) =>
              `- ${info.id} (${info.friendlyName || info.description || "Unknown"})`,
          )
          .join("\n");
        throw new Error(
          `Multiple smart card readers with cards found. Please specify a reader ID instead of using default reader.\n` +
            `Available readers with cards:\n${readerList}`,
        );
      }

      targetReaderId = readersWithCards[0].id;
      context.log.debug(`Using default reader: ${targetReaderId}`);
    } else {
      targetReaderId = input.readerId;
      context.log.debug(`Using specified reader: ${targetReaderId}`);
    }

    // Validate reader exists
    const deviceInfo = deviceInfos.find((info) => info.id === targetReaderId);
    if (!deviceInfo) {
      throw new Error(`Reader with ID '${targetReaderId}' not found`);
    }

    // Validate card is present in the specified reader
    const hasCardInTarget = readersWithCards.some(
      (info) => info.id === targetReaderId,
    );
    if (!hasCardInTarget) {
      throw new Error(`No card present in reader '${targetReaderId}'`);
    }

    // Acquire device
    context.log.debug(`Acquiring device: ${targetReaderId}`);
    const device = await platform.acquireDevice(targetReaderId);

    try {
      // Check device availability
      const isAvailable = await device.isDeviceAvailable();
      if (!isAvailable) {
        throw new Error(`Reader '${targetReaderId}' is not available`);
      }

      // Start card session (card presence already verified above)
      context.log.debug("Starting card session");
      const card = await device.startSession();

      // Get ATR
      const atrBytes = await card.getAtr();
      const atr = atrToHex(atrBytes);
      context.log.debug(`Card ATR: ${atr}`);

      // Determine protocol (we'll use a placeholder for now as it's not directly available)
      const protocol: "T=0" | "T=1" | "T=CL" = "T=0"; // Most common protocol

      // Create reader info
      const readerInfo: ReaderInfo = {
        id: deviceInfo.id,
        name: deviceInfo.friendlyName || deviceInfo.id,
        isAvailable: true,
        hasCard: true,
        description: deviceInfo.description,
        isIntegrated: deviceInfo.isIntegratedDevice,
        isRemovable: deviceInfo.isRemovableDevice,
        supportsApdu: deviceInfo.supportsApdu,
        supportsHce: deviceInfo.supportsHce,
      };

      // Store connection info in session
      const connectionInfo: CardConnectionInfo = {
        readerId: targetReaderId,
        atr,
        protocol,
        connectedAt: new Date(),
        lastActivity: new Date(),
      };

      context.session.cardConnection = connectionInfo;
      context.session.device = device;
      context.session.card = card;

      const result = {
        success: true,
        atr,
        protocol,
        reader: readerInfo,
      };

      context.log.info(
        `Successfully connected to card in reader ${targetReaderId}`,
      );
      return result;
    } catch (error: any) {
      // Clean up on error
      try {
        await device.release();
      } catch (releaseError: any) {
        context.log.error(
          "Error releasing device after connection failure:",
          releaseError,
        );
      }
      throw error;
    }
  },
);

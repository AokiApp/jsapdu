import z from "zod";

import { ReaderInfo } from "../types.js";
import { getPlatform } from "../utils/getPlatform.js";
import { makeTool } from "../utils/tooldef.js";

/**
 * Output schema for listReaders tool
 */
const ListReadersOutputSchema = z.array(
  z.object({
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
);

export default makeTool(
  "listReaders",
  `### 概要
システムに接続されている全てのスマートカードリーダーの情報を取得します。

### 入力パラメータ
なし

### 出力
- id: リーダーの一意識別子
- name: 表示名
- isAvailable: 利用可能か
- hasCard: カードが挿入されているか
- description等: 追加属性

### 注意事項
- リーダーが1台も無い場合は空リストが返ります。
- 最初に呼び出して、利用可能なリーダーを確認してください。
`,
  z.object({}),
  ListReadersOutputSchema,
  async (input, context) => {
    context.log.info("Starting reader enumeration");

    // Initialize platform
    const platform = await getPlatform();
    context.log.debug("PC/SC platform initialized");

    // Get device information
    const deviceInfos = await platform.getDeviceInfo();
    context.log.debug(`Found ${deviceInfos.length} readers`);

    const readers: ReaderInfo[] = [];

    for (const deviceInfo of deviceInfos) {
      try {
        context.log.debug(`Processing reader: ${deviceInfo.id}`);

        // Try to acquire device to check availability
        let isAvailable = false;
        let hasCard = false;

        try {
          const device = await platform.acquireDevice(deviceInfo.id);
          isAvailable = await device.isDeviceAvailable();
          hasCard = await device.isCardPresent();
          await device.release();
          context.log.debug(
            `Reader ${deviceInfo.id}: available=${isAvailable}, hasCard=${hasCard}`,
          );
        } catch (error: any) {
          // Reader not available or other error
          context.log.warn(`Failed to check reader ${deviceInfo.id}:`, error);
          isAvailable = false;
          hasCard = false;
        }

        const readerInfo: ReaderInfo = {
          id: deviceInfo.id,
          name: deviceInfo.friendlyName || deviceInfo.id,
          isAvailable,
          hasCard,
          description: deviceInfo.description,
          isIntegrated: deviceInfo.isIntegratedDevice,
          isRemovable: deviceInfo.isRemovableDevice,
          supportsApdu: deviceInfo.supportsApdu,
          supportsHce: deviceInfo.supportsHce,
        };

        readers.push(readerInfo);
      } catch (error: any) {
        context.log.error(`Error processing reader ${deviceInfo.id}:`, error);
        // Continue with other readers
      }
    }
    context.log.info(`Enumeration complete: ${readers.length} readers found`);
    return readers;
  },
);

import { SmartCard } from "@aokiapp/interface/src/abstracts";
import { CommandApdu } from "@aokiapp/interface/src/apdu/command-apdu";
import { ResponseApdu } from "@aokiapp/interface/src/apdu/response-apdu";

import { AndroidNfcReader } from "./AndroidNfcReader";
import { JsApduModule } from "./JsApduModule";
// 後で作成
import { fromUint8Array, toUint8Array } from "./utils";

// ユーティリティをutils.tsに分離予定

/**
 * Card implementation
 */
export class AndroidNfcCard extends SmartCard {
  #receiverId: string;
  #parentDevice: AndroidNfcReader;
  #released = false;

  constructor(receiverId: string, parentDevice: AndroidNfcReader) {
    super(parentDevice);
    this.#receiverId = receiverId;
    this.#parentDevice = parentDevice;
  }

  async getAtr(): Promise<Uint8Array> {
    this.#assertNotReleased();
    const atr = await JsApduModule.getAtr(this.#receiverId);
    return toUint8Array(atr);
  }

  async transmit(apdu: CommandApdu): Promise<ResponseApdu> {
    this.#assertNotReleased();
    // Convert CommandApdu to Uint8Array, then to number[]
    const apduBytes = fromUint8Array(apdu.toUint8Array());
    const responseBytes = await JsApduModule.transmit(
      this.#receiverId,
      apduBytes,
    );
    // Convert response to Uint8Array, then to ResponseApdu (cast for ArrayBuffer type compatibility)
    return ResponseApdu.fromUint8Array(
      toUint8Array(responseBytes) as unknown as Uint8Array<ArrayBuffer>,
    );
  }

  async reset(): Promise<void> {
    this.#assertNotReleased();
    await JsApduModule.resetCard(this.#receiverId);
  }

  async release(): Promise<void> {
    if (this.#released) return;
    await JsApduModule.releaseCard(this.#receiverId);
    this.#released = true;
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("Card already released");
  }
}

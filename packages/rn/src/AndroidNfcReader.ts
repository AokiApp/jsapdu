import {
  EmulatedCard,
  SmartCard,
  SmartCardDevice,
} from "@aokiapp/interface/src/abstracts";

import { AndroidEmulatedCard } from "./AndroidEmulatedCard";
import { AndroidNfcCard } from "./AndroidNfcCard";
import { AndroidNfcReaderInfo } from "./AndroidNfcReaderInfo";
import { JsApduModule } from "./JsApduModule";

// 後で作成

/**
 * Device implementation
 */
export class AndroidNfcReader extends SmartCardDevice {
  #receiverId: string;
  #deviceInfo: AndroidNfcReaderInfo;
  #released = false;

  constructor(receiverId: string, deviceInfo: AndroidNfcReaderInfo) {
    super(null as any, null as any); // parentPlatform/deviceInfo not used in this bridge
    this.#receiverId = receiverId;
    this.#deviceInfo = deviceInfo;
  }

  getDeviceInfo(): AndroidNfcReaderInfo {
    return this.#deviceInfo;
  }

  isActive(): boolean {
    this.#assertNotReleased();
    // No direct native method; assume always active if not released
    return !this.#released;
  }

  async isCardPresent(): Promise<boolean> {
    this.#assertNotReleased();
    return await JsApduModule.isCardPresent(this.#receiverId);
  }

  async startSession(): Promise<SmartCard> {
    this.#assertNotReleased();
    const cardId = await JsApduModule.startSession(this.#receiverId);
    return new AndroidNfcCard(cardId, this);
  }

  async startHceSession(): Promise<EmulatedCard> {
    this.#assertNotReleased();
    const cardId = await JsApduModule.startHceSession(this.#receiverId);
    return new AndroidEmulatedCard(cardId, this);
  }

  async release(): Promise<void> {
    if (this.#released) return;
    await JsApduModule.releaseDevice(this.#receiverId);
    this.#released = true;
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("Device already released");
  }
}

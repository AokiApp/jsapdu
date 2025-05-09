import {
  SmartCardPlatform,
  SmartCardPlatformManager,
} from "@aokiapp/interface/src/abstracts";

import { AndroidNfcReaderInfo } from "./AndroidNfcReaderInfo";
import { JsApduModule } from "./JsApduModule";

// 後でこのファイルを作成し、index.tsから切り出す
// toUint8Array, fromUint8Arrayはindex.tsに残す

/**
 * Platform Manager implementation
 */
export class AndroidNfcPlatformManager extends SmartCardPlatformManager {
  #receiverId: string | null = null;
  #released = false;

  private constructor(receiverId: string) {
    super();
    this.#receiverId = receiverId;
  }

  static async create(): Promise<AndroidNfcPlatformManager> {
    const receiverId = await JsApduModule.createPlatformManager();
    return new AndroidNfcPlatformManager(receiverId);
  }

  getPlatform(): SmartCardPlatform {
    this.#assertNotReleased();
    return new AndroidNfcPlatform(this.#receiverId!);
  }

  async release(): Promise<void> {
    if (this.#released || !this.#receiverId) return;
    await JsApduModule.releasePlatform(this.#receiverId);
    this.#released = true;
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("PlatformManager already released");
  }
}

/**
 * Platform implementation
 */
export class AndroidNfcPlatform extends SmartCardPlatform {
  #receiverId: string;
  #released = false;

  constructor(receiverId: string) {
    super();
    this.#receiverId = receiverId;
  }

  async init(): Promise<void> {
    this.#assertNotReleased();
    await JsApduModule.initPlatform(this.#receiverId);
  }

  async release(): Promise<void> {
    if (this.#released) return;
    await JsApduModule.releasePlatform(this.#receiverId);
    this.#released = true;
  }

  async getDevices(): Promise<AndroidNfcReaderInfo[]> {
    this.#assertNotReleased();
    const devices = await JsApduModule.getDevices(this.#receiverId);
    return devices.map((info: any) => new AndroidNfcReaderInfo(info));
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("Platform already released");
  }
}

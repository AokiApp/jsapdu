import { SmartCardDeviceInfo } from "@aokiapp/interface/src/abstracts";

import { AndroidNfcReader } from "./AndroidNfcReader";
import { JsApduModule } from "./JsApduModule";

// 後で作成
// toUint8Array, fromUint8Arrayはindex.tsに残す

/**
 * DeviceInfo implementation
 */
export class AndroidNfcReaderInfo extends SmartCardDeviceInfo {
  #receiverId: string;
  #id: string;
  #devicePath?: string;
  #friendlyName?: string;
  #description?: string;
  #supportsApdu: boolean;
  #supportsHce: boolean;
  #isIntegratedDevice: boolean;
  #isRemovableDevice: boolean;
  #d2cProtocol: "iso7816" | "nfc" | "other" | "unknown";
  #p2dProtocol: "usb" | "ble" | "nfc" | "other" | "unknown";
  #apduApi: string[];
  #released = false;

  constructor(nativeInfo: any) {
    super();
    this.#receiverId = nativeInfo.receiverId;
    this.#id = nativeInfo.id;
    this.#devicePath = nativeInfo.devicePath;
    this.#friendlyName = nativeInfo.friendlyName;
    this.#description = nativeInfo.description;
    this.#supportsApdu = nativeInfo.supportsApdu;
    this.#supportsHce = nativeInfo.supportsHce;
    this.#isIntegratedDevice = nativeInfo.isIntegratedDevice;
    this.#isRemovableDevice = nativeInfo.isRemovableDevice;
    this.#d2cProtocol = nativeInfo.d2cProtocol;
    this.#p2dProtocol = nativeInfo.p2dProtocol;
    this.#apduApi = nativeInfo.apduApi;
  }

  get id(): string {
    return this.#id;
  }
  get devicePath(): string | undefined {
    return this.#devicePath;
  }
  get friendlyName(): string | undefined {
    return this.#friendlyName;
  }
  get description(): string | undefined {
    return this.#description;
  }
  get supportsApdu(): boolean {
    return this.#supportsApdu;
  }
  get supportsHce(): boolean {
    return this.#supportsHce;
  }
  get isIntegratedDevice(): boolean {
    return this.#isIntegratedDevice;
  }
  get isRemovableDevice(): boolean {
    return this.#isRemovableDevice;
  }
  get d2cProtocol(): "iso7816" | "nfc" | "other" | "unknown" {
    return this.#d2cProtocol;
  }
  get p2dProtocol(): "usb" | "ble" | "nfc" | "other" | "unknown" {
    return this.#p2dProtocol;
  }
  get apduApi(): string[] {
    return this.#apduApi;
  }

  async acquireDevice(): Promise<AndroidNfcReader> {
    this.#assertNotReleased();
    const deviceId = await JsApduModule.acquireDevice(this.#receiverId);
    return new AndroidNfcReader(deviceId, this);
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("DeviceInfo already released");
  }
}

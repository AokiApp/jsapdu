import { requireNativeModule } from "expo-modules-core";

import {
  EmulatedCard,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
  SmartCardPlatformManager,
} from "@aokiapp/interface/src/abstracts";
import { CommandApdu } from "@aokiapp/interface/src/apdu/command-apdu";
import { ResponseApdu } from "@aokiapp/interface/src/apdu/response-apdu";

// Utility for Uint8Array <-> number[] conversion
function toUint8Array(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}
function fromUint8Array(arr: Uint8Array): number[] {
  return Array.from(arr);
}

// EMA bridge interface
interface IJsApduModule {
  createPlatformManager(): Promise<string>;
  initPlatform(receiverId: string): Promise<void>;
  releasePlatform(receiverId: string): Promise<void>;
  getDevices(receiverId: string): Promise<any[]>;
  acquireDevice(receiverId: string): Promise<string>;
  isCardPresent(receiverId: string): Promise<boolean>;
  startSession(receiverId: string): Promise<string>;
  startHceSession(receiverId: string): Promise<string>;
  releaseDevice(receiverId: string): Promise<void>;
  getAtr(receiverId: string): Promise<number[]>;
  transmit(receiverId: string, apdu: number[]): Promise<number[]>;
  resetCard(receiverId: string): Promise<void>;
  releaseCard(receiverId: string): Promise<void>;
  // EmulatedCard/HCE
  // ... (other methods will be added as needed)
}

const JsApduModule = requireNativeModule("JsApduModule")! as IJsApduModule;

// Platform Manager implementation
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

// Platform implementation
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

  async getDevices(): Promise<SmartCardDeviceInfo[]> {
    this.#assertNotReleased();
    const devices = await JsApduModule.getDevices(this.#receiverId);
    return devices.map((info: any) => new AndroidNfcReaderInfo(info));
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("Platform already released");
  }
}

// DeviceInfo implementation
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

  async acquireDevice(): Promise<SmartCardDevice> {
    this.#assertNotReleased();
    const deviceId = await JsApduModule.acquireDevice(this.#receiverId);
    return new AndroidNfcReader(deviceId, this);
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("DeviceInfo already released");
  }
}

// Device implementation
export class AndroidNfcReader extends SmartCardDevice {
  #receiverId: string;
  #deviceInfo: AndroidNfcReaderInfo;
  #released = false;

  constructor(receiverId: string, deviceInfo: AndroidNfcReaderInfo) {
    super(null as any, null as any); // parentPlatform/deviceInfo not used in this bridge
    this.#receiverId = receiverId;
    this.#deviceInfo = deviceInfo;
  }

  getDeviceInfo(): SmartCardDeviceInfo {
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

// Card implementation
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

// EmulatedCard implementation (stubs)
export class AndroidEmulatedCard extends EmulatedCard {
  #receiverId: string;
  #parentDevice: AndroidNfcReader;
  #released = false;

  constructor(receiverId: string, parentDevice: AndroidNfcReader) {
    super(parentDevice);
    this.#receiverId = receiverId;
    this.#parentDevice = parentDevice;
  }

  isActive(): boolean {
    this.#assertNotReleased();
    // Not implemented: always true for now
    return !this.#released;
  }

  async setApduHandler(): Promise<void> {
    this.#assertNotReleased();
    // Not implemented
    throw new Error("setApduHandler not implemented");
  }

  async setStateChangeHandler(): Promise<void> {
    this.#assertNotReleased();
    // Not implemented
    throw new Error("setStateChangeHandler not implemented");
  }

  async release(): Promise<void> {
    if (this.#released) return;
    // Not implemented: should call JsApduModule.releaseEmulatedCard
    this.#released = true;
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("EmulatedCard already released");
  }
}

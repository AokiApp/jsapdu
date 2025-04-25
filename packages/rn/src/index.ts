import {
  EmulatedCard,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
  SmartCardPlatformManager,
} from "@aokiapp/interface/src/abstracts";

export class AndroidNfcPlatformManager extends SmartCardPlatformManager {
  getPlatform(): SmartCardPlatform {
    throw new Error("Hey AI, please implement this");
  }
}

export class DAndroidNfcPlatform extends SmartCardPlatform {
  constructor() {
    super();
  }
  async init(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
  async release(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
  async getDevices(): Promise<SmartCardDeviceInfo[]> {
    throw new Error("Hey AI, please implement this");
  }
}

export class AndroidNfcReaderInfo extends SmartCardDeviceInfo {
  constructor() {
    super();
  }
  get id(): string {
    throw new Error("Hey AI, please implement this");
  }
  get devicePath(): string | undefined {
    throw new Error("Hey AI, please implement this");
  }
  get friendlyName(): string | undefined {
    throw new Error("Hey AI, please implement this");
  }
  get description(): string | undefined {
    throw new Error("Hey AI, please implement this");
  }
  get supportsApdu(): boolean {
    throw new Error("Hey AI, please implement this");
  }
  get supportsHce(): boolean {
    throw new Error("Hey AI, please implement this");
  }
  get isIntegratedDevice(): boolean {
    throw new Error("Hey AI, please implement this");
  }
  get isRemovableDevice(): boolean {
    throw new Error("Hey AI, please implement this");
  }
  get d2cProtocol(): "iso7816" | "nfc" | "other" | "unknown" {
    throw new Error("Hey AI, please implement this");
  }
  get p2dProtocol(): "usb" | "ble" | "nfc" | "other" | "unknown" {
    throw new Error("Hey AI, please implement this");
  }
  get apduApi(): string[] {
    throw new Error("Hey AI, please implement this");
  }
  async acquireDevice(): Promise<SmartCardDevice> {
    throw new Error("Hey AI, please implement this");
  }
}

export class AndroidNfcReader extends SmartCardDevice {
  constructor(
    parentPlatform: SmartCardPlatform,
    deviceInfo: SmartCardDeviceInfo,
  ) {
    super(parentPlatform, deviceInfo);
  }
  getDeviceInfo(): SmartCardDeviceInfo {
    throw new Error("Hey AI, please implement this");
  }
  isActive(): boolean {
    throw new Error("Hey AI, please implement this");
  }
  async isCardPresent(): Promise<boolean> {
    throw new Error("Hey AI, please implement this");
  }
  async startSession(): Promise<SmartCard> {
    throw new Error("Hey AI, please implement this");
  }
  async startHceSession(): Promise<EmulatedCard> {
    throw new Error("Hey AI, please implement this");
  }
  async release(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
}

export class AndroidNfcCard extends SmartCard {
  constructor(parentDevice: SmartCardDevice) {
    super(parentDevice);
  }
  async getAtr(): Promise<Uint8Array> {
    throw new Error("Hey AI, please implement this");
  }
  async transmit(): Promise<any> {
    throw new Error("Hey AI, please implement this");
  }
  async reset(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
  async release(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
}

export class AndroidEmulatedCard extends EmulatedCard {
  constructor(parentDevice: SmartCardDevice) {
    super(parentDevice);
  }
  isActive(): boolean {
    throw new Error("Hey AI, please implement this");
  }
  async setApduHandler(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
  async setStateChangeHandler(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
  async release(): Promise<void> {
    throw new Error("Hey AI, please implement this");
  }
}

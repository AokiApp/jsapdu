import {
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardPlatform,
  SmartCardPlatformManager,
} from ".";
import { PcscDevicesManager, Device, CommandApdu } from "smartcardx";

export class PcscPlatformManager extends SmartCardPlatformManager {
  public getPlatform() {
    return new PcscPlatform();
  }
}

export class PcscPlatform extends SmartCardPlatform {
  public devicesManager: PcscDevicesManager;

  constructor() {
    super();
    this.devicesManager = new PcscDevicesManager();
  }

  public async init() {
    await this.devicesManager.onActivated();
    this.initialized = true;
  }

  public async release() {
    this.devicesManager.close();
    this.initialized = false;
  }

  public async getDevices(): Promise<PcscDeviceInfo[]> {
    this.assertInitialized();
    const devices: { [key: string]: Device } = this.devicesManager.devices;
    return Object.values(devices).map(
      (device) => new PcscDeviceInfo(device, this),
    );
  }
}

export class PcscDeviceInfo extends SmartCardDeviceInfo {
  public device: Device;
  public parentPlatform: PcscPlatform;

  constructor(device: Device, parentPlatform: PcscPlatform) {
    super();
    this.device = device;
    this.parentPlatform = parentPlatform;
  }

  public get id(): string {
    return this.device.name;
  }

  public get devicePath(): string | undefined {
    return undefined; // PC/SC doesn't expose device paths
  }

  public get friendlyName(): string | undefined {
    return this.device.name;
  }

  public get description(): string | undefined {
    return `PC/SC reader: ${this.device.name}`;
  }

  public get supportsApdu(): boolean {
    return true; // All PC/SC readers support APDU
  }

  public get supportsHce(): boolean {
    return false; // PC/SC doesn't support HCE
  }

  public get isIntegratedDevice(): boolean {
    return false; // Assume most PC/SC readers are removable
  }

  public get isRemovableDevice(): boolean {
    return true; // Assume most PC/SC readers are removable
  }

  public get d2cProtocol(): "iso7816" | "nfc" | "other" | "unknown" {
    return "iso7816"; // PC/SC typically uses ISO7816
  }

  public get p2dProtocol(): "usb" | "ble" | "nfc" | "other" | "unknown" {
    return "usb"; // Most PC/SC readers are USB
  }

  public get apduApi(): string[] {
    return ["pcsc"];
  }

  public async acquireDevice(): Promise<PcscDevice> {
    return new PcscDevice(this.parentPlatform, this);
  }
}

export class PcscDevice extends SmartCardDevice {
  public deviceInfo: PcscDeviceInfo;
  public platform: PcscPlatform;

  constructor(parentPlatform: PcscPlatform, deviceInfo: PcscDeviceInfo) {
    super(parentPlatform, deviceInfo);
    this.deviceInfo = deviceInfo;
    this.platform = parentPlatform;
  }

  public getDeviceInfo(): SmartCardDeviceInfo {
    return this.deviceInfo;
  }

  public isActive(): boolean {
    return (
      this.deviceInfo.device.reader.state === 0x20 ||
      this.deviceInfo.device.reader.state === 0x10
    ); // SCARD_STATE_PRESENT or SCARD_STATE_INUSE
  }

  public async isCardPresent(): Promise<boolean> {
    return (
      this.deviceInfo.device.reader.state === 0x20 ||
      this.deviceInfo.device.reader.state === 0x10
    ); // SCARD_STATE_PRESENT or SCARD_STATE_INUSE
  }

  public async startSession(): Promise<Pcsc> {
    return new Promise<Pcsc>((resolve) => {
      this.deviceInfo.device.once("card-inserted", () => {
        resolve(new Pcsc(this));
      });
    });
  }

  public async release(): Promise<void> {
    this.deviceInfo.device.reader.disconnect(
      this.deviceInfo.device.reader.SCARD_LEAVE_CARD,
      (err) => {
        if (err) {
          throw new Error(`Failed to disconnect: ${err.message}`);
        }
      },
    );
  }
}

export class Pcsc extends SmartCard {
  protected parentDevice: PcscDevice;

  constructor(parentDevice: PcscDevice) {
    super(parentDevice);
    this.parentDevice = parentDevice;
  }

  public async getAtr(): Promise<Uint8Array> {
    return this.parentDevice.deviceInfo.device.card!.atr;
  }

  public async transmit(apdu: CommandApdu) {
    const response =
      await this.parentDevice.deviceInfo.device.card!.issueCommand(apdu);
    return response;
  }

  public async reset(): Promise<void> {}

  public async release(): Promise<void> {}
}

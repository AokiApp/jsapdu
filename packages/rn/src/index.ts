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

/**
 * JavaScript side object registry
 * Similar to the native ObjectRegistry but for JavaScript objects
 */
class ObjectRegistry {
  // Map of receiver IDs to objects
  private static objects = new Map<string, any>();

  /**
   * Get an object by its receiver ID
   * @param id The receiver ID
   * @returns The object
   * @throws Error if the object is not found
   */
  static getObject<T>(id: string): T {
    const obj = this.objects.get(id);
    if (!obj) {
      throw new Error(`Object with ID ${id} not found`);
    }
    return obj as T;
  }

  /**
   * Register an object with a specific receiver ID
   * @param id The receiver ID
   * @param obj The object to register
   */
  static registerWithId(id: string, obj: any): void {
    this.objects.set(id, obj);
  }

  /**
   * Unregister an object by its receiver ID
   * @param id The receiver ID
   */
  static unregister(id: string): void {
    this.objects.delete(id);
  }

  /**
   * Check if an object with the given ID is registered
   * @param id The receiver ID
   * @returns True if the object is registered, false otherwise
   */
  static isRegistered(id: string): boolean {
    return this.objects.has(id);
  }
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
  // HCE/EmulatedCard
  sendApduResponse(receiverId: string, responseData: number[]): Promise<void>;
  releaseEmulatedCard(receiverId: string): Promise<void>;

  // Event emitter methods
  addListener(eventName: string, listener: (event: any) => void): void;
  removeListener(eventName: string, listener: (event: any) => void): void;
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

// EmulatedCard implementation (HCE)
export class AndroidEmulatedCard extends EmulatedCard {
  #receiverId: string;
  #parentDevice: AndroidNfcReader;
  #released = false;
  #apduHandler: ((apdu: Uint8Array) => Promise<Uint8Array>) | null = null;
  #stateChangeHandler: ((state: string) => void) | null = null;

  // Flag to track if global listeners are initialized
  private static listenersInitialized = false;

  constructor(receiverId: string, parentDevice: AndroidNfcReader) {
    super(parentDevice);
    this.#receiverId = receiverId;
    this.#parentDevice = parentDevice;

    // Register this instance in the registry
    ObjectRegistry.registerWithId(receiverId, this);

    // Set up global event listeners if they don't exist yet
    if (!AndroidEmulatedCard.listenersInitialized) {
      JsApduModule.addListener(
        "onApduCommand",
        AndroidEmulatedCard.handleApduCommandEvent,
      );
      JsApduModule.addListener(
        "onHceStateChange",
        AndroidEmulatedCard.handleStateChangeEvent,
      );
      AndroidEmulatedCard.listenersInitialized = true;
    }
  }

  isActive(): boolean {
    this.#assertNotReleased();
    return !this.#released;
  }

  async setApduHandler(
    handler: (apdu: Uint8Array) => Promise<Uint8Array>,
  ): Promise<void> {
    this.#assertNotReleased();
    this.#apduHandler = handler;
  }

  async setStateChangeHandler(handler: (state: string) => void): Promise<void> {
    this.#assertNotReleased();
    this.#stateChangeHandler = handler;
  }

  async release(): Promise<void> {
    if (this.#released) return;

    // Unregister this instance from the registry
    ObjectRegistry.unregister(this.#receiverId);

    await JsApduModule.releaseEmulatedCard(this.#receiverId);
    this.#released = true;
  }

  #assertNotReleased() {
    if (this.#released) throw new Error("EmulatedCard already released");
  }

  // Static event handlers for proper routing
  private static async handleApduCommandEvent(event: {
    receiverId: string;
    apduCommand: number[];
  }) {
    try {
      // Get the instance from the registry
      const instance = ObjectRegistry.getObject<AndroidEmulatedCard>(
        event.receiverId,
      );

      // Check if the instance has an APDU handler
      if (!instance.#apduHandler) return;

      // Convert to Uint8Array and call handler
      const apduBytes = toUint8Array(event.apduCommand);
      const response = await instance.#apduHandler(apduBytes);

      // Send response back to native side
      await JsApduModule.sendApduResponse(
        event.receiverId,
        fromUint8Array(response),
      );
    } catch (error) {
      console.error("Error handling APDU command:", error);
      // If we can get the receiverId, send an error response
      if (event.receiverId) {
        await JsApduModule.sendApduResponse(
          event.receiverId,
          [0x6f, 0x00], // SW_UNKNOWN
        );
      }
    }
  }

  private static handleStateChangeEvent(event: {
    receiverId: string;
    state: string;
  }) {
    try {
      // Get the instance from the registry
      const instance = ObjectRegistry.getObject<AndroidEmulatedCard>(
        event.receiverId,
      );

      // Check if the instance has a state change handler
      if (!instance.#stateChangeHandler) return;

      // Call handler
      instance.#stateChangeHandler(event.state);
    } catch (error) {
      console.error("Error handling state change:", error);
    }
  }
}

import { requireNativeModule } from "expo-modules-core";

/**
 * EMA bridge interface
 */
export interface IJsApduModule {
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

export const JsApduModule = requireNativeModule(
  "JsApduModule",
)! as IJsApduModule;

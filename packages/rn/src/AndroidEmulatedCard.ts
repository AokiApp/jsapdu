import { EmulatedCard } from "@aokiapp/interface/src/abstracts";

import { AndroidNfcReader } from "./AndroidNfcReader";
import { JsApduModule } from "./JsApduModule";
import { ObjectRegistry } from "./ObjectRegistry";
// 後で作成
import { fromUint8Array, toUint8Array } from "./utils";

// ユーティリティをutils.tsに分離予定

/**
 * EmulatedCard implementation (HCE)
 */
export class AndroidEmulatedCard extends EmulatedCard {
  #receiverId: string;
  #parentDevice: AndroidNfcReader;
  #released = false;
  #apduHandler: ((apdu: Uint8Array) => Promise<Uint8Array>) | null = null;
  #stateChangeHandler: ((state: string) => void) | null = null;

  // Flag to track if global listeners are initialized
  private static listenersInitialized = false;
  // Counter to track active instances
  private static activeInstances = 0;

  constructor(receiverId: string, parentDevice: AndroidNfcReader) {
    super(parentDevice);
    this.#receiverId = receiverId;
    this.#parentDevice = parentDevice;

    // Register this instance in the registry
    ObjectRegistry.registerWithId(receiverId, this);

    // Increment active instances counter
    AndroidEmulatedCard.activeInstances++;

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

    // Clear handlers to prevent memory leaks
    this.#apduHandler = null;
    this.#stateChangeHandler = null;

    await JsApduModule.releaseEmulatedCard(this.#receiverId);
    this.#released = true;

    // Decrement active instances counter
    AndroidEmulatedCard.activeInstances--;

    // If no more active instances, remove global listeners
    if (
      AndroidEmulatedCard.activeInstances === 0 &&
      AndroidEmulatedCard.listenersInitialized
    ) {
      JsApduModule.removeListener(
        "onApduCommand",
        AndroidEmulatedCard.handleApduCommandEvent,
      );
      JsApduModule.removeListener(
        "onHceStateChange",
        AndroidEmulatedCard.handleStateChangeEvent,
      );
      AndroidEmulatedCard.listenersInitialized = false;
    }
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

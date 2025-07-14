import {
  EmulatedCard,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardError,
} from "@aokiapp/interface";
import {
  PcscErrorCode,
  SCARD_LEAVE_CARD,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_SHARE_SHARED,
  SCardConnect,
  SCardDisconnect,
} from "@aokiapp/pcsc-ffi-node";

import { PcscCard } from "./card.js";
import { PcscDeviceInfo } from "./device-info.js";
import { PcscPlatform } from "./platform.js";
import {
  callSCardStatus,
  ensureScardSuccess,
  getReaderCurrentState,
} from "./utils.js";
import { AsyncMutex } from "./utils.js";

/**
 * Implementation of SmartCardDevice for PC/SC
 */
export class PcscDevice extends SmartCardDevice {
  private deviceInfo: PcscDeviceInfo;
  private active: boolean = true;
  private cardHandle: number | null;
  protected card: PcscCard | null = null;
  protected readerName: string;
  protected context: number;
  private activeProtocol: number;
  private onReleaseCallback: (() => void) | null;
  private mutex = new AsyncMutex();

  /**
   * Creates a new PcscDevice instance
   * @param parentPlatform - The parent platform
   * @param readerName - The name of the reader
   * @param context - The PC/SC context handle
   * @param cardHandle - The PC/SC card handle (acquired at construction)
   * @param activeProtocol - The active protocol (acquired at construction)
   * @param onReleaseCallback - Called when device is released (for platform map cleanup)
   */
  constructor(
    parentPlatform: PcscPlatform,
    readerName: string,
    context: number,
    cardHandle: number | null,
    activeProtocol: number,
    onReleaseCallback: (() => void) | null = null,
  ) {
    super(parentPlatform);
    this.readerName = readerName;
    this.context = context;
    this.cardHandle = cardHandle;
    this.activeProtocol = activeProtocol;
    this.deviceInfo = new PcscDeviceInfo(readerName);
    this.onReleaseCallback = onReleaseCallback;
  }

  /**
   * Get the device information
   */
  public getDeviceInfo(): SmartCardDeviceInfo {
    return this.deviceInfo;
  }

  /**
   * Whether the device currently has an active card session
   */
  public isSessionActive(): boolean {
    return this.card !== null && this.card.isActive();
  }

  /**
   * Check whether the reader itself is available (irrespective of card presence)
   */
  public async isDeviceAvailable(): Promise<boolean> {
    // If this device instance already has an active session, it's available by definition
    if (this.isSessionActive()) {
      return true;
    }

    try {
      const hCard = [0];
      const activeProtocol = [0];
      const _ret = SCardConnect(
        this.context,
        this.readerName,
        SCARD_SHARE_SHARED,
        SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
        hCard,
        activeProtocol,
      );
      const ret = _ret < 0 ? _ret + 0x100000000 : _ret;

      if (ret === PcscErrorCode.SCARD_S_SUCCESS) {
        // Reader is free; disconnect immediately and return true
        SCardDisconnect(hCard[0], SCARD_LEAVE_CARD);
        return true;
      }

      // Reader exists, card might be absent; still considered available
      if (
        ret === PcscErrorCode.SCARD_E_NO_SMARTCARD ||
        ret === PcscErrorCode.SCARD_W_REMOVED_CARD
      ) {
        return true;
      }

      // Sharing violation or other errors mean reader is busy/unavailable
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if a card is present in the reader
   * @throws {SmartCardError} If check fails
   */
  public async isCardPresent(): Promise<boolean> {
    try {
      // Use existing handle if we already have one
      if (this.cardHandle !== null) {
        await callSCardStatus(this.cardHandle);
        return true;
      }

      // Use getReaderCurrentState to check card presence without connecting
      const readerState = await getReaderCurrentState(
        this.context,
        this.readerName,
      );

      // Check if card is present based on state flags
      return (
        readerState.state.includes("present") &&
        !readerState.state.includes("empty")
      );
    } catch (error) {
      if (
        error instanceof SmartCardError &&
        error.code === "CARD_NOT_PRESENT"
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Start a session with the card
   * @throws {SmartCardError} If session start fails
   */
  public async startSession(): Promise<SmartCard> {
    return this.mutex.lock(async () => {
      if (this.card !== null && this.card.isActive()) {
        return this.card;
      }

      if (!(await this.isCardPresent())) {
        throw new SmartCardError(
          "CARD_NOT_PRESENT",
          "No card present in reader",
        );
      }

      // Open a connection to the card if we don't have one yet
      if (this.cardHandle === null) {
        const hCard = [0];
        const activeProtocol = [0];
        const ret = SCardConnect(
          this.context,
          this.readerName,
          SCARD_SHARE_SHARED,
          SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
          hCard,
          activeProtocol,
        );
        ensureScardSuccess(ret);
        this.cardHandle = hCard[0];
        this.activeProtocol = activeProtocol[0];
      }

      this.card = new PcscCard(this, this.cardHandle, this.activeProtocol);
      return this.card;
    });
  }

  /**
   * Wait for a card to be present
   * @param timeout - Timeout in milliseconds
   * @throws {SmartCardError} If timeout is reached or card is not present
   */
  public async waitForCardPresence(timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.isCardPresent()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new SmartCardError("TIMEOUT", "Timed out waiting for card presence");
  }

  /**
   * Start an HCE session
   * @throws {SmartCardError} Always throws as PC/SC doesn't support HCE
   */
  public async startHceSession(): Promise<EmulatedCard> {
    throw new SmartCardError(
      "UNSUPPORTED_OPERATION",
      "PC/SC does not support Host Card Emulation",
    );
  }

  /**
   * Release the device and its card session
   * @throws {SmartCardError} If release fails
   */
  public async release(): Promise<void> {
    await this.mutex.lock(async () => {
      if (!this.active) {
        return; // Already released
      }
      let cardReleaseError: Error | undefined = undefined;
      try {
        // Release the card if we have one
        if (this.card !== null && this.card.isActive()) {
          await this.card.release().catch((e) => {
            cardReleaseError = e;
          });
        }
      } finally {
        // Disconnect from the card if we have a handle
        try {
          if (this.cardHandle !== null) {
            const ret = SCardDisconnect(this.cardHandle, SCARD_LEAVE_CARD);
            ensureScardSuccess(ret);
            this.cardHandle = null;
          }
        } finally {
          this.active = false;
          if (this.onReleaseCallback) {
            this.onReleaseCallback();
          }
        }
      }
      if (cardReleaseError) {
        throw new SmartCardError(
          "PLATFORM_ERROR",
          "Failed to release card during device release",
          cardReleaseError,
        );
      }
    });
  }
}

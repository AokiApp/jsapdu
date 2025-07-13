import {
  PcscErrorCode,
  SCARD_LEAVE_CARD,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_SHARE_SHARED,
  SCardConnect,
  SCardDisconnect,
  SCardStatus,
} from "@aokiapp/pcsc-ffi-node/src/index.js";

import {
  EmulatedCard,
  SmartCard,
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardError,
} from "../../interface/src/index.js";
import { PcscCard } from "./card.js";
import { PcscDeviceInfo } from "./device-info.js";
import { PcscPlatform } from "./platform.js";
import { ensureScardSuccess } from "./utils.js";
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
    cardHandle: number,
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
   * Check if the device is active
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Check if a card is present in the reader
   * @throws {SmartCardError} If check fails
   */
  public async isCardPresent(): Promise<boolean> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Device is not active");
    }

    try {
      // If we already have a card handle, check if it's still valid
      if (this.cardHandle !== null) {
        // Allocate buffers for SCardStatus
        const readerNameBuffer = Buffer.alloc(256);
        const readerNameLength = [readerNameBuffer.length];
        const state = [0];
        const protocol = [0];
        const atrBuffer = Buffer.alloc(36); // MAX_ATR_SIZE
        const atrLength = [atrBuffer.length];

        // Get card status
        const ret = SCardStatus(
          this.cardHandle,
          readerNameBuffer,
          readerNameLength,
          state,
          protocol,
          atrBuffer,
          atrLength,
        );

        // If the status is successful, the card is present
        return ret === PcscErrorCode.SCARD_S_SUCCESS;
      }

      // If we don't have a card handle, try to connect to the card
      const hCard = [0];
      const pdwActiveProtocol = [0];
      const ret = SCardConnect(
        this.context,
        this.readerName,
        SCARD_SHARE_SHARED,
        SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
        hCard,
        pdwActiveProtocol,
      );

      // If the connection is successful, disconnect immediately and return true
      if (ret === PcscErrorCode.SCARD_S_SUCCESS) {
        const cardHandle = hCard[0];
        SCardDisconnect(cardHandle, SCARD_LEAVE_CARD);
        return true;
      }

      // If the error is SCARD_E_NO_SMARTCARD, the card is not present
      if (ret === PcscErrorCode.SCARD_E_NO_SMARTCARD) {
        return false;
      }

      // For any other error, throw an exception
      throw new SmartCardError(
        "READER_ERROR",
        `Failed to check card presence: ${ret}`,
      );
    } catch (error) {
      throw new SmartCardError(
        "READER_ERROR",
        "Failed to check card presence",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Start a session with the card
   * @throws {SmartCardError} If session start fails
   */
  public async startSession(): Promise<SmartCard> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Device is not active");
    }

    // Check if we already have an active card session
    if (this.card !== null && this.card.isActive()) {
      return this.card;
    }

    // 既にハンドルを持っている前提でカードを生成
    if (this.cardHandle == null) {
      throw new SmartCardError("NOT_CONNECTED", "No card handle available");
    }
    this.card = new PcscCard(this, this.cardHandle, this.activeProtocol);
    return this.card;
  }

  /**
   * Wait for a card to be present
   * @param timeout - Timeout in milliseconds
   * @throws {SmartCardError} If timeout is reached or card is not present
   */
  public async waitForCardPresence(timeout: number): Promise<void> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Device is not active");
    }

    if (timeout <= 0) {
      throw new SmartCardError(
        "INVALID_PARAMETER",
        "Timeout must be greater than 0",
      );
    }

    const startTime = Date.now();
    let isPresent = await this.isCardPresent();

    while (!isPresent) {
      // Check if timeout has been reached
      if (Date.now() - startTime > timeout) {
        throw new SmartCardError(
          "TIMEOUT",
          "Timeout waiting for card presence",
        );
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
      isPresent = await this.isCardPresent();
    }
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
            await ensureScardSuccess(ret);
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

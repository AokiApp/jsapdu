import {
  CommandApdu,
  ResponseApdu,
  SmartCard,
  SmartCardError,
} from "@aokiapp/interface";
import {
  SCARD_PCI_T0,
  SCARD_PCI_T1,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_RESET_CARD,
  SCardBeginTransaction,
  SCardEndTransaction,
  SCardTransmit,
} from "@aokiapp/pcsc-ffi-node";

import { PcscDevice } from "./device.js";
import { ensureScardSuccess, callSCardStatus } from "./utils.js";

/**
 * Implementation of SmartCard for PC/SC
 */
export class PcscCard extends SmartCard {
  private atr: Uint8Array | null = null;
  private protocol: number;
  private active: boolean = true;

  /**
   * Creates a new PcscCard instance
   * @param parentDevice - The parent device
   * @param cardHandle - The PC/SC card handle
   * @param protocol - The active protocol
   */
  constructor(
    parentDevice: PcscDevice,
    private cardHandle: number,
    protocol: number,
  ) {
    super(parentDevice);
    this.protocol = protocol;
  }

  /**
   * Get ATR (Answer To Reset)
   * @throws {SmartCardError} If operation fails
   */
  public async getAtr(): Promise<Uint8Array> {
    if (this.atr) {
      return this.atr;
    }

    const statusResult = await callSCardStatus(this.cardHandle);
    this.atr = statusResult.atr;

    return this.atr;
  }

  /**
   * Transmit APDU command to the card
   * @throws {SmartCardError} If transmission fails
   */
  public async transmit(apdu: CommandApdu): Promise<ResponseApdu> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Card session is not active");
    }

    // Get command bytes
    const commandBytes = apdu.toUint8Array();
    const commandBuffer = Buffer.from(commandBytes);

    // --- 修正ここから ---
    // レスポンスバッファサイズをAPDUのLe値に応じて確保
    let responseBufferSize = 258;
    if (apdu.le && apdu.le > 0) {
      responseBufferSize = apdu.le + 2; // SW1/SW2分
      if (responseBufferSize > 65538) responseBufferSize = 65538;
    }
    const responseBuffer = Buffer.alloc(responseBufferSize);
    const responseLength = [responseBuffer.length];
    // --- 修正ここまで ---

    // Select protocol
    const pioSendPci =
      this.protocol === SCARD_PROTOCOL_T0 ? SCARD_PCI_T0 : SCARD_PCI_T1;

    // Create a mutable object for receive PCI
    const pioRecvPci = {
      dwProtocol: 0,
      cbPciLength: 8, // sizeof(SCARD_IO_REQUEST)
    };

    // Begin transaction to ensure exclusive access during APDU exchange
    let ret = SCardBeginTransaction(this.cardHandle);
    ensureScardSuccess(ret);

    try {
      // Transmit APDU
      ret = SCardTransmit(
        this.cardHandle,
        pioSendPci,
        commandBuffer,
        commandBuffer.length,
        pioRecvPci,
        responseBuffer,
        responseLength,
      );
      ensureScardSuccess(ret);

      // Extract response
      const actualLength = responseLength[0];
      const responseBytes = new Uint8Array(
        responseBuffer.slice(0, actualLength),
      );

      // Create ResponseApdu
      return ResponseApdu.fromUint8Array(responseBytes);
    } finally {
      // End transaction
      SCardEndTransaction(this.cardHandle, 0); // SCARD_LEAVE_CARD
    }
  }

  /**
   * Reset the card
   * @throws {SmartCardError} If reset fails
   */
  public async reset(): Promise<void> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Card session is not active");
    }

    // End transaction with reset disposition
    const ret = SCardEndTransaction(this.cardHandle, SCARD_RESET_CARD);
    ensureScardSuccess(ret);

    // Clear cached ATR since it may change after reset
    this.atr = null;
  }

  /**
   * Release the session
   * @throws {SmartCardError} If release fails
   */
  public async release(): Promise<void> {
    if (!this.active) {
      return; // Already released
    }

    this.active = false;

    // The actual disconnection is handled by the device
    // This just marks the card as inactive
  }

  /**
   * Get the PC/SC card handle
   * @internal Used by PcscDevice to access the card handle
   */
  public getCardHandle(): number {
    return this.cardHandle;
  }

  /**
   * Check if the card session is active
   */
  public isActive(): boolean {
    return this.active;
  }
}

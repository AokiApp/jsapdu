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
  SCardStatus,
  SCardTransmit,
} from "@aokiapp/pcsc-ffi-node";

import { PcscDevice } from "./device.js";
import { ensureScardSuccess } from "./utils.js";

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

    // Allocate buffers for SCardStatus
    // --- Windowsワイドモード対応ここから ---
    const isWindows = process.platform === "win32";
    const charSize = isWindows ? 2 : 1;
    const encoding: BufferEncoding = isWindows ? "utf16le" : "utf8";
    // --- ここまで ---
    const readerNameBuffer = Buffer.alloc(256 * charSize);
    const readerNameLength = [256];
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

    await ensureScardSuccess(ret);

    // Extract ATR
    const atrSize = atrLength[0];
    this.atr = new Uint8Array(atrBuffer.slice(0, atrSize));

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

    // Prepare response buffer
    const responseBuffer = Buffer.alloc(258); // Max response size (256 data bytes + 2 status bytes)
    const responseLength = [responseBuffer.length];

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
    await ensureScardSuccess(ret);

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
      await ensureScardSuccess(ret);

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
    await ensureScardSuccess(ret);

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

import {
  CommandApdu,
  ResponseApdu,
  SmartCard,
  SmartCardError,
} from "@aokiapp/jsapdu-interface";
import {
  SCARD_PCI_T0,
  SCARD_PCI_T1,
  SCARD_PROTOCOL_T0,
  SCARD_RESET_CARD,
  SCardEndTransaction,
  SCardTransmit,
} from "@aokiapp/pcsc-ffi-node";

import { PcscDevice } from "./device.js";
import { callSCardStatus, ensureScardSuccess } from "./utils.js";

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
   * Transmit command to the card
   * - APDU: CommandApdu -> ResponseApdu
   * - Raw frame: Uint8Array -> Uint8Array
   * @throws {SmartCardError} If transmission fails
   * @throws {SmartCardError} If session is not active
   */
  public transmit(apdu: CommandApdu): Promise<ResponseApdu>;
  public transmit(apdu: Uint8Array): Promise<Uint8Array>;
  public transmit(apdu: CommandApdu | Uint8Array): Promise<ResponseApdu | Uint8Array> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Card session is not active");
    }

    // Prepare command buffer with proper narrowing
    let commandBytes: Uint8Array;
    if (apdu instanceof CommandApdu) {
      commandBytes = apdu.toUint8Array();
    } else {
      commandBytes = apdu; // Uint8Array
    }
    const commandBuffer = Buffer.from(commandBytes);

    // Prepare response buffer
    let responseBufferSize = 258;
    if (apdu instanceof CommandApdu) {
      const le = apdu.le;
      if (le && le > 0) {
        responseBufferSize = Math.min(65538, le + 2); // include SW1/SW2
      }
    } else {
      // For raw frames, use a generous buffer (min 258, max 65538)
      responseBufferSize = Math.min(65538, Math.max(258, commandBuffer.length + 2));
    }
    const responseBuffer = Buffer.alloc(responseBufferSize);
    const responseLength = [responseBuffer.length];

    // Select protocol
    const pioSendPci =
      this.protocol === SCARD_PROTOCOL_T0 ? SCARD_PCI_T0 : SCARD_PCI_T1;

    // Create a mutable object for receive PCI
    const pioRecvPci = {
      dwProtocol: 0,
      cbPciLength: 8, // sizeof(SCARD_IO_REQUEST)
    };

    // Transmit
    const ret = SCardTransmit(
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
    const responseBytes = new Uint8Array(responseBuffer.slice(0, actualLength));

    // Return according to input type
    if (apdu instanceof CommandApdu) {
      return Promise.resolve(ResponseApdu.fromUint8Array(responseBytes));
    }
    return Promise.resolve(responseBytes);
  }

  /**
   * Reset the card
   * @throws {SmartCardError} If reset fails
   */
  public reset(): Promise<void> {
    if (!this.active) {
      throw new SmartCardError("NOT_CONNECTED", "Card session is not active");
    }

    // End transaction with reset disposition
    const ret = SCardEndTransaction(this.cardHandle, SCARD_RESET_CARD);
    ensureScardSuccess(ret);

    // Clear cached ATR since it may change after reset
    this.atr = null;
    return Promise.resolve();
  }

  /**
   * Release the session
   * @throws {SmartCardError} If release fails
   */
  public release(): Promise<void> {
    if (!this.active) {
      return Promise.resolve(); // Already released
    }

    this.active = false;

    // The actual disconnection is handled by the device
    // This just marks the card as inactive
    return Promise.resolve();
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

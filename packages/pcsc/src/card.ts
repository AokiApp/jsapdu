import {
  CommandApdu,
  ResponseApdu,
  SmartCard,
  SmartCardError,
  SmartCardLogicalChannel,
} from "@aokiapp/jsapdu-interface";
import {
  SCARD_PCI_T0,
  SCARD_PCI_T1,
  SCARD_PROTOCOL_T0,
  SCARD_RESET_CARD,
  SCARD_LEAVE_CARD,
  SCardBeginTransaction,
  SCardEndTransaction,
  SCardTransmit,
} from "@aokiapp/pcsc-ffi-node";

import { PcscDevice } from "./device.js";
import { callSCardStatus, ensureScardSuccess, AsyncMutex } from "./utils.js";

/**
 * Card state enum following Java implementation
 */
enum CardState {
  OK = "OK",
  REMOVED = "REMOVED",
  DISCONNECTED = "DISCONNECTED"
}

/**
 * Implementation of SmartCard for PC/SC
 */
export class PcscCard extends SmartCard {
  private atr: Uint8Array | null = null;
  private protocol: number;
  private state: CardState = CardState.OK;
  private exclusiveMutex = new AsyncMutex();
  private exclusiveActive: boolean = false;
  private channel: number = 0; // Logical channel number (0 = basic channel)

  /**
   * Creates a new PcscCard instance
   * @param parentDevice - The parent device
   * @param cardHandle - The PC/SC card handle
   * @param protocol - The active protocol
   * @param channel - The logical channel number (default: 0 for basic channel)
   */
  constructor(
    parentDevice: PcscDevice,
    private cardHandle: number,
    protocol: number,
    channel: number = 0,
  ) {
    super(parentDevice);
    this.protocol = protocol;
    this.channel = channel;
  }

  /**
   * Check card state and throw appropriate error if not OK
   * @throws {SmartCardError} If card state is not OK
   */
  protected checkState(): void {
    switch (this.state) {
      case CardState.DISCONNECTED:
        throw new SmartCardError("NOT_CONNECTED", "Card has been disconnected");
      case CardState.REMOVED:
        throw new SmartCardError("CARD_NOT_PRESENT", "Card has been removed");
      case CardState.OK:
        // OK state, continue
        break;
      default:
        throw new SmartCardError("PLATFORM_ERROR", `Unknown card state: ${this.state}`);
    }
  }

  /**
   * Handle PC/SC errors and update card state accordingly
   * @param error - The error to handle
   */
  private handleError(error: unknown): void {
    if (error instanceof SmartCardError) {
      const smartCardError = error as SmartCardError;
      if (smartCardError.code === "CARD_NOT_PRESENT" || smartCardError.code === "NOT_CONNECTED") {
        this.state = CardState.REMOVED;
      }
    }
  }

  /**
   * Get ATR (Answer To Reset)
   * @throws {SmartCardError} If operation fails
   */
  public async getAtr(): Promise<Uint8Array> {
    this.checkState();
    
    if (this.atr) {
      return this.atr;
    }

    try {
      const statusResult = await callSCardStatus(this.cardHandle);
      this.atr = statusResult.atr;
      return this.atr;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Transmit APDU command to the card
   * @throws {SmartCardError} If transmission fails
   */
  public async transmit(apdu: CommandApdu): Promise<ResponseApdu> {
    this.checkState();

    try {
      return await this.doTransmit(apdu);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Internal transmit with automatic 61xx/6Cxx handling
   * Following Java implementation in ChannelImpl.doTransmit()
   * @param apdu - The command APDU to transmit
   * @returns Promise<ResponseApdu> - Complete response after automatic processing
   */
  private async doTransmit(apdu: CommandApdu): Promise<ResponseApdu> {
    const MAX_RESPONSE_ITERATIONS = 256; // Java同様の制限
    let command = apdu.toUint8Array();
    let result = new Uint8Array(0);
    let iterations = 0;

    while (true) {
      if (++iterations > MAX_RESPONSE_ITERATIONS) {
        throw new SmartCardError(
          "TRANSMISSION_ERROR",
          `Number of response iterations exceeded maximum ${MAX_RESPONSE_ITERATIONS}`
        );
      }

      const response = await this.rawTransmit(command);
      const responseLength = response.length;

      if (responseLength >= 2) {
        const sw1 = response[responseLength - 2];
        const sw2 = response[responseLength - 1];

        // 6Cxx: Wrong Le field, resend with correct Le
        if (sw1 === 0x6C) {
          // Update Le field with SW2
          if (command.length >= 5) {
            command = new Uint8Array(command);
            command[command.length - 1] = sw2;
            continue;
          }
        }

        // 61xx: More data available, issue GET RESPONSE
        if (sw1 === 0x61) {
          // Concatenate current response data (excluding SW1/SW2)
          if (responseLength > 2) {
            const newResult = new Uint8Array(result.length + responseLength - 2);
            newResult.set(result);
            newResult.set(response.slice(0, -2), result.length);
            result = newResult;
          }

          // Create GET RESPONSE command
          // Preserve CLA from original command
          const cla = command.length > 0 ? command[0] : 0x00;
          command = new Uint8Array([cla, 0xC0, 0x00, 0x00, sw2]);
          continue;
        }
      }

      // Final response - concatenate with accumulated data
      const finalResult = new Uint8Array(result.length + responseLength);
      finalResult.set(result);
      finalResult.set(response, result.length);

      return ResponseApdu.fromUint8Array(finalResult);
    }
  }

  /**
   * Check MANAGE CHANNEL command and throw error if found
   * Following Java ChannelImpl.checkManageChannel()
   * @param command - Command bytes to check
   */
  private checkManageChannel(command: Uint8Array): void {
    if (command.length >= 4 && command[0] >= 0 && command[1] === 0x70) {
      throw new SmartCardError(
        "INVALID_PARAMETER",
        "Manage channel command not allowed, use openLogicalChannel()"
      );
    }
  }

  /**
   * Validate APDU based on protocol constraints
   * @param command - Command bytes to validate
   */
  private validateProtocolConstraints(command: Uint8Array): void {
    // Check for prohibited MANAGE CHANNEL commands
    this.checkManageChannel(command);
    
    // T=0 protocol constraints (following Java ChannelImpl)
    if (this.protocol === SCARD_PROTOCOL_T0) {
      // Check for extended length APDUs (forbidden in T=0)
      if (command.length >= 7 && command[4] === 0) {
        throw new SmartCardError(
          "PROTOCOL_ERROR",
          "Extended length forms not supported for T=0"
        );
      }
    }
  }

  /**
   * Strip Le field if needed based on protocol
   * @param command - Original command
   * @returns Modified command with Le stripped if needed
   */
  private stripLeIfNeeded(command: Uint8Array): Uint8Array {
    const isT0 = this.protocol === SCARD_PROTOCOL_T0;
    
    if (isT0 && command.length >= 7) {
      const lc = command[4] & 0xff;
      
      if (lc !== 0) {
        // Short form: check if Le should be stripped
        if (command.length === lc + 6) {
          return command.slice(0, -1); // Strip Le
        }
      } else {
        // Extended form: check if Le should be stripped
        const lcExtended = ((command[5] & 0xff) << 8) | (command[6] & 0xff);
        if (command.length === lcExtended + 9) {
          return command.slice(0, -2); // Strip extended Le
        }
      }
    }
    
    return command;
  }

  /**
   * Set logical channel number in CLA byte
   * Following Java ChannelImpl.setChannel() implementation
   * @param command - Command to modify
   */
  private setChannel(command: Uint8Array): void {
    if (this.channel === 0) {
      return; // Basic channel, no modification needed
    }

    const cla = command[0];
    if (cla < 0) {
      // Proprietary class format, cannot set logical channel
      return;
    }
    
    // Classes 001x xxxx is reserved for future use in ISO, ignore
    if ((cla & 0xe0) === 0x20) {
      return;
    }
    
    // See ISO 7816/2005, table 2 and 3
    if (this.channel <= 3) {
      // Mask of bits 7, 1, 0 (channel number)
      // 0xbc == 1011 1100
      command[0] = (command[0] & 0xbc) | this.channel;
    } else if (this.channel <= 19) {
      // Mask of bits 7, 3, 2, 1, 0 (channel number)
      // 0xb0 == 1011 0000
      command[0] = (command[0] & 0xb0) | 0x40 | (this.channel - 4);
    } else {
      throw new SmartCardError(
        "INVALID_PARAMETER",
        `Unsupported channel number: ${this.channel}`
      );
    }
  }

  /**
   * Raw APDU transmission without automatic processing
   * @param command - Command bytes to transmit
   * @returns Raw response from the card
   */
  public rawTransmit(command: Uint8Array): Promise<Uint8Array> {
    // Validate protocol constraints
    this.validateProtocolConstraints(command);
    
    // Apply protocol-specific modifications
    let processedCommand = this.stripLeIfNeeded(command);
    
    // Set logical channel in CLA byte
    processedCommand = new Uint8Array(processedCommand); // Make mutable copy
    this.setChannel(processedCommand);
    
    const commandBuffer = Buffer.from(processedCommand);

    // Calculate response buffer size
    let responseBufferSize = 258; // Default short APDU size
    if (processedCommand.length >= 5) {
      const le = processedCommand[processedCommand.length - 1];
      if (le === 0) {
        responseBufferSize = 256 + 2; // Le=0 means 256 bytes + SW
      } else {
        responseBufferSize = le + 2; // Le + SW1/SW2
      }
      if (responseBufferSize > 65538) responseBufferSize = 65538;
    }

    const responseBuffer = Buffer.alloc(responseBufferSize);
    const responseLength = [responseBuffer.length];

    // Select protocol
    const pioSendPci = this.protocol === SCARD_PROTOCOL_T0 ? SCARD_PCI_T0 : SCARD_PCI_T1;

    // Create a mutable object for receive PCI
    const pioRecvPci = {
      dwProtocol: 0,
      cbPciLength: 8, // sizeof(SCARD_IO_REQUEST)
    };

    // Transmit APDU
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
    return Promise.resolve(new Uint8Array(responseBuffer.slice(0, actualLength)));
  }

  /**
   * Reset the card
   * @throws {SmartCardError} If reset fails
   */
  public reset(): Promise<void> {
    this.checkState();

    try {
      // End transaction with reset disposition
      const ret = SCardEndTransaction(this.cardHandle, SCARD_RESET_CARD);
      ensureScardSuccess(ret);

      // Clear cached ATR since it may change after reset
      this.atr = null;
      return Promise.resolve();
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Release the session
   * @throws {SmartCardError} If release fails
   */
  public release(): Promise<void> {
    if (this.state === CardState.DISCONNECTED) {
      return Promise.resolve(); // Already released
    }

    this.state = CardState.DISCONNECTED;

    // The actual disconnection is handled by the device
    // This just marks the card as disconnected
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
    return this.state === CardState.OK;
  }

  /**
   * Get the current card state
   * @internal
   */
  public getState(): CardState {
    return this.state;
  }

  /**
   * Check if the card connection is valid
   * Pings the card to ensure it's still present and responsive
   * Following Java CardImpl.isValid() behavior
   * @throws {SmartCardError} If validation fails
   */
  public async isValid(): Promise<boolean> {
    if (this.state !== CardState.OK) {
      return false;
    }
    
    try {
      await callSCardStatus(this.cardHandle);
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  /**
   * Transmit control command to the card reader
   */
  public async transmitControlCommand(controlCode: number, command: Uint8Array): Promise<Uint8Array> {
    this.checkState();

    if (command.length === 0) {
      throw new SmartCardError("INVALID_PARAMETER", "Control command cannot be empty");
    }

    throw new SmartCardError(
      "UNSUPPORTED_OPERATION",
      "SCardControl is not available in current PC/SC FFI implementation"
    );
  }

  /**
   * Begin exclusive access to the card
   * Following Java CardImpl.beginExclusive() behavior
   * @throws {SmartCardError} If exclusive access fails or already active
   */
  public async beginExclusive(): Promise<void> {
    this.checkState();
    
    await this.exclusiveMutex.lock(async () => {
      if (this.exclusiveActive) {
        throw new SmartCardError(
          "ALREADY_CONNECTED",
          "Exclusive access has already been established"
        );
      }

      try {
        const ret = SCardBeginTransaction(this.cardHandle);
        ensureScardSuccess(ret);
        this.exclusiveActive = true;
      } catch (error) {
        this.handleError(error);
        throw new SmartCardError(
          "PLATFORM_ERROR",
          "beginExclusive() failed",
          error as Error
        );
      }
    });
  }

  /**
   * End exclusive access to the card
   * Following Java CardImpl.endExclusive() behavior
   * @throws {SmartCardError} If no exclusive access is active or operation fails
   */
  public async endExclusive(): Promise<void> {
    this.checkState();
    
    await this.exclusiveMutex.lock(async () => {
      if (!this.exclusiveActive) {
        throw new SmartCardError(
          "NOT_CONNECTED",
          "No exclusive access to end"
        );
      }

      try {
        const ret = SCardEndTransaction(this.cardHandle, SCARD_LEAVE_CARD);
        ensureScardSuccess(ret);
      } catch (error) {
        this.handleError(error);
        throw new SmartCardError(
          "PLATFORM_ERROR",
          "endExclusive() failed",
          error as Error
        );
      } finally {
        this.exclusiveActive = false;
      }
    });
  }

  /**
   * Check if exclusive access is currently active
   */
  public isExclusiveActive(): boolean {
    return this.exclusiveActive;
  }

  /**
   * Open a new logical channel to the card
   */
  public async openLogicalChannel(): Promise<SmartCardLogicalChannel> {
    this.checkState();

    // MANAGE CHANNEL (OPEN) command: CLA=0x00, INS=0x70, P1=0x00, P2=0x00, Le=0x01
    const openChannelCommand = new Uint8Array([0x00, 0x70, 0x00, 0x00, 0x01]);

    try {
      const response = await this.rawTransmit(openChannelCommand);
      
      // Response should be 3 bytes: [channel_number, SW1, SW2]
      if (response.length !== 3) {
        throw new SmartCardError(
          "PLATFORM_ERROR",
          `Invalid MANAGE CHANNEL response length: ${response.length}`
        );
      }

      // Check status words (should be 9000)
      const sw1 = response[1];
      const sw2 = response[2];
      if (sw1 !== 0x90 || sw2 !== 0x00) {
        throw new SmartCardError(
          "PLATFORM_ERROR",
          `MANAGE CHANNEL failed: SW=${sw1.toString(16).padStart(2, '0')}${sw2.toString(16).padStart(2, '0')}`
        );
      }

      const channelNumber = response[0];
      if (channelNumber === 0) {
        throw new SmartCardError(
          "PLATFORM_ERROR",
          "Card returned invalid channel number 0"
        );
      }

      return new PcscLogicalChannel(this, channelNumber);
    } catch (error) {
      this.handleError(error);
      throw new SmartCardError(
        "PLATFORM_ERROR",
        "openLogicalChannel() failed",
        error as Error
      );
    }
  }

  /**
   * Get SW (Status Word) from response
   * @param response - Response bytes
   * @returns SW as 16-bit value
   */
  private getSW(response: Uint8Array): number {
    if (response.length < 2) {
      return -1;
    }
    const sw1 = response[response.length - 2] & 0xff;
    const sw2 = response[response.length - 1] & 0xff;
    return (sw1 << 8) | sw2;
  }

  /**
   * Convert Uint8Array to hex string
   * @param array - Array to convert
   * @returns Hex string representation
   */
  private uint8ArrayToHexString(array: Uint8Array): string {
    return Array.from(array)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  /**
   * Get the logical channel number
   * @returns Channel number (0 for basic channel)
   */
  public getChannelNumber(): number {
    return this.channel;
  }
}

/**
 * Implementation of SmartCardLogicalChannel for PC/SC
 */
export class PcscLogicalChannel extends SmartCardLogicalChannel {
  constructor(parentCard: PcscCard, channelNumber: number) {
    super(parentCard, channelNumber);
  }

  /**
   * Transmit APDU on this logical channel
   */
  public async transmit(apdu: CommandApdu): Promise<ResponseApdu> {
    const pcscCard = this.parentCard as PcscCard;
    
    // Check if parent card is valid
    if (!(await pcscCard.isValid())) {
      throw new SmartCardError("NOT_CONNECTED", "Parent card is not valid");
    }

    // Create modified APDU with channel information
    const originalBytes = apdu.toUint8Array();
    const modifiedBytes = new Uint8Array(originalBytes);
    
    // Set logical channel in CLA byte
    this.setChannelInCLA(modifiedBytes);

    // Create new CommandApdu with modified bytes
    const modifiedApdu = new (apdu.constructor as any)(modifiedBytes);
    
    // Use parent card's transmit mechanism
    return await pcscCard.transmit(modifiedApdu);
  }

  /**
   * Close this logical channel
   */
  public async close(): Promise<void> {
    if (this.channelNumber === 0) {
      throw new SmartCardError(
        "INVALID_PARAMETER",
        "Cannot close basic logical channel"
      );
    }

    const pcscCard = this.parentCard as PcscCard;
    
    // Check if parent card is valid
    if (!(await pcscCard.isValid())) {
      throw new SmartCardError("NOT_CONNECTED", "Parent card is not valid");
    }

    // Send MANAGE CHANNEL (CLOSE) command
    const closeCommand = new Uint8Array([0x00, 0x70, 0x80, this.channelNumber]);
    this.setChannelInCLA(closeCommand);
    
    try {
      const response = await pcscCard.rawTransmit(closeCommand);
      
      // Check if close was successful (SW = 9000)
      if (response.length < 2 ||
          response[response.length - 2] !== 0x90 ||
          response[response.length - 1] !== 0x00) {
        throw new SmartCardError(
          "PLATFORM_ERROR",
          `Failed to close logical channel ${this.channelNumber}`
        );
      }
    } catch (error) {
      throw new SmartCardError(
        "PLATFORM_ERROR",
        `Error closing logical channel ${this.channelNumber}`,
        error as Error
      );
    }
  }

  /**
   * Set logical channel number in CLA byte according to ISO 7816-4
   */
  private setChannelInCLA(command: Uint8Array): void {
    if (command.length === 0) return;
    
    const cla = command[0] & 0xFF;
    
    // Skip proprietary CLA format
    if (cla < 0) return;
    
    // Skip reserved classes
    if ((cla & 0xE0) === 0x20) return;
    
    if (this.channelNumber <= 3) {
      // Channel 0-3: use bits 1,0 of CLA
      command[0] = (cla & 0xBC) | this.channelNumber;
    } else if (this.channelNumber <= 19) {
      // Channel 4-19: set bit 6, use bits 3,2,1,0 for (channel-4)
      command[0] = (cla & 0xB0) | 0x40 | (this.channelNumber - 4);
    } else {
      throw new SmartCardError(
        "INVALID_PARAMETER",
        `Unsupported channel number: ${this.channelNumber}`
      );
    }
  }
}

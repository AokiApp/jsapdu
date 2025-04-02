import { EventEmitter } from "node:events";
import { Buffer } from "node:buffer";
import { CardReader, PCSCLite, Status } from "../src/typesPcsclite";

/**
 * Mock implementation of PCSCLite for testing
 */
export class MockPCSCLite extends EventEmitter implements PCSCLite {
  private readers: MockCardReader[] = [];

  constructor(readerCount = 1) {
    super();
    for (let i = 0; i < readerCount; i++) {
      this.readers.push(new MockCardReader(`Mock Reader ${i + 1}`));
    }
    // Emit readers after a short delay to simulate real behavior
    setTimeout(() => {
      this.readers.forEach(reader => this.emit("reader", reader));
    }, 10);
  }

  public close(): void {
    this.readers.forEach(reader => reader.close());
    this.removeAllListeners();
  }
}

/**
 * Mock implementation of CardReader for testing
 */
export class MockCardReader extends EventEmitter implements CardReader {
  // Share Mode
  public readonly SCARD_SHARE_SHARED = 0x02;
  public readonly SCARD_SHARE_EXCLUSIVE = 0x01;
  public readonly SCARD_SHARE_DIRECT = 0x03;

  // Protocol
  public readonly SCARD_PROTOCOL_T0 = 0x01;
  public readonly SCARD_PROTOCOL_T1 = 0x02;
  public readonly SCARD_PROTOCOL_RAW = 0x04;

  // State
  public readonly SCARD_STATE_UNAWARE = 0x00;
  public readonly SCARD_STATE_IGNORE = 0x01;
  public readonly SCARD_STATE_CHANGED = 0x02;
  public readonly SCARD_STATE_UNKNOWN = 0x04;
  public readonly SCARD_STATE_UNAVAILABLE = 0x08;
  public readonly SCARD_STATE_EMPTY = 0x10;
  public readonly SCARD_STATE_PRESENT = 0x20;
  public readonly SCARD_STATE_ATRMATCH = 0x40;
  public readonly SCARD_STATE_EXCLUSIVE = 0x80;
  public readonly SCARD_STATE_INUSE = 0x100;
  public readonly SCARD_STATE_MUTE = 0x200;

  // Disconnect disposition
  public readonly SCARD_LEAVE_CARD = 0x00;
  public readonly SCARD_RESET_CARD = 0x01;
  public readonly SCARD_UNPOWER_CARD = 0x02;
  public readonly SCARD_EJECT_CARD = 0x03;

  public connected = false;
  public state = this.SCARD_STATE_PRESENT;
  private isClosed = false;
  private cardPresent = true;
  private mockAtr = Buffer.from([0x3B, 0x00]); // Simple mock ATR

  constructor(public readonly name: string) {
    super();
  }

  public SCARD_CTL_CODE(code: number): number {
    return code;
  }

  public get_status(
    cb: (err: Error | undefined | null, state: number, atr?: Buffer) => void
  ): void {
    if (this.isClosed) {
      cb(new Error("Reader is closed"), 0);
      return;
    }
    cb(null, this.state, this.cardPresent ? this.mockAtr : undefined);
  }

  public connect(
    cb: (err: Error | undefined | null, protocol: number) => void
  ): void;
  public connect(
    options: { share_mode?: number; protocol?: number },
    cb: (err: Error | undefined | null, protocol: number) => void
  ): void;
  public connect(
    optionsOrCallback: any,
    callback?: (err: Error | undefined | null, protocol: number) => void
  ): void {
    const cb = callback || optionsOrCallback;
    if (this.isClosed) {
      cb(new Error("Reader is closed"), 0);
      return;
    }
    if (!this.cardPresent) {
      cb(new Error("No card present"), 0);
      return;
    }
    this.connected = true;
    cb(null, this.SCARD_PROTOCOL_T1);
  }

  public disconnect(cb: (err: Error | undefined | null) => void): void;
  public disconnect(
    disposition: number,
    cb: (err: Error | undefined | null) => void
  ): void;
  public disconnect(
    dispositionOrCallback: any,
    callback?: (err: Error | undefined | null) => void
  ): void {
    const cb = callback || dispositionOrCallback;
    if (this.isClosed) {
      cb(new Error("Reader is closed"));
      return;
    }
    this.connected = false;
    cb(null);
  }

  public transmit(
    data: Buffer,
    res_len: number,
    protocol: number,
    cb: (err: Error | undefined | null, response: Buffer) => void
  ): void {
    if (this.isClosed) {
      cb(new Error("Reader is closed"), Buffer.alloc(0));
      return;
    }
    if (!this.connected) {
      cb(new Error("Card not connected"), Buffer.alloc(0));
      return;
    }
    if (!this.cardPresent) {
      cb(new Error("No card present"), Buffer.alloc(0));
      return;
    }

    // Mock response: echo back first byte + status words (90 00)
    const response = Buffer.alloc(3);
    response[0] = data[0];
    response[1] = 0x90;
    response[2] = 0x00;
    cb(null, response);
  }

  public control(
    data: Buffer,
    control_code: number,
    res_len: number,
    cb: (err: Error | undefined | null, response: Buffer) => void
  ): void {
    if (this.isClosed) {
      cb(new Error("Reader is closed"), Buffer.alloc(0));
      return;
    }

    // Mock security capabilities response
    const response = Buffer.alloc(4);
    response[0] = 0x03; // Hardware encryption + tamper detection
    response[1] = 0x04; // Max buffer size high byte
    response[2] = 0x00; // Max buffer size low byte
    response[3] = 0x03; // Supports SCP02 + SCP03
    cb(null, response);
  }

  public close(): void {
    if (!this.isClosed) {
      this.isClosed = true;
      this.connected = false;
      this.emit("end");
      this.removeAllListeners();
    }
  }

  // Test helper methods
  public mockCardRemoval(): void {
    this.cardPresent = false;
    this.state = this.SCARD_STATE_EMPTY;
    this.emit("status", { state: this.state } as Status);
  }

  public mockCardInsertion(): void {
    this.cardPresent = true;
    this.state = this.SCARD_STATE_PRESENT;
    this.emit("status", { state: this.state, atr: this.mockAtr } as Status);
  }

  public mockReaderError(): void {
    this.emit("error", new Error("Mock reader error"));
  }

  public mockDisconnect(): void {
    this.connected = false;
    this.emit("end");
  }
}
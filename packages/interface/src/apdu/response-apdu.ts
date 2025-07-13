export class ResponseApdu {
  public readonly data: Uint8Array<ArrayBuffer>;
  public readonly sw1: number;
  public readonly sw2: number;

  constructor(data: Uint8Array<ArrayBuffer>, sw1: number, sw2: number) {
    this.data = data;
    this.sw1 = sw1;
    this.sw2 = sw2;
  }

  public static fromUint8Array(
    byteArray: Uint8Array<ArrayBuffer>,
  ): ResponseApdu {
    if (!(byteArray instanceof Uint8Array)) {
      throw new TypeError("Input must be a Uint8Array.");
    }

    if (byteArray.length < 2) {
      throw new RangeError("Input is too short to be a valid APDU response.");
    }

    const data = byteArray.slice(0, byteArray.length - 2);
    const sw1 = byteArray[byteArray.length - 2];
    const sw2 = byteArray[byteArray.length - 1];

    return new ResponseApdu(data, sw1, sw2);
  }

  public toUint8Array(): Uint8Array<ArrayBuffer> {
    const byteArray = new Uint8Array(this.data.length + 2);
    byteArray.set(this.data, 0);
    byteArray[this.data.length] = this.sw1;
    byteArray[this.data.length + 1] = this.sw2;
    return byteArray;
  }

  public arrayBuffer(): ArrayBuffer {
    return this.data.buffer;
  }

  public get sw(): number {
    return (this.sw1 << 8) | this.sw2;
  }
}

import { describe, expect, test } from "vitest";

import { CommandApdu } from "../../src";

describe("CommandApdu class", () => {
  test("should create standard APDU command with data payload", () => {
    const CLA = 0x00;
    const INS = 0x00;
    const P1 = 0x01;
    const P2 = 0x02;
    const DATA = Uint8Array.from([0x03, 0x04]);
    const command = new CommandApdu(CLA, INS, P1, P2, DATA);
    expect(command.toUint8Array()).toEqual(
      Uint8Array.from([CLA, INS, P1, P2, 0x02, 0x03, 0x04]),
    );
  });

  test("should create APDU command with extended Le value and no data", () => {
    const CLA = 0x00;
    const INS = 0xb0;
    const P1 = 0x80;
    const P2 = 0x00;
    const LE = 0x10000;
    const command = new CommandApdu(CLA, INS, P1, P2, null, LE);
    expect(command.toUint8Array()).toEqual(
      Uint8Array.from([CLA, INS, P1, P2, 0x00, 0x00, 0x00]),
    );
  });

  test("should create APDU command with verify", () => {
    const CLA = 0x00;
    const INS = 0x20;
    const P1 = 0x00;
    const P2 = 0x80;
    const data = Uint8Array.from([]);
    const le = null;
    const command = new CommandApdu(CLA, INS, P1, P2, data, le);
    expect(command.toUint8Array()).toEqual(Uint8Array.from([CLA, INS, P1, P2]));
  });

  test("should throw error for invalid byte values", () => {
    expect(() => new CommandApdu(256, 0x00, 0x00, 0x00)).toThrowError(
      RangeError,
    );
    expect(() => new CommandApdu(-1, 0x00, 0x00, 0x00)).toThrowError(
      RangeError,
    );
    expect(() => new CommandApdu(0x00, 256, 0x00, 0x00)).toThrowError(
      RangeError,
    );
    expect(() => new CommandApdu(0x00, 0x00, -1, 0x00)).toThrowError(
      RangeError,
    );
  });

  test("should correctly convert APDU to hexadecimal string", () => {
    const command = new CommandApdu(
      0x00,
      0xa4,
      0x04,
      0x00,
      Uint8Array.from([0xd3, 0x92, 0xf0, 0x00]),
    );
    expect(command.toHexString()).toBe("00A4040004D392F000");
  });

  test("should parse APDU from Uint8Array (standard case 1)", () => {
    const bytes = Uint8Array.from([0x00, 0xa4, 0x00, 0x00]);
    const command = CommandApdu.fromUint8Array(bytes);
    expect(command.cla).toBe(0x00);
    expect(command.ins).toBe(0xa4);
    expect(command.p1).toBe(0x00);
    expect(command.p2).toBe(0x00);
    expect(command.data).toBe(null);
    expect(command.le).toBe(null);
    expect(command.toUint8Array()).toEqual(bytes);
  });

  test("should parse APDU from Uint8Array (standard case 2)", () => {
    const bytes = Uint8Array.from([0x00, 0xb0, 0x00, 0x00, 0xff]);
    const command = CommandApdu.fromUint8Array(bytes);
    expect(command.cla).toBe(0x00);
    expect(command.ins).toBe(0xb0);
    expect(command.p1).toBe(0x00);
    expect(command.p2).toBe(0x00);
    expect(command.data).toBe(null);
    expect(command.le).toBe(255);
    expect(command.toUint8Array()).toEqual(bytes);
  });
});

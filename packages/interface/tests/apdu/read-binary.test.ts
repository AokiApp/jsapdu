import { describe, expect, test } from "vitest";
import {
  readBinary,
  readEfBinaryFull,
  readCurrentEfBinaryFull,
} from "../../src";

describe("readBinary", () => {
  test("should create READ BINARY command with offset and length", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const command = readBinary(0, 0, true, true, { isCurrentEF: true });
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });

  test("should create READ BINARY command for current EF with maximum length", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const command = readBinary(0, 0, true, true, { isCurrentEF: true });
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });

  test("should create READ BINARY command with short EF identifier", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x85, 0x00, 0x00,
    ]);
    const command = readBinary(0, 256, true, false, { shortEfId: 0x05 });
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });

  test("should create READ BINARY command with specific offset", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x01, 0x23, 0x20,
    ]);
    const command = readBinary(0x0123, 32, false, false);
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });

  test("should create READ BINARY command with relative addressing (8-bit)", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x00, 0x42, 0x10,
    ]);
    const command = readBinary(0x42, 16, false, false, {
      useRelativeAddress8Bit: true,
    });
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });

  test("should throw error for offset out of range", () => {
    expect(() => readBinary(0x10000, 0, false, false)).toThrowError();
  });

  test("should throw error for length out of range in standard APDU", () => {
    expect(() => readBinary(0, 0x100, false, false)).toThrowError();
  });
});

describe("readEfBinaryFull", () => {
  test("readEfBinaryFull", () => {
    const command = readEfBinaryFull(0x01);
    expect(command.toUint8Array()).toEqual(
      Uint8Array.from([0x00, 0xb0, 0x81, 0x00, 0x00, 0x00, 0x00]),
    );
  });
});

describe("readCurrentEfBinaryFull", () => {
  test("readCurrentEfBinaryFull", () => {
    const command = readCurrentEfBinaryFull();
    expect(command.toUint8Array()).toEqual(
      Uint8Array.from([0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00]),
    );
  });
});

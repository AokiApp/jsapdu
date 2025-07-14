import { describe, expect, test } from "vitest";

import { verify } from "../src";

const TEST_PIN = "1234";
const PIN_DIGITS = [0x31, 0x32, 0x33, 0x34]; // ASCII for "1234"

describe("verify", () => {
  test("should create VERIFY command for current DF", () => {
    const EXPECTED_VERIFY = Uint8Array.from([
      0x00,
      0x20,
      0x00,
      0x80,
      0x04,
      ...PIN_DIGITS,
    ]);
    const command = verify(TEST_PIN, { isCurrent: true });
    expect(command.toUint8Array()).toEqual(EXPECTED_VERIFY);
  });

  test("should create VERIFY command for specific EF-01", () => {
    const EXPECTED_VERIFY = Uint8Array.from([
      0x00,
      0x20,
      0x00,
      0x81,
      0x04,
      ...PIN_DIGITS,
    ]);
    const command = verify(TEST_PIN, { ef: 0x01 });
    expect(command.toUint8Array()).toEqual(EXPECTED_VERIFY);
  });

  test("should create VERIFY command for maximum allowed EF (0x1E)", () => {
    const EXPECTED_VERIFY = Uint8Array.from([
      0x00,
      0x20,
      0x00,
      0x9e,
      0x04,
      ...PIN_DIGITS,
    ]);
    const command = verify(TEST_PIN, { ef: 0x1e });
    expect(command.toUint8Array()).toEqual(EXPECTED_VERIFY);
  });

  test("should throw error for EF value exceeding maximum (0x1E)", () => {
    expect(() => verify(TEST_PIN, { ef: 0x1f })).toThrowError();
  });

  test("should accept EF as string value", () => {
    const command = verify(TEST_PIN, { ef: "10" });
    expect(command.toUint8Array()[3]).toBe(0x8a); // 0x80 + 10 = 0x8A
  });

  test("should accept PIN as number array", () => {
    const command = verify([0x31, 0x32, 0x33, 0x34], { isCurrent: true });
    expect(command.toUint8Array()).toEqual(
      Uint8Array.from([0x00, 0x20, 0x00, 0x80, 0x04, ...PIN_DIGITS]),
    );
  });
});

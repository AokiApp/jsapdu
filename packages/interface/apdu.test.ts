import { expect, test, describe } from "vitest";
import { selectDf, selectEf, verify } from "./apdu";
import { JPKI_AP } from "./constant";

describe("DF selection", () => {
  const EXPECTED_DF_FCI = Uint8Array.from([
    0x00, 0xa4, 0x04, 0x00, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00,
    0x00, 0x00, 0x01, 0x00,
  ]);

  const EXPECTED_DF_NO_FCI = Uint8Array.from([
    0x00, 0xa4, 0x04, 0x0c, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00,
    0x00, 0x00, 0x01,
  ]);
  test("DF FCI with string", () => {
    const command = selectDf("D392F000260100000001", true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("DF FCI with number[]", () => {
    const command = selectDf(JPKI_AP, true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("DF FCI with Uint8Array", () => {
    const command = selectDf(Uint8Array.from(JPKI_AP), true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("DF without FCI with string", () => {
    const command = selectDf("D392F000260100000001", false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });

  test("DF without FCI with number[]", () => {
    const command = selectDf(JPKI_AP, false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });

  test("DF without FCI with Uint8Array", () => {
    const command = selectDf(Uint8Array.from(JPKI_AP), false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });
});

describe("EF selection", () => {
  const EXPECTED_EF = Uint8Array.from([
    0x00, 0xa4, 0x02, 0x0c, 0x02, 0x00, 0x01,
  ]);

  test("EF selection with string", () => {
    const command = selectEf("0001");
    expect(command.toUint8Array()).toEqual(EXPECTED_EF);
  });

  test("EF selection with number[]", () => {
    const command = selectEf([0x00, 0x01]);
    expect(command.toUint8Array()).toEqual(EXPECTED_EF);
  });

  test("EF selection with Uint8Array", () => {
    const command = selectEf(Uint8Array.from([0x00, 0x01]));
    expect(command.toUint8Array()).toEqual(EXPECTED_EF);
  });
});

describe("VERIFY command", () => {
  const TEST_PIN = "1234";
  const PIN_DIGITS = [0x31, 0x32, 0x33, 0x34]; // ASCII for "1234"

  test("should create VERIFY command with current PIN", () => {
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

  test("should create VERIFY command for EF-01", () => {
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

  test("should create VERIFY command for maximum valid EF (0x1E)", () => {
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

  test("should throw error for invalid EF value (> 0x1E)", () => {
    expect(() => verify(TEST_PIN, { ef: 0x1f })).toThrowError();
  });
});

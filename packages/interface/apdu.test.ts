import { expect, test, describe } from "vitest";
import { CommandApdu, readBinary, selectDf, selectEf, verify } from "./apdu";
import { JPKI_AP } from "./constant";

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
  });

  test("should parse APDU from hex string", () => {
    const command = CommandApdu.fromHexString("00A4040004D392F000");
    expect(command.cla).toBe(0x00);
    expect(command.ins).toBe(0xa4);
    expect(command.p1).toBe(0x04);
    expect(command.p2).toBe(0x00);
    expect(command.data).toEqual(Uint8Array.from([0xd3, 0x92, 0xf0, 0x00]));
  });

  test("should throw error when parsing invalid hex string", () => {
    expect(() => CommandApdu.fromHexString("00A4G4")).toThrowError();
    expect(() => CommandApdu.fromHexString("00A")).toThrowError(); // Odd length
  });
});

describe("DF selection commands", () => {
  const EXPECTED_DF_FCI = Uint8Array.from([
    0x00, 0xa4, 0x04, 0x00, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00,
    0x00, 0x00, 0x01, 0x00,
  ]);

  const EXPECTED_DF_NO_FCI = Uint8Array.from([
    0x00, 0xa4, 0x04, 0x0c, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00,
    0x00, 0x00, 0x01,
  ]);

  test("should create SELECT DF command with FCI from string identifier", () => {
    const command = selectDf("D392F000260100000001", true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("should create SELECT DF command with FCI from number array", () => {
    const command = selectDf(JPKI_AP, true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("should create SELECT DF command with FCI from Uint8Array", () => {
    const command = selectDf(Uint8Array.from(JPKI_AP), true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("should create SELECT DF command without FCI from string identifier", () => {
    const command = selectDf("D392F000260100000001", false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });

  test("should create SELECT DF command without FCI from number array", () => {
    const command = selectDf(JPKI_AP, false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });

  test("should create SELECT DF command without FCI from Uint8Array", () => {
    const command = selectDf(Uint8Array.from(JPKI_AP), false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });

  test("should throw error when DF identifier is too short", () => {
    expect(() => selectDf("")).toThrowError();
  });

  test("should throw error when DF identifier is too long", () => {
    expect(() =>
      selectDf("D392F000260100000001D392F000260100000001"),
    ).toThrowError();
  });
});

describe("EF selection commands", () => {
  const EXPECTED_EF = Uint8Array.from([
    0x00, 0xa4, 0x02, 0x0c, 0x02, 0x00, 0x01,
  ]);

  test("should create SELECT EF command from string identifier", () => {
    const command = selectEf("0001");
    expect(command.toUint8Array()).toEqual(EXPECTED_EF);
  });

  test("should create SELECT EF command from number array", () => {
    const command = selectEf([0x00, 0x01]);
    expect(command.toUint8Array()).toEqual(EXPECTED_EF);
  });

  test("should create SELECT EF command from Uint8Array", () => {
    const command = selectEf(Uint8Array.from([0x00, 0x01]));
    expect(command.toUint8Array()).toEqual(EXPECTED_EF);
  });

  test("should throw error when EF identifier is not exactly 2 bytes", () => {
    expect(() => selectEf("00")).toThrowError();
    expect(() => selectEf("000102")).toThrowError();
  });
});

describe("VERIFY PIN commands", () => {
  const TEST_PIN = "1234";
  const PIN_DIGITS = [0x31, 0x32, 0x33, 0x34]; // ASCII for "1234"

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

  test("should throw error for non-numeric PIN string", () => {
    expect(() => verify("123A", { isCurrent: true })).toThrowError();
  });

  test("should accept PIN as number array", () => {
    const command = verify([0x31, 0x32, 0x33, 0x34], { isCurrent: true });
    expect(command.toUint8Array()).toEqual(
      Uint8Array.from([0x00, 0x20, 0x00, 0x80, 0x04, ...PIN_DIGITS]),
    );
  });
});

describe("READ BINARY commands", () => {
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

describe("READ BINARY command", () => {
  test("should create READ BINARY command with offset and length", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const command = readBinary(0, 0, true, true, { isCurrentEF: true });
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });

  test("should create READ BINARY command with offset and length", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x84, 0x00, 0x00, 0x00, 0x00,
    ]);
    const command = new CommandApdu(0x00, 0xb0, 0x84, 0x00, null, 65536);
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });

  test("should create READ BINARY command", () => {
    const EXPECTED_READ_BINARY = Uint8Array.from([
      0x00, 0xb0, 0x84, 0x00, 0x00, 0x00, 0x00,
    ]);
    const command = new CommandApdu(0x00, 0xb0, 0x84, 0x00, null, 65536);
    expect(command.toUint8Array()).toEqual(EXPECTED_READ_BINARY);
  });
});

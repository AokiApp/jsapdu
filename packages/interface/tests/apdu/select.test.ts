import { expect, test, describe } from "vitest";
import { select, selectDf, selectEf } from "../../src";

const DF = [0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00, 0x00, 0x00, 0x01];
const DF_STRING = "D392F000260100000001";

const EXPECTED_DF_FCI = Uint8Array.from([
  0x00, 0xa4, 0x04, 0x00, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00, 0x00,
  0x00, 0x01, 0x00,
]);

const EXPECTED_DF_NO_FCI = Uint8Array.from([
  0x00, 0xa4, 0x04, 0x0c, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00, 0x00,
  0x00, 0x01,
]);

describe("select", () => {
  test("should create SELECT DF command with FCI", () => {
    const command = select(0x04, 0x00, Uint8Array.from(DF), 0x00);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("should create SELECT DF command without FCI", () => {
    const command = select(0x04, 0x0c, Uint8Array.from(DF), null);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });
});

describe("selectDF", () => {
  test("should create SELECT DF command with FCI from string identifier", () => {
    const command = selectDf(DF_STRING, true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("should create SELECT DF command with FCI from number array", () => {
    const command = selectDf(DF, true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("should create SELECT DF command with FCI from Uint8Array", () => {
    const command = selectDf(Uint8Array.from(DF), true);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_FCI);
  });

  test("should create SELECT DF command without FCI from string identifier", () => {
    const command = selectDf(DF_STRING, false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });

  test("should create SELECT DF command without FCI from number array", () => {
    const command = selectDf(DF, false);
    expect(command.toUint8Array()).toEqual(EXPECTED_DF_NO_FCI);
  });

  test("should create SELECT DF command without FCI from Uint8Array", () => {
    const command = selectDf(Uint8Array.from(DF), false);
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

describe("selectEF", () => {
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

import { expect, test, describe } from "vitest";
import { selectDf, selectEf } from "./apdu";
import { JPKI_AP } from "./constant";

// 共通の期待値定数
const EXPECTED_DF_FCI = Uint8Array.from([
  0x00, 0xa4, 0x04, 0x00, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00, 0x00,
  0x00, 0x01, 0x00,
]);

const EXPECTED_DF_NO_FCI = Uint8Array.from([
  0x00, 0xa4, 0x04, 0x0c, 0x0a, 0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00, 0x00,
  0x00, 0x01,
]);

describe("DF selection", () => {
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

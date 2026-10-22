import { describe, expect, it } from "vitest";
import { cleanIdentifier, isValidIdentifier, luhnValid, parseIdentifiers } from "@/lib/imei";
import { RETAIL, unitPriceUsd } from "@/lib/pricing";

describe("IMEI", () => {
  it("checks the Luhn digit", () => {
    expect(luhnValid("490154203237518")).toBe(true);
    expect(luhnValid("490154203237519")).toBe(false);
  });
  it("cleans spaces and dashes people paste", () => {
    expect(cleanIdentifier(" 49-015420 323751 8 ", "imei")).toBe("490154203237518");
    expect(cleanIdentifier("f2lx 123abc", "serial")).toBe("F2LX123ABC");
  });
  it("validates by format", () => {
    expect(isValidIdentifier("490154203237518", "imei")).toBe(true);
    expect(isValidIdentifier("49015420323751", "imei")).toBe(false);
    expect(isValidIdentifier("F2LX123ABC", "serial")).toBe(true);
    expect(isValidIdentifier("AB", "serial")).toBe(false);
  });
  it("splits a bulk box, drops duplicates and reports mistakes", () => {
    const r = parseIdentifiers("490154203237518\n490154203237518, 35345678901234\n\n", "imei");
    expect(r.valid).toEqual(["490154203237518"]);
    expect(r.invalid).toEqual(["35345678901234"]);
  });
});

describe("group prices", () => {
  const v = { id: "v1", priceUsd: 2000, salePriceUsd: null };
  it("uses the list price for retail", () => expect(unitPriceUsd(v, RETAIL)).toBe(2000));
  it("applies a group discount", () => expect(unitPriceUsd(v, { discountBps: 1500, fixed: new Map() })).toBe(1700));
  it("a fixed group price wins but never goes above list", () => {
    expect(unitPriceUsd(v, { discountBps: 1500, fixed: new Map([["v1", 1500]]) })).toBe(1500);
    expect(unitPriceUsd(v, { discountBps: 0, fixed: new Map([["v1", 2500]]) })).toBe(2000);
  });
});

import { identifierProblem } from "@/lib/imei";
describe("identifierProblem", () => {
  it("says what is wrong with an IMEI", () => {
    expect(identifierProblem("35345678901234", "imei")).toEqual({ key: "len", n: 14 });
    expect(identifierProblem("35345678901234A", "imei")).toEqual({ key: "letters" });
    expect(identifierProblem("490154203237519", "imei")).toEqual({ key: "check" });
    expect(identifierProblem("ab", "serial")).toEqual({ key: "serial" });
  });
});

import { describe, expect, it } from "vitest";
import { fieldProblem, formProblem, isVisible, sanitizeFields, FORM_TEMPLATES, type FieldDef } from "@/lib/order-form";
import { parseChoiceList } from "@/lib/dhru/protocol";

const f = (p: Partial<FieldDef>): FieldDef => ({ key: "x", type: "text", required: true, label: { en: "X" }, ...p });

describe("order form fields", () => {
  it("checks values by type", () => {
    expect(fieldProblem(f({}), "")).toBe("missing");
    expect(fieldProblem(f({ required: false }), "")).toBeNull();
    expect(fieldProblem(f({ type: "checkbox" }), "")).toBe("confirm");
    expect(fieldProblem(f({ type: "checkbox" }), "yes")).toBeNull();
    expect(fieldProblem(f({ type: "imei" }), "35 209900 176148 1")).toBeNull();
    expect(fieldProblem(f({ type: "imei" }), "352099001761482")).toBe("imei");
    expect(fieldProblem(f({ type: "remoteId", allowed: "digits", minLength: 9, maxLength: 10 }), "12345")).toBe("length");
    expect(fieldProblem(f({ type: "remoteId", allowed: "digits", minLength: 9, maxLength: 10 }), "123456789")).toBeNull();
    expect(fieldProblem(f({ type: "text", allowed: "digits" }), "12a")).toBe("chars");
    expect(fieldProblem(f({ type: "select", options: ["13", "14"] }), "12")).toBe("choice");
    expect(fieldProblem(f({ type: "model", choices: [{ value: "77", label: "Galaxy A54" }] }), "77")).toBeNull();
    expect(fieldProblem(f({ type: "url" }), "javascript:alert(1)")).toBe("url");
    expect(fieldProblem(f({ type: "info" }), "")).toBeNull();
  });

  it("skips fields whose condition is not met", () => {
    const defs = [f({ key: "android", type: "radio", options: ["13", "14"] }), f({ key: "photo", type: "file", showIf: { key: "android", equals: "14" } })];
    expect(isVisible(defs[1], { android: "13" })).toBe(false);
    expect(formProblem(defs, { android: "13" })).toBeNull();
    expect(formProblem(defs, { android: "14" })?.def.key).toBe("photo");
  });

  it("sanitizes builder input", () => {
    const out = sanitizeFields([{ key: "Remote Pass", type: "secret", label: { en: "Pass", xx1: "no" }, required: true, remember: true, evil: 1 }]);
    expect(out[0]).toEqual({ key: "remote_pass", type: "secret", label: { en: "Pass" }, required: true, hideAfterDone: true });
    expect(() => sanitizeFields([{ key: "a", type: "script", label: { en: "A" } }])).toThrow();
    expect(() => sanitizeFields([{ key: "a", type: "text", label: { en: "A" } }, { key: "a", type: "text", label: { en: "B" } }])).toThrow();
    expect(() => sanitizeFields([{ key: "a", type: "text", label: { en: "A" }, showIf: { key: "nope", equals: "1" } }])).toThrow();
  });

  it("templates are valid forms", () => {
    for (const tpl of Object.values(FORM_TEMPLATES)) expect(sanitizeFields(tpl.fields).length).toBe(tpl.fields.length);
  });

  it("reads supplier model lists in their usual shapes", () => {
    expect(parseChoiceList({ SUCCESS: [{ LIST: { a: { ID: "1", NAME: "iPhone 12" }, b: { ID: "2", NAME: "iPhone 13" } } }] })).toEqual([{ value: "1", label: "iPhone 12" }, { value: "2", label: "iPhone 13" }]);
    expect(parseChoiceList({ SUCCESS: [{ LIST: { Samsung: { BRAND: "Samsung", MODELS: { x: { ID: "9", NAME: "A54" } } } } }] })).toEqual([{ value: "9", label: "Samsung A54" }]);
    expect(parseChoiceList({ SUCCESS: [{ LIST: { "11": "AT&T", "12": "T-Mobile" } }] })).toEqual([{ value: "11", label: "AT&T" }, { value: "12", label: "T-Mobile" }]);
  });
});

import { packCostCents, packSizeFor, toMicros } from "@/lib/packs";
describe("sub-cent credits", () => {
  it("sells sub-cent credits in packs that cost at least $1", () => {
    expect(toMicros("0.0045")).toBe(4500);
    expect(packSizeFor(4500)).toBe(1000);
    expect(packCostCents(4500, 1000)).toBe(450);
    expect(packSizeFor(150_000)).toBe(1);
    expect(packSizeFor(20_000)).toBe(100);
  });
});

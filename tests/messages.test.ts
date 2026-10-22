import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "../src/messages");
function keys(o: Record<string, unknown>, pre = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}`]));
}

describe("translations", () => {
  const en = keys(JSON.parse(readFileSync(path.join(dir, "en.json"), "utf8")));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
    it(`${file} has every English key and no stray ones`, () => {
      const other = keys(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
      expect(en.filter((k) => !other.includes(k))).toEqual([]);
      expect(other.filter((k) => !en.includes(k))).toEqual([]);
    });
  }
});

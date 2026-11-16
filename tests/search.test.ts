import { describe, expect, it } from "vitest";
import { distance, indexWords, matchExact, matchFuzzy, norm, tokens } from "@/lib/search";
import { tagIcon } from "@/lib/platforms";

const netflix = indexWords(["Abònman Netflix", "Abonnement Netflix", "netflix", "Web", "Abònman"]);
const fortnite = indexWords(["V-Bucks Fortnite", "fortnite vbucks", "PC", "PlayStation", "Rechaj jwèt"]);

describe("store search", () => {
  it("ignores accents and capitals", () => {
    expect(norm("Abònman ÉTÉ")).toBe("abonman ete");
    expect(matchExact(netflix, tokens("abonman"))).toBe(true);
    expect(matchExact(fortnite, tokens("JWET"))).toBe(true);
  });
  it("needs every word", () => {
    expect(matchExact(netflix, tokens("netflix web"))).toBe(true);
    expect(matchExact(netflix, tokens("netflix pc"))).toBe(false);
  });
  it("forgives small typos and says what it understood", () => {
    expect(matchExact(netflix, tokens("netflx"))).toBe(false);
    expect(matchFuzzy(netflix, tokens("netflx"))).toEqual(["netflix"]);
    expect(matchFuzzy(fortnite, tokens("fortnte"))).toEqual(["fortnite"]);
    expect(matchFuzzy(netflix, tokens("spotify"))).toBeNull();
    // short words must be exact
    expect(matchFuzzy(netflix, tokens("pcx"))).toBeNull();
  });
  it("edit distance stops early", () => {
    expect(distance("kitten", "sitting", 3)).toBe(3);
    expect(distance("a", "abcdef", 2)).toBe(3);
  });
  it("tag icons", () => {
    expect(tagIcon("Android")).toBe("🤖");
    expect(tagIcon("PS5")).toBe("🕹️");
    expect(tagIcon("Something else")).toBe("");
  });
});

describe("closest matches", () => {
  it("finds the AT&T unlock for 'iPhone 13 AT&T' when no name says 13", async () => {
    const { bestPartial, indexWords, matchCount, tokens } = await import("@/lib/search");
    const items = [
      { id: "att", idx: indexWords(["iPhone USA AT&T unlock", "carrier unlock"]) },
      { id: "tmo", idx: indexWords(["iPhone USA T-Mobile unlock"]) },
      { id: "chi", idx: indexWords(["Chimera credits"]) },
    ];
    const toks = tokens("iPhone 13 AT&T");
    const out = bestPartial(items, (x) => matchCount(x.idx, toks), toks.length).map((x) => x.id);
    expect(out[0]).toBe("att");
    expect(out).not.toContain("chi");
    expect(out).not.toContain("tmo"); // "AT&T" is one word, so T-Mobile no longer matches
  });
});

describe("JSON-LD output", () => {
  it("can't be closed by a name containing </script>", async () => {
    const { jsonLd } = await import("@/lib/json-ld");
    const out = jsonLd({ name: "x</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("x</script><script>alert(1)</script>");
  });
});

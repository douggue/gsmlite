/**
 * Store search, run in the browser on every keystroke.
 * - accents and capitals don't matter ("abonman" finds "Abònman")
 * - every word typed must be found somewhere: names in all languages, slug, tags, category
 * - nothing found? small typos are forgiven ("netflx" finds "Netflix")
 * - still nothing? the closest partial matches ("iphone 13 at&t" finds the AT&T unlock even if no name says "13")
 */

/** Lowercase, no accents, single spaces. */
export function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();
}

/** Edit distance (Levenshtein), stopping early once it goes over `max`. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Typos allowed for a word of this length: none under 4 letters, 1 up to 5, then 2. */
export function typoBudget(word: string): number {
  return word.length < 4 ? 0 : word.length <= 5 ? 1 : 2;
}

/** Prepares the words of a product once, so typing stays fast. */
export function indexWords(haystack: string[]): { text: string; words: string[] } {
  const text = haystack.map(norm).filter(Boolean).join(" | ");
  return { text, words: [...new Set(text.split(/[ |]+/).filter((w) => w.length >= 2))] };
}

export function tokens(q: string): string[] {
  return norm(q).split(" ").filter(Boolean);
}

/** Exact match: every typed word appears (as part of a word) in the product's texts. */
export function matchExact(idx: { text: string }, toks: string[]): boolean {
  return toks.every((tk) => idx.text.includes(tk));
}

/** Close match: every typed word is either found, or is a near spelling of one of the product's words. Returns the corrected words. */
export function matchFuzzy(idx: { text: string; words: string[] }, toks: string[]): string[] | null {
  const fixed: string[] = [];
  for (const tk of toks) {
    if (idx.text.includes(tk)) {
      fixed.push(tk);
      continue;
    }
    const budget = typoBudget(tk);
    if (!budget) return null;
    let best: string | null = null;
    let bestD = budget + 1;
    for (const w of idx.words) {
      // Compare with the start of longer words too, so "fortnit" finds "fortnite" and "robu" finds "robux".
      const d = Math.min(distance(tk, w, budget), w.length > tk.length ? distance(tk, w.slice(0, tk.length), budget) : budget + 1);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (!best) return null;
    fixed.push(best);
  }
  return fixed;
}

/** How many typed words appear in the product's texts (for the "closest matches" fallback). */
export function matchCount(idx: { text: string }, toks: string[]): number {
  return toks.filter((tk) => idx.text.includes(tk)).length;
}

/** Keeps the best partial matches: at least half the words, and no more than one word behind the best one. */
export function bestPartial<T>(items: T[], count: (x: T) => number, words: number): T[] {
  const scored = items.map((x) => [x, count(x)] as const).filter(([, n]) => n > 0);
  const best = Math.max(0, ...scored.map(([, n]) => n));
  const floor = Math.max(1, Math.ceil(words / 2), best - 1);
  return scored.filter(([, n]) => n >= floor).sort((a, b) => b[1] - a[1]).map(([x]) => x);
}

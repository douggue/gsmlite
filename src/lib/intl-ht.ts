/**
 * Browsers and Node have no date/number formats for Kreyòl ("ht"), so Intl silently falls back to US English
 * ("Nov 16, 6:59 PM", "1,000"). Haitian French formats are the closest match ("16 nov. 2026", "1 000"),
 * so any Intl formatter asked for "ht" uses "fr-HT" instead. Imported once on the server and once in the browser.
 */
const swap = (l: unknown): unknown => {
  if (typeof l === "string") return /^ht(-|$)/i.test(l) ? "fr-HT" : l;
  if (Array.isArray(l)) return l.map(swap);
  return l;
};

type Ctor = { new (locales?: unknown, options?: unknown): unknown; supportedLocalesOf?: unknown };
const g = globalThis as unknown as { Intl: Record<string, Ctor>; __glHt?: boolean };
if (!g.__glHt) {
  g.__glHt = true;
  for (const name of ["DateTimeFormat", "NumberFormat", "RelativeTimeFormat", "ListFormat", "PluralRules"]) {
    const Orig = g.Intl[name];
    if (!Orig) continue;
    const Wrapped = function (this: unknown, locales?: unknown, options?: unknown) {
      return new Orig(swap(locales), options);
    } as unknown as Ctor;
    Object.setPrototypeOf(Wrapped, Orig);
    Wrapped.prototype = Orig.prototype as never;
    g.Intl[name] = Wrapped;
  }
  const dateProto = Date.prototype as unknown as Record<string, (l?: unknown, o?: unknown) => string>;
  for (const m of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
    const orig = dateProto[m];
    dateProto[m] = function (this: Date, l?: unknown, o?: unknown) {
      return orig.call(this, swap(l), o);
    };
  }
  const numProto = Number.prototype as unknown as { toLocaleString: (l?: unknown, o?: unknown) => string };
  const origNum = numProto.toLocaleString as (this: number, l?: unknown, o?: unknown) => string;
  numProto.toLocaleString = function (this: number, l?: unknown, o?: unknown) {
    return origNum.call(this, swap(l), o);
  };
}

export {};

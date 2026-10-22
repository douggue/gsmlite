"use client";
import { useMemo, useState } from "react";
import { COUNTRY_CODES, countryName } from "@/lib/countries";

/** "Worldwide / Only in these countries / Everywhere except" + country chips. Posts <prefix>countryMode and <prefix>countries. */
export function CountryRuleField({ prefix = "", mode: initialMode = "all", countries: initial = [], label = "Where it's sold" }: { prefix?: string; mode?: string; countries?: string[]; label?: string }) {
  const [mode, setMode] = useState(initialMode);
  const [list, setList] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const options = useMemo(() => COUNTRY_CODES.map((c) => ({ c, n: countryName(c, "en") })).sort((a, b) => a.n.localeCompare(b.n)), []);
  const matches = q.trim() ? options.filter((o) => !list.includes(o.c) && (o.c.toLowerCase() === q.trim().toLowerCase() || o.n.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 6) : [];
  const add = (c: string) => {
    setList([...list, c]);
    setQ("");
  };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <input type="hidden" name={`${prefix}countryMode`} value={mode} />
      <input type="hidden" name={`${prefix}countries`} value={list.join(",")} />
      {(["all", "only", "except"] as const).map((m) => (
        <label key={m} className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {m === "all" ? "Worldwide" : m === "only" ? "Only in these countries" : "Everywhere except"}
        </label>
      ))}
      {mode !== "all" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {list.map((c) => (
              <button key={c} type="button" onClick={() => setList(list.filter((x) => x !== c))} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold" title="Remove">
                {countryName(c, "en")} ({c}) ×
              </button>
            ))}
            {list.length === 0 && <span className="text-xs text-warning">Add at least one country, or it stays worldwide.</span>}
          </div>
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) add(matches[0].c); } }} placeholder="+ add country (name or code)" className="input" aria-label="Add country" />
            {matches.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                {matches.map((o) => <li key={o.c}><button type="button" onClick={() => add(o.c)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2">{o.n} ({o.c})</button></li>)}
              </ul>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-muted">Hidden and refused at checkout outside these countries.</p>
    </fieldset>
  );
}

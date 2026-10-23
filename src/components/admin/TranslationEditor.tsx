"use client";
import { locales } from "@/i18n/routing";
import { useMemo, useState, useTransition } from "react";
import { saveTranslation } from "@/actions/content";

const LOCALES = locales;
type Base = Record<(typeof LOCALES)[number], Record<string, string>>;

export function TranslationEditor({ keys, base, overrides }: { keys: string[]; base: Base; overrides: { locale: string; key: string; value: string }[] }) {
  const [q, setQ] = useState("");
  // "all", "edited", or a language code = only texts with no wording in that language yet.
  const [show, setShow] = useState<string>("all");
  const [limit, setLimit] = useState(60);
  const [edits, setEdits] = useState(() => Object.fromEntries(overrides.map((o) => [`${o.locale}:${o.key}`, o.value])));
  const [status, setStatus] = useState<Record<string, string>>({});
  const [, start] = useTransition();
  // Worked out from what was loaded, so a row does not vanish while it is being filled in.
  const missingKeys = useMemo(() => {
    const saved = new Set(overrides.filter((o) => o.value).map((o) => `${o.locale}:${o.key}`));
    return Object.fromEntries(LOCALES.map((l) => [l, new Set(keys.filter((k) => !base[l][k] && !saved.has(`${l}:${k}`)))]));
  }, [keys, base, overrides]);
  const edited = useMemo(() => keys.filter((k) => LOCALES.some((l) => edits[`${l}:${k}`] !== undefined)).length, [keys, edits]);
  const all = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return keys
      .filter((k) => show === "all" || (show === "edited" ? LOCALES.some((l) => edits[`${l}:${k}`] !== undefined) : missingKeys[show]?.has(k)))
      .filter((k) => !needle || k.toLowerCase().includes(needle) || LOCALES.some((l) => (edits[`${l}:${k}`] ?? base[l][k] ?? "").toLowerCase().includes(needle)));
  }, [q, show, keys, base, edits, missingKeys]);
  const list = all.slice(0, limit);
  const chip = (key: string, text: string, warn = false) => (
    <button key={key} type="button" onClick={() => { setShow(key); setLimit(60); }} aria-pressed={show === key}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-sm font-semibold ${show === key ? "bg-[#111418] text-white dark:bg-primary" : warn ? "border border-warning/40 bg-warning-soft text-warning" : "border border-border bg-surface"}`}>{text}</button>
  );

  return (
    <div className="space-y-3">
      <input className="input min-h-11 max-w-md" placeholder="Search text or key, e.g. “Achte kounye a” or home.heroTitle" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} aria-label="Search translations" />
      <nav aria-label="Filter" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chip("all", `All ${keys.length}`)}
        {chip("edited", `Edited ${edited}`)}
        {LOCALES.filter((l) => l !== "en").map((l) => chip(l, missingKeys[l].size ? `${l.toUpperCase()} missing ${missingKeys[l].size}` : `${l.toUpperCase()} ✓`, missingKeys[l].size > 0))}
      </nav>
      <p className="text-xs text-muted">{all.length === 0 ? "Nothing here." : `Showing ${list.length} of ${all.length}.`} A missing text shows the Kreyòl or English wording to customers. Keep {"{placeholders}"} like {"{name}"} or {"{count}"} unchanged.</p>
      {list.map((k) => (
        <div key={k} className="card p-4">
          <p className="mb-2 font-mono text-xs text-muted">{k}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {LOCALES.map((l) => {
              const id = `${l}:${k}`;
              const value = edits[id] ?? "";
              return (
                <label key={l} className="block">
                  <span className="mb-1 flex justify-between text-xs text-muted"><span>{l.toUpperCase()}</span><span>{status[id]}</span></span>
                  <textarea
                    rows={Math.min(4, Math.max(1, Math.ceil((value || base[l][k] || "").length / 60)))}
                    className={`input py-2 ${edits[id] !== undefined ? "border-primary" : ""}`}
                    placeholder={base[l][k] ?? "(missing)"}
                    value={value}
                    onChange={(e) => setEdits({ ...edits, [id]: e.target.value })}
                    onBlur={(e) => {
                      const v = e.target.value;
                      const original = overrides.find((o) => o.locale === l && o.key === k)?.value ?? "";
                      if (v === original && !status[id]) return;
                      setStatus((s) => ({ ...s, [id]: "Saving…" }));
                      start(async () => {
                        const r = await saveTranslation(l, k, v);
                        setStatus((s) => ({ ...s, [id]: r.ok ? (v ? "Saved" : "Default") : r.error }));
                        if (!v) setEdits((ed) => { const n = { ...ed }; delete n[id]; return n; });
                      });
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {all.length > list.length && <button type="button" className="btn-secondary min-h-11 w-full" onClick={() => setLimit((n) => n + 60)}>Show 60 more</button>}
    </div>
  );
}

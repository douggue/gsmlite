"use client";
import { useEffect, useState } from "react";
import { localeNames, locales } from "@/i18n/routing";

const SYNC = "gl-admin-lang";

/**
 * One box per text with a tab per language (inputs named `${prefix}_${locale}`; every language is still sent).
 * Tabs show which languages are filled in; switching language switches every box on the page at once.
 */
export function LocalizedInputs({ prefix, label, value = {}, textarea = false, required = false }: { prefix: string; label: string; value?: Record<string, string>; textarea?: boolean; required?: boolean }) {
  const [lang, setLang] = useState<string>("en");
  const [filled, setFilled] = useState<Record<string, boolean>>(() => Object.fromEntries(locales.map((l) => [l, !!value[l]?.trim()])));
  useEffect(() => {
    const on = (e: Event) => setLang((e as CustomEvent<string>).detail);
    window.addEventListener(SYNC, on);
    return () => window.removeEventListener(SYNC, on);
  }, []);
  const pick = (l: string) => {
    setLang(l);
    window.dispatchEvent(new CustomEvent(SYNC, { detail: l }));
  };
  const missing = locales.filter((l) => !filled[l]).length;

  return (
    <fieldset className="space-y-1.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <legend className="label mb-0">{label}</legend>
        {missing > 0 && missing < locales.length && <span className="text-[11px] font-semibold text-warning">{missing} language{missing > 1 ? "s" : ""} missing</span>}
      </div>
      <div role="tablist" aria-label={`${label}: language`} className="flex flex-wrap gap-1">
        {locales.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={lang === l} title={localeNames[l]} onClick={() => pick(l)}
            className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${lang === l ? "bg-[#111418] text-white dark:bg-primary" : "bg-surface-2 text-muted hover:text-text"}`}>
            {l.toUpperCase()}
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${filled[l] ? "bg-[#3fbf7f]" : "bg-[#f59e3b]"}`} />
          </button>
        ))}
      </div>
      {locales.map((l) => {
        const common = {
          name: `${prefix}_${l}`,
          defaultValue: value[l] ?? "",
          required: required && l === "ht",
          dir: l === "ar" ? "rtl" : undefined,
          lang: l,
          "aria-label": `${label} (${localeNames[l]})`,
          placeholder: localeNames[l],
          onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const v = !!e.currentTarget.value.trim();
            if (v !== filled[l]) setFilled((f) => ({ ...f, [l]: v }));
          },
          // A required language that is empty: show its tab so the browser can point at it.
          onInvalid: () => pick(l),
        };
        return (
          <div key={l} className={lang === l ? "" : "hidden"}>
            {textarea ? <textarea {...common} rows={4} className="input py-2" /> : <input {...common} className="input" />}
          </div>
        );
      })}
    </fieldset>
  );
}

/** Same language tabs for a text kept in React state (live previews). `name` adds form fields `${name}_${locale}`. */
export function LocalizedField({ label, value, onChange, name, hint }: { label: string; value: Record<string, string>; onChange: (v: Record<string, string>) => void; name?: string; hint?: string }) {
  const [lang, setLang] = useState<string>("en");
  useEffect(() => {
    const on = (e: Event) => setLang((e as CustomEvent<string>).detail);
    window.addEventListener(SYNC, on);
    return () => window.removeEventListener(SYNC, on);
  }, []);
  const pick = (l: string) => {
    setLang(l);
    window.dispatchEvent(new CustomEvent(SYNC, { detail: l }));
  };
  return (
    <div className="space-y-1.5">
      <span className="label mb-0 block">{label}</span>
      <div role="tablist" aria-label={`${label}: language`} className="flex flex-wrap gap-1">
        {locales.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={lang === l} title={localeNames[l]} onClick={() => pick(l)}
            className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${lang === l ? "bg-[#111418] text-white dark:bg-primary" : "bg-surface-2 text-muted hover:text-text"}`}>
            {l.toUpperCase()}
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${value[l]?.trim() ? "bg-[#3fbf7f]" : "bg-[#f59e3b]"}`} />
          </button>
        ))}
      </div>
      {locales.map((l) => (
        <input key={l} name={name ? `${name}_${l}` : undefined} value={value[l] ?? ""} onChange={(e) => onChange({ ...value, [l]: e.target.value })}
          aria-label={`${label} (${localeNames[l]})`} placeholder={localeNames[l]} dir={l === "ar" ? "rtl" : undefined}
          className={`input ${lang === l ? "" : "hidden"}`} />
      ))}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

"use client";
import { useState } from "react";
import { t } from "@/lib/text";
import { isVisible, maxLen, type FieldDef } from "@/lib/order-form";

export type FieldTexts = { choose: string; addFile: string; uploading: string; uploadFailed: string; fileTooBig: string; signinToUpload: string; yes: string };

/**
 * The service's order form as the customer sees it (also the live preview in the admin form builder).
 * Fields with a condition appear only when it is met.
 */
export function OrderFields({ defs, values, onChange, locale, text, canUpload, idPrefix = "field" }: {
  defs: FieldDef[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  locale: string;
  text: FieldTexts;
  /** Signed in: files can be sent. Preview and signed-out visitors get a message instead. */
  canUpload: boolean;
  idPrefix?: string;
}) {
  const set = (k: string, v: string) => onChange({ ...values, [k]: v });
  return (
    <>
      {defs.filter((f) => isVisible(f, values)).map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const label = t(f.label, locale);
        const help = f.help ? t(f.help, locale) : "";
        const list = f.choices?.length ? f.choices : (f.options ?? []).map((o) => ({ value: o, label: o }));
        const head = (
          <label htmlFor={id} className="block text-sm font-semibold">
            {label} {f.required && <span className="text-danger">*</span>}
          </label>
        );
        const helpLine = help ? <p id={`${id}-help`} className="mt-1 text-xs text-muted">{help}</p> : null;
        const common = { id, "aria-describedby": help ? `${id}-help` : undefined };

        if (f.type === "info") return <p key={f.key} className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm">{label}</p>;
        if (f.type === "checkbox") {
          return (
            <div key={f.key}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold">
                <input {...common} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#111418] dark:accent-[var(--primary)]" checked={values[f.key] === "yes"} onChange={(e) => set(f.key, e.target.checked ? "yes" : "")} />
                <span>{label} {f.required && <span className="text-danger">*</span>}</span>
              </label>
              {helpLine}
            </div>
          );
        }
        if (f.type === "radio") {
          return (
            <fieldset key={f.key}>
              <legend className="block text-sm font-semibold">{label} {f.required && <span className="text-danger">*</span>}</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {list.map((o) => {
                  const on = values[f.key] === o.value;
                  return (
                    <label key={o.value} className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl px-4 text-sm font-semibold ${on ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`}>
                      <input type="radio" name={id} value={o.value} checked={on} onChange={() => set(f.key, o.value)} className="sr-only" />
                      {o.label}
                    </label>
                  );
                })}
              </div>
              {helpLine}
            </fieldset>
          );
        }
        if (f.type === "select" || f.type === "model") {
          return (
            <div key={f.key}>
              {head}
              {list.length > 0 ? (
                <select {...common} className="input mt-1.5" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">{text.choose}</option>
                  {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input {...common} className="input mt-1.5" autoComplete="off" maxLength={maxLen(f)} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {helpLine}
            </div>
          );
        }
        if (f.type === "file") return <FileField key={f.key} def={f} id={id} label={head} help={helpLine} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} text={text} canUpload={canUpload} />;
        if (f.type === "textarea") {
          return (
            <div key={f.key}>
              {head}
              <textarea {...common} className="input mt-1.5 min-h-24 py-3" maxLength={maxLen(f)} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              {helpLine}
            </div>
          );
        }
        const numeric = f.type === "number" || f.type === "imei" || f.allowed === "digits";
        const inputType = f.type === "secret" ? "password" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.type === "url" ? "url" : f.type === "date" ? "datetime-local" : "text";
        return (
          <div key={f.key}>
            {head}
            <input {...common} className={`input mt-1.5 ${f.type === "imei" || f.type === "serial" || f.type === "remoteId" ? "font-mono" : ""}`} type={inputType}
              inputMode={numeric ? "numeric" : undefined} autoComplete={f.type === "secret" ? "new-password" : "off"} spellCheck={false}
              maxLength={maxLen(f)} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            {helpLine}
          </div>
        );
      })}
    </>
  );
}

function FileField({ def, id, label, help, value, onChange, text, canUpload }: {
  def: FieldDef; id: string; label: React.ReactNode; help: React.ReactNode; value: string; onChange: (v: string) => void; text: FieldTexts; canUpload: boolean;
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState<"" | "busy" | "error" | "big">("");
  return (
    <div>
      {label}
      <label className="mt-1.5 flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-dashed border-border bg-surface px-4 text-sm text-muted">
        <input id={id} type="file" className="sr-only" accept={def.accept === "any" ? undefined : "image/*,application/pdf"} disabled={!canUpload || state === "busy"}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const limit = def.accept === "any" ? 25 : 12;
            if (file.size > limit * 1024 * 1024) return setState("big");
            setState("busy");
            const fd = new FormData();
            fd.set("file", file);
            fd.set("accept", def.accept ?? "image");
            const r = await fetch("/api/order-files", { method: "POST", body: fd }).then((x) => x.json()).catch(() => null);
            if (!r?.id) return setState(r?.error === "size" ? "big" : "error");
            setName(r.name);
            setState("");
            onChange(r.id);
          }} />
        {!canUpload ? text.signinToUpload : state === "busy" ? text.uploading : value && name ? `📎 ${name}` : text.addFile}
      </label>
      {state === "error" && <p role="alert" className="mt-1 text-xs text-danger">{text.uploadFailed}</p>}
      {state === "big" && <p role="alert" className="mt-1 text-xs text-danger">{text.fileTooBig}</p>}
      {help}
    </div>
  );
}

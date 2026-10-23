"use client";
import { locales } from "@/i18n/routing";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FIELD_TYPES, FORM_TEMPLATES, formProblem, type FieldDef, type FieldType } from "@/lib/order-form";
import { saveProductForm } from "@/actions/forms";
import { OrderFields } from "@/components/shop/OrderFields";

const LANGS = ["en", ...locales.filter((l) => l !== "en")];
const PREVIEW_TEXT = { choose: "Choose…", addFile: "Tap to add a photo", uploading: "Sending…", uploadFailed: "", fileTooBig: "", signinToUpload: "Tap to add a photo", yes: "Yes" };
const WITH_CHOICES: FieldType[] = ["select", "radio", "model"];
const WITH_RULES: FieldType[] = ["text", "remoteId", "number", "textarea"];

function describe(f: FieldDef) {
  const bits = [FIELD_TYPES[f.type].split(" (")[0].toLowerCase()];
  if (f.required) bits.push("required");
  if (f.type === "secret") bits.push("encrypted");
  return bits.join(" · ");
}

function blank(type: FieldType, taken: string[]): FieldDef {
  let key: string = type;
  for (let n = 2; taken.includes(key); n++) key = `${type}_${n}`;
  return {
    key,
    type,
    required: type !== "info",
    label: { en: FIELD_TYPES[type].split(" (")[0] },
    ...(WITH_CHOICES.includes(type) && type !== "model" ? { options: ["Option 1", "Option 2"] } : {}),
    ...(type === "secret" || type === "remoteId" ? { hideAfterDone: true } : {}),
    ...(type === "file" ? { accept: "image" as const } : {}),
  };
}

/** Order form builder (mockup "Order form"): add fields, edit the selected one, see the customer's view. */
export function FormBuilder({ productId, initial, fromSupplier, serviceType }: { productId: string; initial: FieldDef[]; fromSupplier: boolean; serviceType: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<FieldDef[]>(initial);
  const [sel, setSel] = useState<number>(initial.length ? 0 : -1);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const f = fields[sel];

  const update = (patch: Partial<FieldDef>) => setFields(fields.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= fields.length || from === to) return;
    const next = [...fields];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setFields(next);
    setSel(to);
  };
  const add = (type: FieldType) => {
    const next = [...fields, blank(type, fields.map((x) => x.key))];
    setFields(next);
    setSel(next.length - 1);
  };
  const problem = formProblem(fields, preview);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[32px] tracking-tight">Order form</h1>
          <p className="text-sm text-muted">What the customer fills in before paying. Drag to reorder.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
          <button type="button" className="btn-primary min-h-11 px-5" disabled={pending}
            onClick={() => start(async () => {
              const r = await saveProductForm(productId, fields);
              setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            })}>
            {pending ? "Saving…" : "Save form"}
          </button>
        </div>
      </div>

      <section className="card space-y-3 p-4" aria-label="Add a field">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold">Add a field</span>
          {(Object.keys(FIELD_TYPES) as FieldType[]).map((type) => (
            <button key={type} type="button" onClick={() => add(type)} className="inline-flex min-h-10 items-center rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:border-primary hover:text-primary">+ {FIELD_TYPES[type]}</button>
          ))}
        </div>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">or start from a template</span>
          <select className="input min-h-10 w-auto" value="" onChange={(e) => {
            const tpl = FORM_TEMPLATES[e.target.value as keyof typeof FORM_TEMPLATES];
            if (tpl && (!fields.length || window.confirm(`Replace this form with “${tpl.name}”?`))) { setFields(structuredClone(tpl.fields)); setSel(0); }
          }}>
            <option value="">Choose…</option>
            {Object.entries(FORM_TEMPLATES).map(([k, tpl]) => <option key={k} value={k}>{tpl.name}</option>)}
          </select>
        </label>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_340px]">
        <div className="space-y-4 2xl:contents">
        <section className="card h-fit p-3">
          <h2 className="px-2 pb-2 font-semibold">Fields on this form</h2>
          {serviceType === "IMEI" && <p className="mx-2 mb-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">The IMEI box is set on the service page (it is always first).</p>}
          {!fields.length && <p className="px-2 py-6 text-center text-sm text-muted">No fields yet. Add one above or start from a template.</p>}
          <ol className="space-y-1.5">
            {fields.map((x, i) => (
              <li key={x.key + i} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag != null) move(drag, i); setDrag(null); }}
                className={`flex items-center gap-2 rounded-xl border p-2.5 ${i === sel ? "border-[#111418] bg-surface-2 dark:border-primary" : "border-border"}`}>
                <span aria-hidden className="cursor-grab select-none text-muted">⋮⋮</span>
                <button type="button" onClick={() => setSel(i)} className="min-w-0 flex-1 text-left">
                  <b className="block truncate text-sm">{x.label.en || x.label.ht || x.key}</b>
                  <span className="text-xs text-muted">{describe(x)}{x.showIf ? ` · shown only if ${x.showIf.key} = ${x.showIf.equals}` : ""}{x.type === "secret" ? " · staff only" : ""}</span>
                </button>
                <span className="flex flex-col">
                  <button type="button" aria-label="Move up" className="h-5 w-7 text-xs" onClick={() => move(i, i - 1)}>▲</button>
                  <button type="button" aria-label="Move down" className="h-5 w-7 text-xs" onClick={() => move(i, i + 1)}>▼</button>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className="card h-fit space-y-3.5 p-4 2xl:order-3">
          <h2 className="font-semibold">Customer preview</h2>
          <OrderFields defs={fields} values={preview} onChange={setPreview} locale="en" text={PREVIEW_TEXT} canUpload={false} idPrefix="pv" />
          {fields.length > 0 && <p className={`text-xs ${problem ? "text-warning" : "text-success"}`}>{problem ? `Order button would say: check “${problem.def.label.en || problem.def.key}”` : "Ready to order"}</p>}
        </section>
        </div>


        <section className="card h-fit space-y-3 p-4 2xl:order-2">
          {!f ? <p className="text-sm text-muted">Pick a field to edit it.</p> : (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{FIELD_TYPES[f.type]}</h2>
                <button type="button" className="text-sm font-semibold text-danger" onClick={() => { setFields(fields.filter((_, i) => i !== sel)); setSel(Math.max(0, sel - 1)); }}>Remove</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {LANGS.map((l) => (
                  <label key={l}><span className="label">Label · {l.toUpperCase()}</span>
                    <input className="input" value={f.label[l] ?? ""} onChange={(e) => update({ label: { ...f.label, [l]: e.target.value } })} />
                  </label>
                ))}
              </div>
              {f.type !== "info" && (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label><span className="label">Help text · EN</span><input className="input" value={f.help?.en ?? ""} onChange={(e) => update({ help: { ...f.help, en: e.target.value } })} /></label>
                    <label><span className="label">Help text · HT</span><input className="input" value={f.help?.ht ?? ""} onChange={(e) => update({ help: { ...f.help, ht: e.target.value } })} /></label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label><span className="label">Short name (internal)</span><input className="input font-mono text-sm" value={f.key} onChange={(e) => update({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) })} /></label>
                    <label><span className="label">Example in the box</span><input className="input" value={f.placeholder ?? ""} onChange={(e) => update({ placeholder: e.target.value })} /></label>
                  </div>
                </>
              )}
              {WITH_CHOICES.includes(f.type) && (
                f.choices?.length ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs">{f.choices.length} choices from the supplier list (e.g. {f.choices.slice(0, 3).map((c) => c.label).join(", ")}). <button type="button" className="font-semibold text-primary" onClick={() => update({ choices: undefined, options: f.choices!.map((c) => c.label) })}>Edit as my own list</button></p>
                ) : (
                  <label className="block"><span className="label">Choices (one per line)</span>
                    <textarea className="input min-h-24 py-2" value={(f.options ?? []).join("\n")} onChange={(e) => update({ options: e.target.value.split("\n") })} />
                  </label>
                )
              )}
              {WITH_RULES.includes(f.type) && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <label><span className="label">Allowed</span>
                    <select className="input" value={f.allowed ?? "any"} onChange={(e) => update({ allowed: e.target.value as FieldDef["allowed"] })}>
                      <option value="any">Any text</option><option value="digits">Digits only</option><option value="alnum">Letters and digits</option>
                    </select>
                  </label>
                  <label><span className="label">Min length</span><input className="input" inputMode="numeric" value={f.minLength ?? ""} onChange={(e) => update({ minLength: Number(e.target.value) || undefined })} /></label>
                  <label><span className="label">Max length</span><input className="input" inputMode="numeric" value={f.maxLength ?? ""} onChange={(e) => update({ maxLength: Number(e.target.value) || undefined })} /></label>
                </div>
              )}
              {f.type === "file" && (
                <label className="block"><span className="label">Accepts</span>
                  <select className="input" value={f.accept ?? "image"} onChange={(e) => update({ accept: e.target.value as "image" | "any" })}>
                    <option value="image">Photos and PDF (up to 12 MB)</option><option value="any">Any file: dumps, backups (up to 25 MB)</option>
                  </select>
                </label>
              )}
              {f.type !== "info" && (
                <div className="space-y-1.5 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.required} onChange={(e) => update({ required: e.target.checked })} /> Required</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.hideAfterDone || f.type === "secret"} disabled={f.type === "secret"} onChange={(e) => update({ hideAfterDone: e.target.checked })} /> Hidden after the order is done</label>
                  {f.type !== "secret" && f.type !== "file" && <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.remember} onChange={(e) => update({ remember: e.target.checked })} /> Remember for next order</label>}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <label><span className="label">Show only if…</span>
                  <select className="input" value={f.showIf?.key ?? ""} onChange={(e) => update({ showIf: e.target.value ? { key: e.target.value, equals: f.showIf?.equals ?? "" } : undefined })}>
                    <option value="">Always shown</option>
                    {fields.filter((x) => x.key !== f.key && x.type !== "info" && x.type !== "secret" && x.type !== "file").map((x) => <option key={x.key} value={x.key}>{x.label.en || x.key}</option>)}
                  </select>
                </label>
                {f.showIf && (() => {
                  const src = fields.find((x) => x.key === f.showIf!.key);
                  const opts = src?.type === "checkbox" ? [{ value: "yes", label: "Ticked" }] : src?.choices?.length ? src.choices : (src?.options ?? []).map((o) => ({ value: o, label: o }));
                  return (
                    <label><span className="label">…is</span>
                      {opts.length ? (
                        <select className="input" value={f.showIf.equals} onChange={(e) => update({ showIf: { key: f.showIf!.key, equals: e.target.value } })}>
                          <option value="">—</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : <input className="input" value={f.showIf.equals} onChange={(e) => update({ showIf: { key: f.showIf!.key, equals: e.target.value } })} />}
                    </label>
                  );
                })()}
              </div>
              {f.type !== "info" && (
                <details className="text-sm" open={fromSupplier}>
                  <summary className="cursor-pointer text-xs text-muted">Sent to the supplier as</summary>
                  <input className="input mt-2 font-mono text-sm" placeholder={f.label.en} value={f.supplierName ?? ""} onChange={(e) => update({ supplierName: e.target.value })} />
                  <p className="mt-1 text-xs text-muted">The supplier&apos;s exact field name, or param:MODELID, param:PIN… Empty = the English label.</p>
                </details>
              )}
            </>
          )}
        </section>

      </div>
      <p className="text-sm text-muted">Templates save time: start from “Remote job”, “IMEI service”, “Tool account (username)” or “License key”, then change what you need. Suppliers&apos; services fill this form in automatically when imported.</p>
    </div>
  );
}

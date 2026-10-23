"use client";
import { LocalizedField } from "./LocalizedInputs";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteKycRule, saveKycLevel, saveKycRule } from "@/actions/kyc-admin";
import { withStepUp } from "./ActionButton";

const REQ_TYPES: Record<string, string> = {
  email: "Confirmed email", phone: "Phone number", id_doc: "ID / passport / licence", selfie: "Selfie", video_selfie: "Video selfie",
  address_proof: "Proof of address", business_doc: "Business paper", shop_photo: "Shop photo", receipt: "Phone purchase receipt", upload: "Other upload", question: "Question (text answer)",
};
const OPS: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "is", in: "is one of", not_in: "is not one of", true: "is yes" };
const ACTIONS: Record<string, string> = { require_level: "Require a level", review: "Send to manual review", block: "Block", no_bonus: "No bonuses" };

type Level = { id?: string; key: string; name: Record<string, string>; description: Record<string, string>; rank: number; validMonths: number; joinsGroupId: string | null; isActive: boolean; requirements: { type: string; label: Record<string, string>; required: boolean }[] };
type Rule = { id?: string; name: string; sortOrder: number; isEnabled: boolean; conditions: { field: string; op: string; value?: string | number }[]; action: string; levelId: string | null; message: Record<string, string> };

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await withStepUp(fn);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  return { pending, msg, run };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? <span className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span> : null;
}

function LangInputs({ value, onChange, label }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; label: string }) {
  return <LocalizedField label={label} value={value} onChange={onChange} />;
}

function LevelCard({ level, groups }: { level: Level; groups: { id: string; name: string }[] }) {
  const [l, setL] = useState(level);
  const { pending, msg, run } = useSave();
  const setReq = (i: number, r: Partial<Level["requirements"][number]>) => setL({ ...l, requirements: l.requirements.map((x, n) => (n === i ? { ...x, ...r } : x)) });
  return (
    <details className="card p-4" open={!level.id}>
      <summary className="cursor-pointer font-semibold">{l.name.en || l.key} <span className="text-sm font-normal text-muted">· rank {l.rank} · {l.requirements.length} items{!l.isActive ? " · off" : ""}</span></summary>
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <label><span className="label">Key</span><input value={l.key} onChange={(e) => setL({ ...l, key: e.target.value })} className="input font-mono" /></label>
          <label><span className="label">Rank (higher = stronger)</span><input type="number" value={l.rank} onChange={(e) => setL({ ...l, rank: Number(e.target.value) })} className="input" /></label>
          <label><span className="label">Valid (months, 0 = always)</span><input type="number" value={l.validMonths} onChange={(e) => setL({ ...l, validMonths: Number(e.target.value) })} className="input" /></label>
          <label><span className="label">Joins price group</span>
            <select value={l.joinsGroupId ?? ""} onChange={(e) => setL({ ...l, joinsGroupId: e.target.value || null })} className="input">
              <option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        </div>
        <LangInputs label="Name" value={l.name} onChange={(name) => setL({ ...l, name })} />
        <LangInputs label="Description" value={l.description} onChange={(description) => setL({ ...l, description })} />
        <div>
          <span className="label">What the customer sends</span>
          <ul className="space-y-2">
            {l.requirements.map((r, i) => (
              <li key={i} className="space-y-2 rounded-xl bg-surface-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select value={r.type} onChange={(e) => setReq(i, { type: e.target.value })} className="input w-auto">{Object.entries(REQ_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={r.required} onChange={(e) => setReq(i, { required: e.target.checked })} /> Required</label>
                  <button type="button" className="ml-auto text-sm text-danger" onClick={() => setL({ ...l, requirements: l.requirements.filter((_, n) => n !== i) })}>Remove</button>
                </div>
                <LangInputs label="Label" value={r.label} onChange={(label) => setReq(i, { label })} />
              </li>
            ))}
          </ul>
          <button type="button" className="btn-secondary mt-2 min-h-9 px-3 text-xs" onClick={() => setL({ ...l, requirements: [...l.requirements, { type: "upload", label: {}, required: true }] })}>+ Add item</button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={l.isActive} onChange={(e) => setL({ ...l, isActive: e.target.checked })} /> Active</label>
          <button type="button" disabled={pending} onClick={() => run(() => saveKycLevel(l))} className="btn-primary min-h-10 px-4">Save level</button>
          <Msg msg={msg} />
        </div>
      </div>
    </details>
  );
}

export function KycLevelsEditor({ levels, groups }: { levels: Level[]; groups: { id: string; name: string }[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {levels.map((l) => <LevelCard key={l.id} level={l} groups={groups} />)}
      {adding ? (
        <LevelCard groups={groups} level={{ key: "new-level", name: { en: "New level" }, description: {}, rank: (levels.at(-1)?.rank ?? 0) + 1, validMonths: 24, joinsGroupId: null, isActive: true, requirements: [{ type: "id_doc", label: { en: "ID document" }, required: true }] }} />
      ) : (
        <button type="button" className="btn-secondary min-h-10 px-4" onClick={() => setAdding(true)}>+ New level</button>
      )}
    </div>
  );
}

function RuleCard({ rule, fields, levels }: { rule: Rule; fields: Record<string, string>; levels: { id: string; name: string }[] }) {
  const [r, setR] = useState(rule);
  const { pending, msg, run } = useSave();
  const setC = (i: number, c: Partial<Rule["conditions"][number]>) => setR({ ...r, conditions: r.conditions.map((x, n) => (n === i ? { ...x, ...c } : x)) });
  const moneyField = (f: string) => f === "amount" || f === "monthly_spend";
  return (
    <div className={`card space-y-3 p-4 ${!r.isEnabled ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="input min-w-0 flex-1 font-semibold" aria-label="Rule name" />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={r.isEnabled} onChange={(e) => setR({ ...r, isEnabled: e.target.checked })} /> On</label>
        <label className="flex items-center gap-1.5 text-sm">Order <input type="number" value={r.sortOrder} onChange={(e) => setR({ ...r, sortOrder: Number(e.target.value) })} className="input w-20" /></label>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-semibold">When</span>
        {r.conditions.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {i > 0 && <span className="text-xs font-bold text-muted">AND</span>}
            <select value={c.field} onChange={(e) => setC(i, { field: e.target.value })} className="input w-auto">{Object.entries(fields).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={c.op} onChange={(e) => setC(i, { op: e.target.value })} className="input w-auto">{Object.entries(OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            {c.op !== "true" && (
              <input
                value={moneyField(c.field) && typeof c.value === "number" ? (c.value / 100).toString() : String(c.value ?? "")}
                onChange={(e) => setC(i, { value: moneyField(c.field) ? Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0 : e.target.value })}
                className="input w-44" placeholder={moneyField(c.field) ? "USD" : "value"} aria-label="Value"
              />
            )}
            <button type="button" className="text-sm text-danger" onClick={() => setR({ ...r, conditions: r.conditions.filter((_, n) => n !== i) })}>×</button>
          </div>
        ))}
        <button type="button" className="btn-ghost min-h-9 px-2 text-xs" onClick={() => setR({ ...r, conditions: [...r.conditions, { field: "amount", op: "gt", value: 10000 }] })}>+ Condition</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Then</span>
        <select value={r.action} onChange={(e) => setR({ ...r, action: e.target.value })} className="input w-auto">{Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {r.action === "require_level" && (
          <select value={r.levelId ?? ""} onChange={(e) => setR({ ...r, levelId: e.target.value || null })} className="input w-auto">
            <option value="">Pick a level</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>
      <LangInputs label="Message to the customer" value={r.message} onChange={(message) => setR({ ...r, message })} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={() => run(() => saveKycRule(r))} className="btn-primary min-h-10 px-4">Save rule</button>
        {r.id && <button type="button" disabled={pending} onClick={() => confirm("Delete this rule?") && run(() => deleteKycRule(r.id!))} className="btn-secondary min-h-10 px-4 text-danger">Delete</button>}
        <Msg msg={msg} />
      </div>
    </div>
  );
}

export function KycRulesEditor({ rules, fields, levels }: { rules: Rule[]; fields: Record<string, string>; levels: { id: string; name: string }[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {rules.map((r) => <RuleCard key={r.id} rule={r} fields={fields} levels={levels} />)}
      {adding ? (
        <RuleCard fields={fields} levels={levels} rule={{ name: "New rule", sortOrder: (rules.at(-1)?.sortOrder ?? 0) + 1, isEnabled: true, conditions: [{ field: "action", op: "eq", value: "order" }], action: "review", levelId: null, message: {} }} />
      ) : (
        <button type="button" className="btn-secondary min-h-10 px-4" onClick={() => setAdding(true)}>+ New rule</button>
      )}
    </div>
  );
}

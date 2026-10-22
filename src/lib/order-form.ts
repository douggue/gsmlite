/**
 * Order form fields ("What the customer fills in"): definitions, conditions, checks and templates.
 * Pure functions, shared by the form builder, the order card and the server.
 */
import { isValidIdentifier, cleanIdentifier } from "./imei";

export const FIELD_TYPES = {
  text: "Short text",
  textarea: "Long text (notes)",
  number: "Number",
  email: "Email",
  tel: "Phone",
  url: "Link",
  select: "Dropdown",
  radio: "Choice buttons (radio)",
  checkbox: "Checkbox (“I confirm…”)",
  imei: "IMEI (checked)",
  serial: "Serial number",
  model: "Phone model (list)",
  file: "Photo / file upload",
  remoteId: "Remote ID (AnyDesk, TeamViewer…)",
  secret: "Password (hidden, encrypted)",
  date: "Date · time slot",
  info: "Info text (no input)",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

export type Choice = { value: string; label: string };

export type FieldDef = {
  key: string;
  label: Record<string, string>;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  /** Help under the box, per language */
  help?: Record<string, string>;
  /** select / radio / model: the choices (plain values) */
  options?: string[];
  /** select / model from a supplier list: value sent ≠ label shown (MODELID, PROVIDERID) */
  choices?: Choice[];
  /** Allowed characters for text, remoteId, number */
  allowed?: "any" | "digits" | "alnum";
  minLength?: number;
  maxLength?: number;
  /** file: "image" (photos, PDF) or "any" (dumps, backups) */
  accept?: "image" | "any";
  /** Removed from the order once it is done or refunded (passwords, remote IDs) */
  hideAfterDone?: boolean;
  /** Filled in again from the customer's last order on this device */
  remember?: boolean;
  /** Shown (and checked) only when another field has this value */
  showIf?: { key: string; equals: string };
  /** Name of this input on the supplier's side (Dhru CUSTOMFIELD key, or "param:NAME"). Empty = the English label. */
  supplierName?: string;
};

/** Field types that carry no value */
export const NO_VALUE: FieldType[] = ["info"];
/** Stored encrypted ("enc:…") and shown to staff only after a logged reveal */
export const SECRET_TYPES: FieldType[] = ["secret"];

export function isVisible(def: FieldDef, values: Record<string, string>): boolean {
  if (!def.showIf?.key) return true;
  return (values[def.showIf.key] ?? "") === def.showIf.equals;
}

export function maxLen(def: FieldDef): number {
  if (def.maxLength) return Math.min(def.maxLength, 1000);
  return def.type === "textarea" ? 1000 : 200;
}

/** Choices a select/radio/model accepts (value side). */
export function allowedValues(def: FieldDef): string[] {
  return def.choices?.length ? def.choices.map((c) => c.value) : def.options ?? [];
}

export type FieldProblem = "missing" | "email" | "number" | "choice" | "length" | "chars" | "imei" | "serial" | "url" | "date" | "confirm";

/** Normalize a typed value the way the server stores it (IMEI without spaces, serial in capitals…). */
export function normalizeValue(def: FieldDef, raw: string): string {
  const v = raw.trim();
  if (def.type === "imei") return cleanIdentifier(v, "imei");
  if (def.type === "serial") return cleanIdentifier(v, "serial");
  if (def.type === "remoteId" && def.allowed === "digits") return v.replace(/\s/g, "");
  return v;
}

/** What is wrong with one value (null = fine). Hidden fields are never checked. */
export function fieldProblem(def: FieldDef, raw: string): FieldProblem | null {
  if (NO_VALUE.includes(def.type)) return null;
  const v = normalizeValue(def, raw);
  if (!v) return def.required ? (def.type === "checkbox" ? "confirm" : "missing") : null;
  if (v.length > maxLen(def) || (def.minLength && v.length < def.minLength)) return "length";
  switch (def.type) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "email";
    case "number":
      return /^\d+$/.test(v) ? null : "number";
    case "tel":
      return /^\+?[\d\s\-().]{6,20}$/.test(v) ? null : "number";
    case "url":
      return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v) ? null : "url";
    case "select":
    case "radio":
    case "model": {
      const ok = allowedValues(def);
      return ok.length && !ok.includes(v) ? "choice" : null;
    }
    case "checkbox":
      return v === "yes" ? null : "confirm";
    case "imei":
      return isValidIdentifier(v, "imei") ? null : "imei";
    case "serial":
      return isValidIdentifier(v, "serial") ? null : "serial";
    case "date":
      return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v) && !Number.isNaN(new Date(v).getTime()) ? null : "date";
    case "file":
      return /^[a-z0-9]{20,40}$/.test(v) ? null : "missing";
  }
  if (def.allowed === "digits" && !/^\d+$/.test(v)) return "chars";
  if (def.allowed === "alnum" && !/^[A-Za-z0-9]+$/.test(v)) return "chars";
  return null;
}

/** First problem in a whole form (only visible fields), with the field it is about. */
export function formProblem(defs: FieldDef[], values: Record<string, string>): { def: FieldDef; problem: FieldProblem } | null {
  for (const d of defs) {
    if (!isVisible(d, values)) continue;
    const p = fieldProblem(d, values[d.key] ?? "");
    if (p) return { def: d, problem: p };
  }
  return null;
}

/** Shown value for a stored one (choice label instead of a supplier ID). */
export function displayValue(def: FieldDef | undefined, v: string): string {
  if (!def) return v;
  if (def.type === "checkbox") return v === "yes" ? "✓" : v;
  if (def.choices?.length) return def.choices.find((c) => c.value === v)?.label ?? v;
  return v;
}

const L = (en: string, ht?: string, fr?: string, es?: string) => ({ en, ...(ht ? { ht } : {}), ...(fr ? { fr } : {}), ...(es ? { es } : {}) });

/** Starting points in the builder; staff change what they need. */
export const FORM_TEMPLATES: Record<string, { name: string; fields: FieldDef[] }> = {
  remote: {
    name: "Remote job",
    fields: [
      { key: "model", type: "model", required: true, label: L("Phone model", "Modèl telefòn", "Modèle du téléphone", "Modelo del teléfono"), options: [], remember: false },
      { key: "remote_id", type: "remoteId", required: true, label: L("AnyDesk ID", "ID AnyDesk", "ID AnyDesk", "ID de AnyDesk"), allowed: "digits", minLength: 9, maxLength: 10, help: L("9 or 10 digits, top left of AnyDesk", "9 oswa 10 chif, anlè agoch nan AnyDesk", "9 ou 10 chiffres, en haut à gauche d'AnyDesk", "9 o 10 dígitos, arriba a la izquierda de AnyDesk"), hideAfterDone: true, remember: true },
      { key: "remote_pass", type: "secret", required: true, label: L("AnyDesk password", "Modpas AnyDesk", "Mot de passe AnyDesk", "Contraseña de AnyDesk"), hideAfterDone: true },
      { key: "ready", type: "checkbox", required: true, label: L("I'm at my PC with the phone connected", "Mwen devan PC a, telefòn nan konekte", "Je suis devant mon PC, le téléphone branché", "Estoy en mi PC con el teléfono conectado") },
    ],
  },
  imei: {
    name: "IMEI service",
    fields: [
      { key: "model", type: "model", required: false, label: L("Phone model", "Modèl telefòn", "Modèle du téléphone", "Modelo del teléfono"), options: [] },
      { key: "note", type: "textarea", required: false, label: L("Notes for us", "Nòt pou nou", "Notes pour nous", "Notas para nosotros") },
    ],
  },
  account: {
    name: "Tool account (username)",
    fields: [
      { key: "username", type: "text", required: true, label: L("Tool username", "Non itilizatè zouti a", "Nom d'utilisateur de l'outil", "Usuario de la herramienta"), allowed: "any", remember: true },
      { key: "email", type: "email", required: false, label: L("Email on the account", "Imèl kont lan", "Email du compte", "Correo de la cuenta"), remember: true },
    ],
  },
  license: {
    name: "License key",
    fields: [
      { key: "hwid", type: "text", required: false, label: L("Hardware ID (if the tool asks)", "Hardware ID (si zouti a mande l)", "ID matériel (si l'outil le demande)", "ID de hardware (si la herramienta lo pide)"), allowed: "any" },
      { key: "info", type: "info", required: false, label: L("The key is sent by email and shown in your order.", "N ap voye kle a pa imèl, l ap parèt nan kòmand ou.", "La clé est envoyée par email et affichée dans votre commande.", "La clave se envía por correo y aparece en tu pedido.") },
    ],
  },
};

/** Builder input is untrusted: keep only known properties with sane sizes. */
export function sanitizeFields(raw: unknown): FieldDef[] {
  if (!Array.isArray(raw)) throw new Error("Fields must be a list");
  const keys = new Set<string>();
  const loc = (v: unknown, n: number) =>
    Object.fromEntries(Object.entries(v && typeof v === "object" ? (v as Record<string, unknown>) : {}).filter(([k, x]) => /^[a-z]{2}$/.test(k) && typeof x === "string" && x.trim()).map(([k, x]) => [k, String(x).trim().slice(0, n)]));
  const out: FieldDef[] = [];
  for (const r of raw.slice(0, 40) as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const type = String(r.type) as FieldType;
    if (!(type in FIELD_TYPES)) throw new Error(`Unknown field type ${String(r.type)}`);
    const key = String(r.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    if (!key || keys.has(key)) throw new Error(`Each field needs its own short name (${key || "empty"})`);
    keys.add(key);
    const label = loc(r.label, 200);
    if (!label.en && !label.ht && !label.fr) throw new Error(`Field “${key}” needs a label`);
    const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 500) : undefined);
    const choices = Array.isArray(r.choices)
      ? (r.choices as Record<string, unknown>[]).map((c) => ({ value: String(c?.value ?? "").slice(0, 60), label: String(c?.label ?? "").slice(0, 120) })).filter((c) => c.value && c.label).slice(0, 3000)
      : undefined;
    const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(1000, Math.round(Number(v))) : undefined);
    const showIf = r.showIf && typeof r.showIf === "object" && (r.showIf as Record<string, unknown>).key ? { key: String((r.showIf as Record<string, unknown>).key).slice(0, 40), equals: String((r.showIf as Record<string, unknown>).equals ?? "").slice(0, 120) } : undefined;
    const f: FieldDef = {
      key,
      type,
      label,
      required: type !== "info" && !!r.required,
      ...(typeof r.placeholder === "string" && r.placeholder.trim() ? { placeholder: r.placeholder.trim().slice(0, 100) } : {}),
      ...(Object.keys(loc(r.help, 300)).length ? { help: loc(r.help, 300) } : {}),
      ...(list(r.options)?.length ? { options: list(r.options) } : {}),
      ...(choices?.length ? { choices } : {}),
      ...(["any", "digits", "alnum"].includes(String(r.allowed)) ? { allowed: r.allowed as FieldDef["allowed"] } : {}),
      ...(n(r.minLength) ? { minLength: n(r.minLength) } : {}),
      ...(n(r.maxLength) ? { maxLength: n(r.maxLength) } : {}),
      ...(type === "file" ? { accept: r.accept === "any" ? "any" : "image" } : {}),
      ...(r.hideAfterDone || type === "secret" ? { hideAfterDone: true } : {}),
      ...(r.remember && type !== "secret" && type !== "file" ? { remember: true } : {}),
      ...(showIf ? { showIf } : {}),
      ...(typeof r.supplierName === "string" && r.supplierName.trim() ? { supplierName: r.supplierName.trim().slice(0, 80) } : {}),
    };
    out.push(f);
  }
  for (const f of out) if (f.showIf && !keys.has(f.showIf.key)) throw new Error(`“${f.key}” is shown only if a field that does not exist`);
  return out;
}

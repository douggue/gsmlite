/**
 * Dhru Fusion API v6.1 wire format, shared by the supplier client (we call other sites) and the reseller
 * API (other sites and tools call us). Pure functions only, so both sides are unit-tested against the same rules.
 *
 * Request: POST <site>/api/index.php, form fields username, apiaccesskey, action, requestformat=JSON, parameters.
 * `parameters` is XML (<PARAMETERS><ID>..</ID></PARAMETERS>, classic kit) or base64 JSON (newer kits, bulk actions).
 * Reply: JSON { SUCCESS: [...] } or { ERROR: [{ MESSAGE }] }, plus "apiversion".
 * Order status: 0 new, 1 in process, 3 rejected (refunded), 4 success (result in CODE).
 */

export const DHRU_ACTIONS = [
  "accountinfo",
  "imeiservicelist",
  "placeimeiorder",
  "placeimeiorderbulk",
  "getimeiorder",
  "getimeiorderbulk",
] as const;
export type DhruAction = (typeof DHRU_ACTIONS)[number];

export type DhruParams = Record<string, string | number | undefined>;

/** Standard order parameters a service can require (Requires.<Name> in the service list). */
export const STANDARD_PARAMS: Record<string, string> = {
  Network: "NETWORK",
  Mobile: "MODELID",
  Provider: "PROVIDERID",
  PIN: "PIN",
  KBH: "KBH",
  MEP: "MEP",
  PRD: "PRD",
  Type: "TYPE",
  Reference: "REFERENCE",
  Locks: "LOCKS",
  SN: "SN",
  SecRO: "SECRO",
};

// ─────────────────────────────── Encoding ───────────────────────────────

function xmlEscape(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function encodeParams(params: DhruParams, format: "xml" | "json"): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string | number][];
  if (format === "json") return Buffer.from(JSON.stringify(Object.fromEntries(entries.map(([k, v]) => [k.toUpperCase(), String(v)])))).toString("base64");
  return `<PARAMETERS>${entries.map(([k, v]) => `<${k.toUpperCase()}>${xmlEscape(String(v))}</${k.toUpperCase()}>`).join("")}</PARAMETERS>`;
}

/** CUSTOMFIELD value: base64 of the JSON object keyed by the supplier's exact field names. */
export function encodeCustomFields(values: Record<string, string>): string | undefined {
  return Object.keys(values).length ? Buffer.from(JSON.stringify(values)).toString("base64") : undefined;
}

export function requestBody(auth: { username: string; apiKey: string }, action: DhruAction, params?: DhruParams, format: "xml" | "json" = "xml") {
  const body = new URLSearchParams({ username: auth.username, apiaccesskey: auth.apiKey, action, requestformat: "JSON" });
  // Bulk actions are base64 JSON in every kit; single-order actions follow the supplier's setting.
  if (params) body.set("parameters", action.endsWith("bulk") ? Buffer.from(JSON.stringify(params)).toString("base64") : encodeParams(params, format));
  return body;
}

/** "https://site.com", "site.com/", "https://site.com/api/index.php" → "https://site.com/api/index.php" */
export function endpointUrl(base: string): string {
  let u = base.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const url = new URL(u);
  if (!/\/api\/index\.php$/i.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/index.php`;
  return url.toString();
}

// ─────────────────────────────── Decoding (incoming requests) ───────────────────────────────

function decodeXmlText(v: string) {
  return v
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function tryBase64Json(v: string): unknown {
  if (!/^[A-Za-z0-9+/=\s_-]+$/.test(v)) return undefined;
  try {
    const text = Buffer.from(v.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Read the `parameters` field however the client sent it: XML, base64 JSON or plain JSON.
 * Keys are upper-cased (Dhru clients send IMEI, imei, Imei…). Returns null when it can't be read.
 */
export function decodeParams(raw: string | null | undefined): Record<string, unknown> | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (!v) return {};
  if (v.startsWith("<")) {
    const inner = /<PARAMETERS>([\s\S]*)<\/PARAMETERS>/i.exec(v)?.[1];
    if (inner === undefined) return null;
    const out: Record<string, unknown> = {};
    for (const m of inner.matchAll(/<([A-Za-z0-9_.]+)>([\s\S]*?)<\/\1>/g)) out[m[1].toUpperCase()] = decodeXmlText(m[2]);
    for (const m of inner.matchAll(/<([A-Za-z0-9_.]+)\s*\/>/g)) out[m[1].toUpperCase()] = "";
    return out;
  }
  const parsed = v.startsWith("{") ? safeJson(v) : tryBase64Json(v);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return upperKeys(parsed as Record<string, unknown>);
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

function upperKeys(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toUpperCase(), v]));
}

/** CUSTOMFIELD: base64 JSON string, plain JSON string, or an object already (bulk). Keys kept exactly. */
export function decodeCustomFields(v: unknown): Record<string, string> {
  let o: unknown = v;
  if (typeof v === "string") o = v.trim().startsWith("{") ? safeJson(v.trim()) : tryBase64Json(v.trim());
  if (!o || typeof o !== "object" || Array.isArray(o)) return {};
  return Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, x]) => [k, x == null ? "" : String(x)]));
}

// ─────────────────────────────── Replies ───────────────────────────────

export type DhruReply = Record<string, unknown>;

export const API_VERSION = "6.1";

export function ok(payload: Record<string, unknown>): DhruReply {
  return { SUCCESS: [payload], apiversion: API_VERSION };
}

export function err(message: string): DhruReply {
  return { ERROR: [{ MESSAGE: message }], apiversion: API_VERSION };
}

/** Body of a reply. Some servers prefix PHP notices or a BOM before the JSON; skip to the first "{". */
export function parseReply(text: string): DhruReply | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const parsed = safeJson(text.slice(start).trim());
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as DhruReply) : null;
}

function first(reply: DhruReply, key: "SUCCESS" | "ERROR"): Record<string, unknown> | undefined {
  const v = reply[key] ?? reply[key.toLowerCase()];
  if (Array.isArray(v)) return v[0] as Record<string, unknown>;
  if (v && typeof v === "object") return v as Record<string, unknown>;
  return undefined;
}

/** Case-insensitive property read (servers mix "MESSAGE"/"message", "AccoutInfo"/"AccountInfo"). */
function pick(o: Record<string, unknown> | undefined, ...names: string[]): unknown {
  if (!o) return undefined;
  for (const n of names) {
    const hit = Object.keys(o).find((k) => k.toLowerCase() === n.toLowerCase());
    if (hit !== undefined) return o[hit];
  }
  return undefined;
}

export function replyError(reply: DhruReply): string | null {
  const e = first(reply, "ERROR");
  if (!e) return null;
  return String(pick(e, "MESSAGE", "FULL_DESCRIPTION") ?? "Unknown error");
}

/** "$1,234.50", "1234.5", 12 → cents. */
export function toCents(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[^\d.-]/g, "")) : NaN;
  if (!Number.isFinite(n)) return null;
  // toPrecision removes float noise first (1.005 * 100 = 100.49999…), so half-cents round up as people expect.
  return Math.round(Number((n * 100).toPrecision(12)));
}

export function parseAccountInfo(reply: DhruReply): { credit: number | null; currency: string | null; email: string | null } {
  const s = first(reply, "SUCCESS");
  const info = pick(s, "AccountInfo", "AccoutInfo") as Record<string, unknown> | undefined;
  return {
    credit: toCents(pick(info, "creditraw") ?? pick(info, "credit")),
    currency: (pick(info, "currency") as string | undefined) ?? null,
    email: (pick(info, "mail", "email") as string | undefined) ?? null,
  };
}

export type SupplierField = {
  /** Exact name to send back: a CUSTOMFIELD key, or a standard parameter such as "PIN" when kind is "param" */
  name: string;
  kind: "custom" | "param";
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
  description?: string;
};

export type ParsedService = {
  remoteId: string;
  groupName: string;
  name: string;
  type: "IMEI" | "SERVER" | "REMOTE" | "FILE";
  credit: number;
  time: string | null;
  info: string | null;
  identifierLabel: string | null;
  bulk: boolean;
  qty: { min: number; max: number } | null;
  fields: SupplierField[];
};

function serviceType(v: unknown, fallback: unknown): "IMEI" | "SERVER" | "REMOTE" | "FILE" {
  const s = String(v ?? fallback ?? "").toUpperCase();
  if (s === "SERVER" || s === "1") return "SERVER";
  if (s === "REMOTE" || s === "2") return "REMOTE";
  return "IMEI";
}

function fieldType(v: unknown): SupplierField["type"] {
  const s = String(v ?? "").toLowerCase();
  if (s === "dropdown" || s === "radio" || s === "select") return "select";
  if (s === "textarea") return "textarea";
  return "text";
}

const isRequired = (v: unknown) => ["1", "on", "true", "required", "yes"].includes(String(v ?? "").toLowerCase());

/** Flatten the service list (LIST → groups → SERVICES) into one array. Unknown shapes are skipped, not fatal. */
export function parseServiceList(reply: DhruReply): ParsedService[] {
  const s = first(reply, "SUCCESS");
  const list = pick(s, "LIST") as Record<string, unknown> | undefined;
  if (!list || typeof list !== "object") return [];
  const out: ParsedService[] = [];
  for (const [groupKey, g] of Object.entries(list)) {
    if (!g || typeof g !== "object") continue;
    const group = g as Record<string, unknown>;
    const groupName = String(pick(group, "GROUPNAME") ?? groupKey);
    const services = pick(group, "SERVICES") as Record<string, unknown> | unknown[] | undefined;
    if (!services || typeof services !== "object") continue;
    for (const raw of Object.values(services)) {
      if (!raw || typeof raw !== "object") continue;
      const sv = raw as Record<string, unknown>;
      const id = pick(sv, "SERVICEID");
      if (id === undefined || id === null || id === "") continue;
      const type = serviceType(pick(sv, "SERVICETYPE") ?? pick(sv, "SERVER"), pick(group, "GROUPTYPE"));
      const fields: SupplierField[] = [];
      for (const [label, param] of Object.entries(STANDARD_PARAMS)) {
        const flag = pick(sv, `Requires.${label}`);
        if (flag !== undefined && String(flag).toLowerCase() !== "none" && String(flag) !== "" && String(flag) !== "0") {
          fields.push({ name: param, kind: "param", type: "text", required: isRequired(flag) || String(flag).toLowerCase() === "required" });
        }
      }
      const custom = pick(sv, "Requires.Custom");
      const customList = Array.isArray(custom) ? custom : custom && typeof custom === "object" ? Object.values(custom) : [];
      for (const c of customList) {
        if (!c || typeof c !== "object") continue;
        const cf = c as Record<string, unknown>;
        const name = String(pick(cf, "fieldname") ?? "").trim();
        if (!name || String(pick(cf, "adminonly") ?? "") === "1") continue;
        const options = String(pick(cf, "fieldoptions") ?? "").split(/[,\n]/).map((o) => o.trim()).filter(Boolean);
        fields.push({
          name,
          kind: "custom",
          type: fieldType(pick(cf, "fieldtype")),
          required: isRequired(pick(cf, "required")),
          ...(options.length ? { options } : {}),
          ...(pick(cf, "description") ? { description: String(pick(cf, "description")) } : {}),
        });
      }
      const idBox = pick(sv, "CUSTOM") as Record<string, unknown> | undefined;
      const hasQty = String(pick(sv, "QNT") ?? "0") === "1";
      const minQ = Number(pick(sv, "MINQNT")) || 1;
      const maxQ = Number(pick(sv, "MAXQNT")) || 0;
      out.push({
        remoteId: String(id),
        groupName,
        name: String(pick(sv, "SERVICENAME") ?? `Service ${id}`).trim(),
        type,
        credit: toCents(pick(sv, "CREDIT")) ?? 0,
        time: (pick(sv, "TIME") as string | undefined) ?? null,
        info: (pick(sv, "INFO") as string | undefined) || null,
        identifierLabel: type === "IMEI" ? (String(pick(idBox, "customname") ?? "") || "IMEI") : null,
        bulk: String(pick(idBox, "bulk") ?? "0") === "1",
        qty: hasQty ? { min: minQ, max: Math.max(minQ, maxQ || 10_000) } : null,
        fields,
      });
    }
  }
  return out;
}

export function parsePlaceOrder(reply: DhruReply): { ref: string } | { error: string } {
  const e = replyError(reply);
  if (e) return { error: e };
  const ref = pick(first(reply, "SUCCESS"), "REFERENCEID", "REFERENCE_ID", "ORDERID", "ID");
  if (ref === undefined || ref === null || String(ref) === "") return { error: "No REFERENCEID in the reply" };
  return { ref: String(ref) };
}

export type RemoteStatus = "WAITING" | "IN_PROCESS" | "REJECTED" | "SUCCESS";

export function parseOrderStatus(reply: DhruReply): { status: RemoteStatus; code: string; comments: string } | { error: string } {
  const e = replyError(reply);
  if (e) return { error: e };
  const s = first(reply, "SUCCESS");
  const raw = pick(s, "STATUS");
  if (raw === undefined) return { error: "No STATUS in the reply" };
  const n = String(raw).trim();
  const status: RemoteStatus | null =
    n === "4" ? "SUCCESS" : n === "3" ? "REJECTED" : n === "1" ? "IN_PROCESS" : n === "0" ? "WAITING" : null;
  if (!status) return { error: `Unknown STATUS ${n}` };
  return { status, code: String(pick(s, "CODE") ?? ""), comments: String(pick(s, "COMMENTS") ?? "") };
}

export function statusCode(s: RemoteStatus): number {
  return s === "SUCCESS" ? 4 : s === "REJECTED" ? 3 : s === "IN_PROCESS" ? 1 : 0;
}

/**
 * Supplier results are often HTML ("Unlocked<br>Code: 1234", <font>, &nbsp;). Keep the text and line breaks,
 * drop every tag, so it can be shown safely as plain text.
 */
export function resultText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h\d)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5000);
}

/**
 * Refusals that are about our account with the supplier (balance, key, IP, maintenance), not the customer's
 * order. Those keep the line waiting for staff instead of refunding the customer.
 */
export function isAccountProblem(message: string): boolean {
  return /credit|balance|fund|insufficient|auth|api ?(access )?key|access key|username|ip\b|ip address|unauthori[sz]ed|maintenance|too many|rate limit|frequent|suspend|blocked/i.test(message);
}

import "server-only";
import type { KycLevel, KycRule, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { t } from "./text";

export type Requirement = { type: string; label: Record<string, string>; required: boolean };
export type Condition = { field: string; op: "gt" | "gte" | "lt" | "lte" | "eq" | "in" | "not_in" | "true"; value?: unknown };

/** What the customer is about to do. Amounts in USD cents. */
export type KycContext = {
  action: "topup" | "order" | "technician";
  amountUsd?: number;
  /** WALLET, MONCASH, NATCASH, CARD, MANUAL:<id> */
  method?: string;
  productIds?: string[];
  categoryIds?: string[];
  country?: string | null;
};

export type KycDecision =
  | { ok: true; review: boolean; noBonus: boolean; rule?: string }
  | { ok: false; blocked: boolean; level: { key: string; name: string } | null; message: string; rule: string };

/** Condition fields the owner can use (also shown in the rule editor). */
export const KYC_FIELDS = {
  action: "What they do (topup, order, technician)",
  amount: "Top-up or order amount (USD)",
  monthly_spend: "Spent in the last 30 days (USD)",
  method: "Payment method (MONCASH, NATCASH, CARD, MANUAL:…)",
  service: "Service (product id)",
  category: "Category (id)",
  country: "Country (ISO code)",
  account_age_days: "Account age (days)",
  price_group: "Price group (name)",
  orders_count: "Paid orders so far",
  same_device: "Same device as another account",
  risk_flag: "Has an open risk flag",
} as const;

export const DEFAULT_LEVELS: { key: string; rank: number; name: Record<string, string>; description: Record<string, string>; requirements: Requirement[]; validMonths: number }[] = [
  {
    key: "basic", rank: 1, validMonths: 0,
    name: { en: "Basic", ht: "Debaz", fr: "Basique", es: "Básico" },
    description: { en: "Email and phone confirmed", ht: "Imèl ak telefòn konfime", fr: "E-mail et téléphone confirmés", es: "Correo y teléfono confirmados" },
    requirements: [
      { type: "email", label: { en: "Confirmed email", ht: "Imèl konfime", fr: "E-mail confirmé", es: "Correo confirmado" }, required: true },
      { type: "phone", label: { en: "Phone number", ht: "Nimewo telefòn", fr: "Numéro de téléphone", es: "Número de teléfono" }, required: true },
    ],
  },
  {
    key: "verified", rank: 2, validMonths: 24,
    name: { en: "Verified", ht: "Verifye", fr: "Vérifié", es: "Verificado" },
    description: { en: "ID card, passport or licence + a selfie", ht: "Kat idantite, paspò oswa lisans + yon selfi", fr: "Carte d'identité, passeport ou permis + un selfie", es: "Documento de identidad, pasaporte o licencia + una selfie" },
    requirements: [
      { type: "id_doc", label: { en: "ID card, passport or driver's licence", ht: "Kat idantite, paspò oswa lisans", fr: "Carte d'identité, passeport ou permis", es: "Documento de identidad, pasaporte o licencia" }, required: true },
      { type: "selfie", label: { en: "Selfie holding the ID", ht: "Selfi ak dokiman an nan men w", fr: "Selfie avec la pièce d'identité", es: "Selfie con el documento" }, required: true },
      { type: "address_proof", label: { en: "Proof of address (optional)", ht: "Prèv adrès (si w genyen)", fr: "Justificatif de domicile (facultatif)", es: "Comprobante de domicilio (opcional)" }, required: false },
    ],
  },
  {
    key: "shop", rank: 3, validMonths: 24,
    name: { en: "Shop / technician", ht: "Atelye / teknisyen", fr: "Atelier / technicien", es: "Taller / técnico" },
    description: { en: "Verified + shop photos and a business paper. Unlocks technician prices.", ht: "Verifye + foto atelye ak yon papye biznis. Ba w pri teknisyen.", fr: "Vérifié + photos de l'atelier et un document commercial. Donne accès aux prix technicien.", es: "Verificado + fotos del taller y un documento comercial. Da acceso a precios de técnico." },
    requirements: [
      { type: "id_doc", label: { en: "ID card, passport or driver's licence", ht: "Kat idantite, paspò oswa lisans", fr: "Carte d'identité, passeport ou permis", es: "Documento de identidad, pasaporte o licencia" }, required: true },
      { type: "selfie", label: { en: "Selfie holding the ID", ht: "Selfi ak dokiman an nan men w", fr: "Selfie avec la pièce d'identité", es: "Selfie con el documento" }, required: true },
      { type: "shop_photo", label: { en: "Photo of your shop (front and counter)", ht: "Foto atelye w (devan ak kontwa)", fr: "Photo de l'atelier (façade et comptoir)", es: "Foto del taller (fachada y mostrador)" }, required: true },
      { type: "business_doc", label: { en: "Business paper (patente, registration…)", ht: "Papye biznis (patant, enskripsyon…)", fr: "Document commercial (patente, immatriculation…)", es: "Documento comercial (registro, licencia…)" }, required: false },
      { type: "question", label: { en: "Shop name, city and WhatsApp", ht: "Non atelye a, vil ak WhatsApp", fr: "Nom de l'atelier, ville et WhatsApp", es: "Nombre del taller, ciudad y WhatsApp" }, required: true },
    ],
  },
];

/** Creates the three starter levels and rules the first time (the owner edits them in Admin → KYC → Levels & rules). */
export async function ensureKycDefaults() {
  if ((await prisma.kycLevel.count()) > 0) return;
  const tech = await prisma.priceGroup.upsert({ where: { name: "Technician" }, create: { name: "Technician", discountBps: 1000 }, update: {} });
  for (const l of DEFAULT_LEVELS) {
    await prisma.kycLevel.create({
      data: { key: l.key, rank: l.rank, name: l.name, description: l.description, requirements: l.requirements as Prisma.InputJsonValue, validMonths: l.validMonths, joinsGroupId: l.key === "shop" ? tech.id : null },
    });
  }
  const level = async (key: string) => (await prisma.kycLevel.findUniqueOrThrow({ where: { key } })).id;
  const msg = (en: string, ht: string, fr: string, es: string) => ({ en, ht, fr, es });
  await prisma.kycRule.createMany({
    data: [
      { sortOrder: 1, name: "Top-ups over $100 need Verified", action: "require_level", levelId: await level("verified"), conditions: [{ field: "action", op: "eq", value: "topup" }, { field: "amount", op: "gt", value: 10000 }],
        message: msg("Top-ups over $100 need a verified account. It takes a few minutes.", "Depo plis pase $100 mande yon kont verifye. Sa pran kèk minit.", "Les rechargements de plus de 100 $ demandent un compte vérifié. Cela prend quelques minutes.", "Las recargas de más de $100 necesitan una cuenta verificada. Toma unos minutos.") },
      { sortOrder: 2, name: "Card payments need Verified", action: "require_level", levelId: await level("verified"), conditions: [{ field: "method", op: "eq", value: "CARD" }],
        message: msg("Card payments need a verified account.", "Peman ak kat mande yon kont verifye.", "Les paiements par carte demandent un compte vérifié.", "Los pagos con tarjeta necesitan una cuenta verificada.") },
      { sortOrder: 3, name: "Technician prices need Shop", action: "require_level", levelId: await level("shop"), conditions: [{ field: "action", op: "eq", value: "technician" }],
        message: msg("Technician prices are for verified shops.", "Pri teknisyen yo se pou atelye ki verifye.", "Les prix technicien sont réservés aux ateliers vérifiés.", "Los precios de técnico son para talleres verificados.") },
      { sortOrder: 4, name: "Orders over $500 go to review", action: "review", isEnabled: false, conditions: [{ field: "action", op: "eq", value: "order" }, { field: "amount", op: "gt", value: 50000 }], message: {} },
    ],
  });
}

/** Strongest approved, unexpired level rank (0 = none). Levels made only of email/phone are approved automatically. */
export async function userKycRank(userId: string): Promise<{ rank: number; levelKey: string | null }> {
  const [user, approved, levels] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true, phone: true } }),
    prisma.kycSubmission.findMany({ where: { userId, status: "APPROVED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { level: true } }),
    prisma.kycLevel.findMany({ where: { isActive: true } }),
  ]);
  let best = { rank: 0, levelKey: null as string | null };
  for (const s of approved) if (s.level.rank > best.rank) best = { rank: s.level.rank, levelKey: s.level.key };
  for (const l of levels) {
    const reqs = (l.requirements as Requirement[]).filter((r) => r.required);
    const auto = reqs.length > 0 && reqs.every((r) => r.type === "email" || r.type === "phone");
    const met = reqs.every((r) => (r.type === "email" ? !!user?.emailVerified : r.type === "phone" ? !!user?.phone : false));
    if (auto && met && l.rank > best.rank) best = { rank: l.rank, levelKey: l.key };
  }
  return best;
}

/** Facts a rule may test, computed only when a rule asks for them. */
function facts(userId: string, ctx: KycContext) {
  const cache = new Map<string, Promise<unknown>>();
  const once = <T,>(k: string, f: () => Promise<T>) => {
    if (!cache.has(k)) cache.set(k, f());
    return cache.get(k) as Promise<T>;
  };
  return async (field: string): Promise<unknown> => {
    switch (field) {
      case "action": return ctx.action;
      case "amount": return ctx.amountUsd ?? 0;
      case "method": return ctx.method ?? "";
      case "service": return ctx.productIds ?? [];
      case "category": return ctx.categoryIds ?? [];
      case "country": return ctx.country ?? "";
      case "account_age_days":
        return once("age", async () => {
          const u = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
          return u ? Math.floor((Date.now() - u.createdAt.getTime()) / 86_400_000) : 0;
        });
      case "monthly_spend":
        return once("spend", async () => {
          const rows = await prisma.order.findMany({ where: { userId, paidAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, select: { total: true, currency: true, rateUsed: true } });
          return rows.reduce((s, o) => s + (o.currency === "USD" ? o.total : Math.round(o.total / Number(o.rateUsed ?? 130))), 0);
        });
      case "price_group":
        return once("group", async () => (await prisma.user.findUnique({ where: { id: userId }, select: { priceGroup: { select: { name: true } } } }))?.priceGroup?.name ?? "");
      case "orders_count":
        return once("orders", () => prisma.order.count({ where: { userId, paidAt: { not: null } } }));
      case "same_device":
        return once("device", async () => {
          const mine = await prisma.deviceSeen.findMany({ where: { userId }, select: { deviceId: true } });
          if (!mine.length) return false;
          return (await prisma.deviceSeen.count({ where: { deviceId: { in: mine.map((d) => d.deviceId) }, userId: { not: userId } } })) > 0;
        });
      case "risk_flag":
        return once("risk", async () => (await prisma.riskFlag.count({ where: { userId, status: "OPEN" } })) > 0);
      default: return undefined;
    }
  };
}

/** One condition against a fact. Arrays (services, categories) match when any item matches. */
export function test(c: Condition, value: unknown): boolean {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[\s,]+/).filter(Boolean));
  const any = (pred: (x: unknown) => boolean) => (Array.isArray(value) ? value.some(pred) : pred(value));
  switch (c.op) {
    case "true": return value === true;
    case "gt": return Number(value) > Number(c.value);
    case "gte": return Number(value) >= Number(c.value);
    case "lt": return Number(value) < Number(c.value);
    case "lte": return Number(value) <= Number(c.value);
    case "eq": return any((x) => String(x).toUpperCase() === String(c.value ?? "").toUpperCase());
    case "in": return any((x) => list(c.value).map((y) => y.toUpperCase()).includes(String(x).toUpperCase()));
    case "not_in": return !any((x) => list(c.value).map((y) => y.toUpperCase()).includes(String(x).toUpperCase()));
    default: return false;
  }
}

/**
 * Check the owner's rules for what the customer is about to do. Rules are tested in order; "require a level" rules the
 * customer already meets are passed over. The first blocking rule decides.
 */
export async function evaluateKyc(userId: string, ctx: KycContext, locale = "en", rules?: (KycRule & { level: KycLevel | null })[]): Promise<KycDecision> {
  const list = rules ?? (await prisma.kycRule.findMany({ where: { isEnabled: true }, include: { level: true }, orderBy: { sortOrder: "asc" } }));
  const get = facts(userId, ctx);
  let rank: number | null = null;
  let review = false;
  let noBonus = false;
  let reviewRule: string | undefined;
  for (const r of list) {
    const conds = (r.conditions as Condition[]) ?? [];
    let match = conds.length > 0;
    for (const c of conds) {
      if (!test(c, await get(c.field))) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    const message = t(r.message, locale);
    if (r.action === "block") return { ok: false, blocked: true, level: null, message, rule: r.name };
    if (r.action === "review") {
      review = true;
      reviewRule ??= r.name;
    }
    if (r.action === "no_bonus") noBonus = true;
    if (r.action === "require_level" && r.level) {
      rank ??= (await userKycRank(userId)).rank;
      if (rank < r.level.rank) return { ok: false, blocked: false, level: { key: r.level.key, name: t(r.level.name, locale) }, message, rule: r.name };
    }
  }
  return { ok: true, review, noBonus, rule: reviewRule };
}

/** Customer-facing error carried through actions: "kyc:<level key>:<message>". */
export class KycRequiredError extends Error {
  constructor(public decision: Extract<KycDecision, { ok: false }>) {
    super("kyc_required");
  }
}

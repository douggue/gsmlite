/**
 * Demo catalog for testing: categories, services and DEMO license keys.
 * Names and prices are made-up examples, not real supplier offers. Safe to run twice (existing slugs are skipped).
 * Used by `npm run db:seed` and by the first-run setup page (/admin/setup).
 */
import { randomBytes } from "node:crypto";
import type { FulfillmentType, PrismaClient, ServiceType } from "@prisma/client";
import { encrypt, hmac } from "./crypto";

const L = (ht: string, fr: string, en: string, es: string) => ({ ht, fr, en, es });
const usd = (n: number) => Math.round(n * 100);

const categories = [
  { slug: "carrier-unlock", icon: "🔓", code: "CU", isHot: true, name: L("Debloke operatè", "Déblocage opérateur", "Carrier unlock", "Liberación de operador"), description: L("Nenpòt rezo, ak IMEI", "Tout réseau, par IMEI", "Any network, by IMEI", "Cualquier red, por IMEI"), sortOrder: 1 },
  { slug: "imei-checks", icon: "🔎", code: "IC", name: L("Tchèk IMEI ak operatè", "Vérification IMEI et opérateur", "IMEI & carrier checks", "Verificación IMEI y operador"), description: L("Blokaj, lis nwa, garanti", "Blocage, liste noire, garantie", "Lock, blacklist, warranty", "Bloqueo, lista negra, garantía"), sortOrder: 2 },
  { slug: "tool-licenses", icon: "🛠️", code: "TC", name: L("Kredi zouti", "Crédits d'outils", "Tool credits", "Créditos de herramientas"), description: L("Kredi ak lisans", "Crédits et licences", "Credits & licenses", "Créditos y licencias"), sortOrder: 3 },
  { slug: "remote-services", icon: "💻", code: "DF", name: L("Done ak firmware", "Données et firmware", "Data & firmware", "Datos y firmware"), description: L("FRP, flash, fichye", "FRP, flash, fichiers", "FRP, flashing, files", "FRP, flasheo, archivos"), sortOrder: 4 },
  { slug: "unlocktool", icon: "🔑", code: "UT", isTool: true, isHot: true, name: L("UnlockTool", "UnlockTool", "UnlockTool", "UnlockTool"), sortOrder: 5 },
  { slug: "chimera", icon: "🔑", code: "CH", isTool: true, name: L("Chimera", "Chimera", "Chimera", "Chimera"), sortOrder: 6 },
  { slug: "octoplus", icon: "🔑", code: "OP", isTool: true, name: L("Octoplus", "Octoplus", "Octoplus", "Octoplus"), sortOrder: 7 },
];

type SeedProduct = {
  slug: string;
  category: string;
  name: ReturnType<typeof L>;
  description: ReturnType<typeof L>;
  delivery: ReturnType<typeof L>;
  accent: string;
  featured?: boolean;
  fulfillment: FulfillmentType;
  serviceType: ServiceType;
  fields?: unknown[];
  variants: { name: ReturnType<typeof L>; price: number; minQty?: number; maxQty?: number }[];
  codes?: number;
  tags?: string[];
  card?: { title: ReturnType<typeof L>; tag: ReturnType<typeof L>; style: "ink" | "green" | "mint" | "slate" };
  hideFromGoogle?: boolean;
};

const products: SeedProduct[] = [
  {
    slug: "iphone-usa-att-unlock", category: "carrier-unlock", accent: "#111418", featured: true, fulfillment: "MANUAL", serviceType: "IMEI",
    name: L("Debloke iPhone USA AT&T", "Déblocage iPhone USA AT&T", "iPhone USA AT&T unlock", "Liberación iPhone USA AT&T"),
    description: L(
      "Debloke pou tout tan. Telefòn nan dwe pa rapòte kòm pèdi oswa vòlè.",
      "Déblocage permanent. Le téléphone ne doit pas être déclaré perdu ou volé.",
      "Permanent factory unlock. The phone must not be reported lost or stolen.",
      "Liberación permanente. El teléfono no debe estar reportado como perdido o robado.",
    ),
    delivery: L("1–3 jou", "1–3 jours", "1–3 days", "1–3 días"),
    variants: [
      { name: L("IMEI pwòp", "IMEI propre", "Clean IMEI", "IMEI limpio"), price: 25 },
      { name: L("Premium", "Premium", "Premium", "Premium"), price: 45 },
    ],
    tags: ["Apple", "USA"],
    card: { title: L("iPhone USA AT&T", "iPhone USA AT&T", "iPhone USA AT&T", "iPhone USA AT&T"), tag: L("IMEI pwòp", "IMEI propre", "Clean IMEI", "IMEI limpio"), style: "ink" },
  },
  {
    slug: "samsung-network-unlock-code", category: "carrier-unlock", accent: "#1F7A4D", fulfillment: "MANUAL", serviceType: "IMEI",
    name: L("Kòd debloke Samsung", "Code de déblocage Samsung", "Samsung network unlock code", "Código de liberación Samsung"),
    description: L("Kòd pou debloke rezo a.", "Code pour débloquer le réseau.", "Code to unlock the network.", "Código para liberar la red."),
    delivery: L("1–24 è", "1–24 h", "1–24 h", "1–24 h"),
    fields: [{ key: "model", label: L("Modèl", "Modèle", "Model", "Modelo"), type: "text", required: true, placeholder: "SM-A546" }],
    variants: [{ name: L("Kòd", "Code", "Code", "Código"), price: 12 }],
    tags: ["Samsung"],
  },
  {
    slug: "full-imei-check", category: "imei-checks", accent: "#E4F3EA", featured: true, fulfillment: "MANUAL", serviceType: "IMEI",
    name: L("Tchèk IMEI konplè", "Vérification IMEI complète", "Full IMEI check", "Verificación IMEI completa"),
    description: L(
      "Operatè, lis nwa, garanti ak modèl.",
      "Opérateur, liste noire, garantie et modèle.",
      "Carrier, blacklist, warranty and model.",
      "Operador, lista negra, garantía y modelo.",
    ),
    delivery: L("Touswit", "Immédiat", "Instant", "Inmediato"),
    variants: [{ name: L("Tchèk", "Vérification", "Check", "Verificación"), price: 1.5 }],
    tags: ["Apple", "Samsung"],
    card: { title: L("Operatè + lis nwa", "Opérateur + liste noire", "Carrier + blacklist", "Operador + lista negra"), tag: L("Imedya", "Instantané", "Instant", "Instantáneo"), style: "mint" },
  },
  {
    slug: "unlocktool-license", category: "unlocktool", accent: "#2B2F35", featured: true, fulfillment: "CODE_INVENTORY", serviceType: "SERVER", codes: 5,
    name: L("Lisans UnlockTool", "Licence UnlockTool", "UnlockTool license", "Licencia UnlockTool"),
    description: L("Kle lisans livre touswit.", "Clé de licence livrée immédiatement.", "License key delivered instantly.", "Clave de licencia entregada al instante."),
    delivery: L("Touswit", "Immédiat", "Instant", "Inmediato"),
    variants: [
      { name: L("12 mwa · Nouvo aktivasyon", "12 mois · Nouvelle activation", "12 months · New activation", "12 meses · Nueva activación"), price: 50 },
      { name: L("12 mwa · Renouvèlman", "12 mois · Renouvellement", "12 months · Renewal", "12 meses · Renovación"), price: 45 },
      { name: L("6 mwa · Nouvo aktivasyon", "6 mois · Nouvelle activation", "6 months · New activation", "6 meses · Nueva activación"), price: 32 },
      { name: L("6 mwa · Renouvèlman", "6 mois · Renouvellement", "6 months · Renewal", "6 meses · Renovación"), price: 29 },
      { name: L("3 mwa · Nouvo aktivasyon", "3 mois · Nouvelle activation", "3 months · New activation", "3 meses · Nueva activación"), price: 20 },
      { name: L("3 mwa · Renouvèlman", "3 mois · Renouvellement", "3 months · Renewal", "3 meses · Renovación"), price: 18 },
    ],
    card: { title: L("UnlockTool 12 mwa", "UnlockTool 12 mois", "UnlockTool 12 months", "UnlockTool 12 meses"), tag: L("Nouvo aktivasyon", "Nouvelle activation", "New activation", "Nueva activación"), style: "green" },
  },
  {
    slug: "chimera-credits", category: "chimera", accent: "#2B2F35", featured: true, fulfillment: "MANUAL", serviceType: "SERVER",
    card: { title: L("Kredi Chimera", "Crédits Chimera", "Chimera credits", "Créditos Chimera"), tag: L("10–1000", "10–1000", "10–1000", "10–1000"), style: "slate" },
    name: L("Kredi Chimera", "Crédits Chimera", "Chimera credits", "Créditos Chimera"),
    description: L("Kredi mete sou kont ou.", "Crédits ajoutés à votre compte.", "Credits added to your account.", "Créditos añadidos a su cuenta."),
    delivery: L("15–60 min", "15–60 min", "15–60 min", "15–60 min"),
    fields: [{ key: "username", label: L("Non itilizatè", "Nom d'utilisateur", "Username", "Usuario"), type: "text", required: true }],
    variants: [{ name: L("Pa kredi", "Par crédit", "Per credit", "Por crédito"), price: 0.6, minQty: 10, maxQty: 1000 }],
  },
  {
    slug: "samsung-frp-remove-remote", category: "remote-services", accent: "#111418", featured: true, hideFromGoogle: true, fulfillment: "MANUAL", serviceType: "REMOTE",
    card: { title: L("Retire FRP Samsung", "Suppression FRP Samsung", "Samsung FRP remove", "Eliminar FRP Samsung"), tag: L("30 min", "30 min", "30 min", "30 min"), style: "ink" },
    name: L("Retire FRP Samsung", "Suppression FRP Samsung", "Samsung FRP remove", "Eliminar FRP Samsung"),
    description: L("Fèt a distans sou òdinatè ou.", "Fait à distance sur votre ordinateur.", "Done remotely on your computer.", "Se hace a distancia en su computadora."),
    delivery: L("30 min", "30 min", "30 min", "30 min"),
    fields: [
      { key: "anydesk", label: L("ID AnyDesk", "ID AnyDesk", "AnyDesk ID", "ID de AnyDesk"), type: "text", required: true },
      { key: "model", label: L("Modèl", "Modèle", "Model", "Modelo"), type: "text", required: true },
    ],
    variants: [{ name: L("Sèvis", "Service", "Service", "Servicio"), price: 15 }],
    tags: ["Samsung"],
  },
];

products.push({
  slug: "octoplus-samsung-activation", category: "octoplus", accent: "#2B2F35", fulfillment: "MANUAL", serviceType: "SERVER",
  name: L("Aktivasyon Octoplus Samsung", "Activation Octoplus Samsung", "Octoplus Samsung activation", "Activación Octoplus Samsung"),
  description: L("Aktivasyon mete sou bwat ou.", "Activation ajoutée à votre boîtier.", "Activation added to your box.", "Activación añadida a su caja."),
  delivery: L("1–6 è", "1–6 h", "1–6 h", "1–6 h"),
  fields: [{ key: "serial", label: L("Nimewo seri bwat la", "Numéro de série du boîtier", "Box serial number", "Número de serie de la caja"), type: "text", required: true }],
  variants: [
    { name: L("12 mwa · Nouvo aktivasyon", "12 mois · Nouvelle activation", "12 months · New activation", "12 meses · Nueva activación"), price: 40 },
    { name: L("12 mwa · Renouvèlman", "12 mois · Renouvellement", "12 months · Renewal", "12 meses · Renovación"), price: 36 },
  ],
});

export async function seedDemoCatalog(prisma: PrismaClient) {
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: { code: c.code, isTool: !!c.isTool, isHot: !!c.isHot, description: c.description } });
  }
  const cats = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.slug, c.id]));

  let order = 0;
  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    const look = {
      categoryId: cats[p.category],
      isFeatured: !!p.featured,
      hideFromGoogle: !!p.hideFromGoogle,
      ...(p.card ? { cardTitle: p.card.title, cardTag: p.card.tag, cardStyle: p.card.style } : {}),
    };
    if (existing) {
      // Demo rows from an older seed get the new presentation fields; prices and options are left alone.
      await prisma.product.update({ where: { id: existing.id }, data: look });
      continue;
    }
    const created = await prisma.product.create({
      data: {
        slug: p.slug,
        ...look,
        name: p.name,
        description: p.description,
        deliveryEstimate: p.delivery,
        accent: p.accent,
        isPublished: true,
        fulfillmentType: p.fulfillment,
        serviceType: p.serviceType,
        fields: (p.fields ?? []) as object[],
        tags: p.tags ?? [],
        sortOrder: order++,
        variants: {
          create: p.variants.map((v, i) => ({ name: v.name, priceUsd: usd(v.price), minQty: v.minQty ?? 1, maxQty: v.maxQty ?? 1, sortOrder: i })),
        },
      },
      include: { variants: true },
    });
    if (p.codes) {
      for (const v of created.variants) {
        for (let i = 0; i < p.codes; i++) {
          const code = `DEMO-${p.slug.slice(0, 4).toUpperCase()}-${randomBytes(6).toString("hex").toUpperCase()}`;
          await prisma.codeItem.create({ data: { variantId: v.id, codeEncrypted: encrypt(code), codeHash: hmac(code), batchLabel: "seed-demo" } });
        }
      }
    }
  }
  return { categories: categories.length, products: products.length };
}

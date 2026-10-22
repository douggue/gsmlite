import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "../db";
import { t } from "../text";
import { durationParts } from "../duration";
import { describeRule } from "../countries";
import { serviceStats } from "../service-stats";
import { FIELD_TYPES, type FieldDef } from "../order-form";

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const time = (m: number) => {
  const d = durationParts(m);
  return d.key === "instant" ? "instant" : `${d.n} ${d.key === "min" ? "minutes" : d.key === "h" ? "hours" : "days"}`;
};

/** IMEIs and serials in a result are masked before the writer sees them: 35•••••••••1234. */
export function maskResult(text: string) {
  return text.replace(/\b(\d{2})\d{9}(\d{4})\b/g, "$1•••••••••$2").replace(/\b([A-Z0-9]{2})[A-Z0-9]{6,}([A-Z0-9]{2})\b/g, "$1••••••$2").slice(0, 600);
}

/** Products a brand hub covers: name, tags or category mention the brand. Never hidden ones. */
export async function brandProducts(brand: string) {
  return prisma.product.findMany({
    where: {
      isPublished: true,
      hideFromGoogle: false,
      countryMode: "all",
      OR: [{ tags: { has: brand } }, { slug: { contains: brand.toLowerCase() } }, { name: { path: ["en"], string_contains: brand } }],
    },
    include: { variants: { where: { isActive: true } }, category: true },
    orderBy: { sortOrder: "asc" },
    take: 40,
  });
}

/** Brands with at least `min` public services (from tags), for hubs. */
export async function hubBrands(min = 3): Promise<string[]> {
  const rows = await prisma.product.findMany({ where: { isPublished: true, hideFromGoogle: false }, select: { tags: true } });
  const known = ["Apple", "iPhone", "Samsung", "Motorola", "Google", "Pixel", "Xiaomi", "Huawei", "LG", "OnePlus", "Nokia", "Oppo", "Vivo", "Tecno", "Infinix", "ZTE", "Alcatel", "Sony"];
  const count = new Map<string, number>();
  for (const r of rows) for (const tag of r.tags) if (known.some((k) => k.toLowerCase() === tag.toLowerCase())) count.set(tag, (count.get(tag) ?? 0) + 1);
  return [...count.entries()].filter(([, n]) => n >= min).map(([b]) => b);
}

/** Everything the writer may say about one service, plus a hash that changes when price, time or success rate change. */
export async function serviceFacts(productId: string): Promise<{ facts: string; hash: string; name: string; slug: string } | null> {
  const p = await prisma.product.findUnique({ where: { id: productId }, include: { variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, category: true } });
  if (!p || !p.isPublished || p.hideFromGoogle) return null;
  const stats = await serviceStats(p.id);
  const sample = await prisma.orderItem.findFirst({
    where: { status: "DELIVERED", variant: { productId: p.id }, deliveryNote: { not: null } },
    orderBy: { finishedAt: "desc" },
    select: { deliveryNote: true },
  });
  const related = await prisma.product.findMany({
    where: { id: { not: p.id }, categoryId: p.categoryId, isPublished: true, hideFromGoogle: false },
    select: { name: true, slug: true },
    take: 6,
  });
  const fields = (p.fields ?? []) as FieldDef[];
  const lines = [
    `Service: ${t(p.name, "en")}`,
    `Category: ${t(p.category.name, "en")}`,
    `Type: ${p.serviceType === "IMEI" ? "IMEI service (customer types the phone's IMEI)" : p.serviceType === "SERVER" ? "Server service / credits (sold by quantity)" : p.serviceType === "REMOTE" ? "Remote service (done on the customer's computer with a remote tool)" : "File service (customer uploads a file)"}`,
    `Description from the store: ${t(p.description, "en") || "(none)"}`,
    `Options and public prices: ${p.variants.map((v) => `${t(v.name, "en")} ${usd(v.salePriceUsd ?? v.priceUsd)}`).join("; ")}`,
    stats?.medianMinutes != null ? `Typical delivery time (median of real orders, last 90 days): ${time(stats.medianMinutes)}` : `Delivery time announced by the store: ${t(p.deliveryEstimate, "en") || "(not stated)"}`,
    stats?.successRate != null ? `Success rate (real orders, last 90 days): ${stats.successRate}% of ${stats.delivered + stats.rejected} orders` : "Success rate: not enough orders yet (do not mention a rate)",
    stats?.topRejection ? `Most common reason an order is refused: ${maskResult(stats.topRejection)}` : "",
    `What the customer fills in: ${[p.serviceType === "IMEI" ? `${t(p.identifierLabel, "en") || "IMEI"}${p.allowBulk ? " (several per order allowed)" : ""}` : "", ...fields.filter((f) => f.type !== "info").map((f) => `${t(f.label, "en")} (${FIELD_TYPES[f.type] ?? f.type})`)].filter(Boolean).join(", ") || "nothing special"}`,
    `Where it is sold: ${describeRule(p)}`,
    "Store policy: payment by wallet (MonCash, NatCash, card or other methods depending on the country); a line that the supplier rejects is refunded to the customer's wallet automatically; order status is shown live on the order page.",
    p.offerCheck && p.serviceType === "IMEI" ? "The store offers a free IMEI check (model, brand) and a paid full check before ordering." : "",
    sample?.deliveryNote ? `Sample result from a real delivered order (masked): ${maskResult(sample.deliveryNote)}` : "Sample result: none yet (do not invent one)",
    related.length ? `Related services on the site: ${related.map((r) => t(r.name, "en")).join("; ")}` : "",
  ].filter(Boolean);
  const hash = createHash("sha256").update(JSON.stringify([p.variants.map((v) => [v.priceUsd, v.salePriceUsd]), stats?.medianMinutes, stats?.successRate])).digest("hex").slice(0, 16);
  return { facts: lines.join("\n"), hash, name: t(p.name, "en"), slug: p.slug };
}

export async function hubFacts(brand: string): Promise<string | null> {
  const products = await brandProducts(brand);
  if (products.length === 0) return null;
  return [
    `Brand hub for: ${brand}`,
    `Services for ${brand} on the site (name · from price · category):`,
    ...products.map((p) => `- ${t(p.name, "en")} · from ${usd(Math.min(...p.variants.map((v) => v.salePriceUsd ?? v.priceUsd)))} · ${t(p.category.name, "en")}`),
    "Store policy: rejected lines are refunded to the wallet automatically; free IMEI check (model and brand) with an account.",
  ].join("\n");
}

export async function guideFacts(keyword: string): Promise<string> {
  const words = keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const related = await prisma.product.findMany({
    where: { isPublished: true, hideFromGoogle: false, OR: words.map((w) => ({ slug: { contains: w } })) },
    select: { name: true, variants: { select: { priceUsd: true, salePriceUsd: true } } },
    take: 6,
  });
  return [
    `Guide topic (answer this search): ${keyword}`,
    "Write general, accurate help that a technician or phone owner can follow. Do not state model-specific facts you are not sure of.",
    "Free IMEI check on the site: model and brand, a few per day with an account.",
    related.length ? `Services on the site the guide can point to at the end: ${related.map((r) => `${t(r.name, "en")} (from ${usd(Math.min(...r.variants.map((v) => v.salePriceUsd ?? v.priceUsd)))})`).join("; ")}` : "No matching service: end with the free IMEI check.",
  ].join("\n");
}

export async function toolFacts(input: { toolName: string; version: string; notes: string }) {
  return [
    `Tool update post: ${input.toolName} ${input.version}`,
    `What changed, from staff notes (only these facts): ${input.notes}`,
    "Keep it short: what's new, who it helps, and that licenses/credits for this tool are on the site if listed.",
  ].join("\n");
}

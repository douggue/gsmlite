import "server-only";
import type { ServiceChangeKind } from "@prisma/client";
import { prisma } from "./db";

/**
 * Record a change for the public feed. The same change for the same service within an hour is not repeated
 * (a sync that flips back and forth, or staff saving twice).
 */
export async function recordChange(kind: ServiceChangeKind, productId: string, opts: { variantId?: string | null; oldPrice?: number | null; newPrice?: number | null } = {}) {
  try {
    const recent = await prisma.serviceChange.findFirst({ where: { kind, productId, variantId: opts.variantId ?? null, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recent) return;
    await prisma.serviceChange.create({ data: { kind, productId, variantId: opts.variantId ?? null, oldPrice: opts.oldPrice ?? null, newPrice: opts.newPrice ?? null } });
  } catch (e) {
    console.error("service change not recorded", e);
  }
}

/** Price of an option as customers see it (sale price first). */
const shown = (v: { priceUsd: number; salePriceUsd: number | null }) => v.salePriceUsd ?? v.priceUsd;

/** Compare an option before and after a save and record a price change or a pause / comeback. */
export async function recordVariantChange(
  productId: string,
  variantId: string,
  before: { priceUsd: number; salePriceUsd: number | null; soldOut: boolean } | null,
  after: { priceUsd: number; salePriceUsd: number | null; soldOut: boolean },
) {
  if (!before) return;
  const [a, b] = [shown(before), shown(after)];
  if (b < a) await recordChange("PRICE_DOWN", productId, { variantId, oldPrice: a, newPrice: b });
  if (b > a) await recordChange("PRICE_UP", productId, { variantId, oldPrice: a, newPrice: b });
  if (!before.soldOut && after.soldOut) await recordChange("REMOVED", productId, { variantId });
  if (before.soldOut && !after.soldOut) await recordChange("BACK", productId, { variantId });
}

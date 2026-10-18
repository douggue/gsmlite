import type { Tx } from "./db";
import { prisma } from "./db";

/** Catalog prices are USD cents. A customer's price group can discount them or set a fixed price per option. */
export type PriceContext = { discountBps: number; fixed: Map<string, number> };

export const RETAIL: PriceContext = { discountBps: 0, fixed: new Map() };

export function listPrice(v: { priceUsd: number; salePriceUsd: number | null }) {
  return v.salePriceUsd ?? v.priceUsd;
}

/** The price this customer pays for one unit, in USD cents. Never above the list price. */
export function unitPriceUsd(v: { id: string; priceUsd: number; salePriceUsd: number | null }, ctx: PriceContext): number {
  const list = listPrice(v);
  const fixed = ctx.fixed.get(v.id);
  if (fixed != null) return Math.min(fixed, list);
  if (ctx.discountBps <= 0) return list;
  return Math.max(1, Math.round((list * (10_000 - Math.min(ctx.discountBps, 9_000))) / 10_000));
}

/** Price context for a user (retail when signed out or without a group). */
export async function priceContext(userId: string | null | undefined, db: Tx = prisma): Promise<PriceContext> {
  if (!userId) return RETAIL;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { priceGroup: { select: { discountBps: true, prices: { select: { variantId: true, priceUsd: true } } } } },
  });
  const g = user?.priceGroup;
  if (!g) return RETAIL;
  return { discountBps: g.discountBps, fixed: new Map(g.prices.map((p) => [p.variantId, p.priceUsd])) };
}

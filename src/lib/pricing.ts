import type { Tx } from "./db";
import { prisma } from "./db";

/** Catalog prices are USD cents. A customer's price group can discount them or set a fixed price per option. */
export type PriceContext = { discountBps: number; fixed: Map<string, number>; floorProfitUsd?: number };

export const RETAIL: PriceContext = { discountBps: 0, fixed: new Map() };

export function listPrice(v: { priceUsd: number; salePriceUsd: number | null }) {
  return v.salePriceUsd ?? v.priceUsd;
}

/** The price this customer pays for one unit, in USD cents. Never above the list price. */
export function unitPriceUsd(v: { id: string; priceUsd: number; salePriceUsd: number | null; costUsd?: number | null }, ctx: PriceContext): number {
  const list = listPrice(v);
  const fixed = ctx.fixed.get(v.id);
  if (fixed != null) return Math.min(fixed, list);
  if (ctx.discountBps <= 0) return list;
  const discounted = Math.max(1, Math.round((list * (10_000 - Math.min(ctx.discountBps, 9_000))) / 10_000));
  // The group's floor: never below cost + minimum profit (and never above the list price).
  const floor = v.costUsd != null && ctx.floorProfitUsd ? Math.min(list, v.costUsd + ctx.floorProfitUsd) : 0;
  return Math.max(discounted, floor);
}

/** Price context for a user (retail when signed out or without a group). */
export async function priceContext(userId: string | null | undefined, db: Tx = prisma): Promise<PriceContext> {
  if (!userId) return RETAIL;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { priceGroup: { select: { discountBps: true, floorProfitUsd: true, prices: { select: { variantId: true, priceUsd: true } } } } },
  });
  const g = user?.priceGroup;
  if (!g) return RETAIL;
  return { discountBps: g.discountBps, floorProfitUsd: g.floorProfitUsd, fixed: new Map(g.prices.map((p) => [p.variantId, p.priceUsd])) };
}

/**
 * Daily: customers in "spend" groups move to the best spend group their last 30 days qualify for (up or down).
 * Customers placed by staff or by KYC in another group are never moved by spending, except up to a bigger discount.
 */
export async function applySpendGroups() {
  const groups = await prisma.priceGroup.findMany({ where: { autoRule: "spend", minMonthlySpendUsd: { gt: 0 } }, orderBy: { minMonthlySpendUsd: "desc" } });
  if (!groups.length) return 0;
  const rows = await prisma.$queryRaw<{ userId: string; spend: bigint }[]>`
    SELECT o."userId", SUM(i."priceUsd" * i.quantity) AS spend FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o."paidAt" >= NOW() - INTERVAL '30 days' AND i.status <> 'FAILED' GROUP BY o."userId"`;
  const spend = new Map(rows.map((r) => [r.userId, Number(r.spend)]));
  const spendIds = new Set(groups.map((g) => g.id));
  const users = await prisma.user.findMany({
    where: { OR: [{ id: { in: [...spend.keys()] } }, { priceGroupId: { in: [...spendIds] } }] },
    select: { id: true, priceGroupId: true, priceGroup: { select: { discountBps: true } } },
  });
  let moved = 0;
  for (const u of users) {
    const s = spend.get(u.id) ?? 0;
    const best = groups.find((g) => s >= g.minMonthlySpendUsd) ?? null;
    const inSpendGroup = !u.priceGroupId || spendIds.has(u.priceGroupId);
    const target = inSpendGroup ? best : best && best.discountBps > (u.priceGroup?.discountBps ?? 0) ? best : undefined;
    if (target === undefined || (target?.id ?? null) === u.priceGroupId) continue;
    await prisma.user.update({ where: { id: u.id }, data: { priceGroupId: target?.id ?? null } });
    moved++;
  }
  return moved;
}

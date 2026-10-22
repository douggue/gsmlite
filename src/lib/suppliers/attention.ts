import "server-only";
import { prisma } from "../db";
import { LIVE } from "./dispatch";

/** Paid supplier lines that are not with any supplier right now (account problem, supplier off, send never started). */
export const stalledWhere = (olderThan: Date) => ({
  status: "PENDING" as const,
  order: { status: { in: ["PAID" as const, "PROCESSING" as const] }, paidAt: { lt: olderThan }, riskFlags: { none: { status: "OPEN" as const } } },
  variant: { supplierId: { not: null }, supplierServiceId: { not: null }, product: { fulfillmentType: "SUPPLIER_API" as const } },
  supplierOrders: { none: { status: { in: [...LIVE] } } },
});

/**
 * What staff must look at:
 * - unknown: sends with no clear answer (never re-sent automatically; staff check the supplier's site)
 * - stalled: paid lines waiting because of our supplier account (balance, key) or a switched-off supplier
 * - slow: with the supplier for more than 3 days
 */
export async function supplierAttention() {
  const now = Date.now();
  const [unknown, stalled, slow] = await Promise.all([
    prisma.supplierOrder.findMany({
      where: { status: "UNKNOWN", orderItem: { status: "PENDING" } },
      include: { supplier: { select: { name: true } }, orderItem: { include: { order: { select: { id: true, number: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.orderItem.findMany({
      where: stalledWhere(new Date(now - 5 * 60_000)),
      include: {
        order: { select: { id: true, number: true } },
        variant: { select: { supplierId: true, supplier: { select: { name: true, isEnabled: true, lastError: true } } } },
        supplierOrders: { orderBy: { createdAt: "desc" }, take: 1, select: { error: true } },
      },
      orderBy: { order: { paidAt: "asc" } },
      take: 100,
    }),
    prisma.supplierOrder.findMany({
      where: { status: { in: ["WAITING", "IN_PROCESS"] }, createdAt: { lt: new Date(now - 3 * 86_400_000) } },
      include: { supplier: { select: { name: true } }, orderItem: { include: { order: { select: { id: true, number: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);
  return { unknown, stalled, slow };
}

/** Count for the admin menu badge. */
export async function supplierAttentionCount() {
  const [unknown, stalled, lowBalance] = await Promise.all([
    prisma.supplierOrder.count({ where: { status: "UNKNOWN", orderItem: { status: "PENDING" } } }),
    prisma.orderItem.count({ where: stalledWhere(new Date(Date.now() - 5 * 60_000)) }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Supplier" WHERE "isEnabled" AND "lowBalanceAlert" > 0 AND "balance" < "lowBalanceAlert"`,
  ]);
  return unknown + stalled + Number(lowBalance[0]?.n ?? 0);
}

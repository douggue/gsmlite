import "server-only";
import { prisma } from "./db";

/** Sales and profit (USD cents) of paid lines that were not refunded, between two dates. */
export async function salesProfit(from: Date, to: Date) {
  const [r] = await prisma.$queryRaw<{ sales: bigint | null; cost: bigint | null; lines: bigint }[]>`
    SELECT SUM(i."priceUsd" * i.quantity) AS sales, SUM(COALESCE(i."costUsd", 0) * i.quantity) AS cost, COUNT(*) AS lines
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o."paidAt" >= ${from} AND o."paidAt" < ${to} AND i.status <> 'FAILED'`;
  const sales = Number(r?.sales ?? 0);
  return { sales, profit: sales - Number(r?.cost ?? 0), lines: Number(r?.lines ?? 0) };
}

/** One row per day (oldest first) for the last `days` days, in the server's time zone. */
export async function dailySeries(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const rows = await prisma.$queryRaw<{ day: Date; sales: bigint | null; cost: bigint | null }[]>`
    SELECT date_trunc('day', o."paidAt") AS day, SUM(i."priceUsd" * i.quantity) AS sales, SUM(COALESCE(i."costUsd", 0) * i.quantity) AS cost
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o."paidAt" >= ${start} AND i.status <> 'FAILED'
    GROUP BY 1`;
  const byDay = new Map(rows.map((r) => [new Date(r.day).toDateString(), r]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    const r = byDay.get(d.toDateString());
    const sales = Number(r?.sales ?? 0);
    return { day: d, sales, profit: sales - Number(r?.cost ?? 0) };
  });
}

/** Best services of the last 7 days: orders, success rate, median time, profit. */
export async function topServices(limit = 6) {
  return prisma.$queryRaw<{ productId: string; name: unknown; orders: bigint; delivered: bigint; failed: bigint; median: number | null; profit: bigint | null }[]>`
    SELECT p.id AS "productId", p.name, COUNT(DISTINCT o.id) AS orders,
      COUNT(*) FILTER (WHERE i.status = 'DELIVERED') AS delivered,
      COUNT(*) FILTER (WHERE i.status = 'FAILED') AS failed,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM i."finishedAt" - o."paidAt") / 60) FILTER (WHERE i.status = 'DELIVERED') AS median,
      SUM((i."priceUsd" - COALESCE(i."costUsd", 0)) * i.quantity) FILTER (WHERE i.status <> 'FAILED') AS profit
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" JOIN "ProductVariant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId"
    WHERE o."paidAt" >= NOW() - INTERVAL '7 days'
    GROUP BY p.id, p.name ORDER BY orders DESC LIMIT ${limit}`;
}

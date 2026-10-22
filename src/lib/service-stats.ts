import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./db";
import { getSettings } from "./settings";

export type ServiceStats = {
  /** Finished lines in the last 90 days */
  delivered: number;
  rejected: number;
  /** delivered ÷ (delivered + rejected) in %, one decimal, rounded down; null under the minimum number of orders */
  successRate: number | null;
  /** Median minutes from payment to result for delivered lines (90 days); null with no data */
  medianMinutes: number | null;
  /** Most common rejection text (for the "Run an IMEI check first" hint) */
  topRejection: string | null;
  /** online: normal · slow: lines waiting much longer than usual · down: nobody can order it right now */
  status: "online" | "slow" | "down";
};

type Row = { productId: string; delivered: bigint; rejected: bigint; median: number | null };
type Waiting = { productId: string; waiting: bigint; oldest: number | null };

/** Success rate = delivered ÷ (delivered + rejected), never rounded up, so 99.96 % shows as 99.9 %. */
export function successRate(delivered: number, rejected: number, minOrders: number): number | null {
  const n = delivered + rejected;
  if (n < Math.max(1, minOrders)) return null;
  return Math.floor((delivered / n) * 1000) / 10;
}

/** "Slow right now": several lines waiting more than twice the usual time (or a day when there is no history). */
export function liveStatus(medianMinutes: number | null, waiting: number, oldestMinutes: number | null, orderable: boolean): ServiceStats["status"] {
  if (!orderable) return "down";
  const limit = Math.max(60, (medianMinutes ?? 720) * 2);
  return waiting >= 2 && (oldestMinutes ?? 0) > limit ? "slow" : "online";
}

async function compute(): Promise<Record<string, ServiceStats>> {
  const settings = await getSettings();
  const [rows, waiting, reasons, products] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT v."productId",
        COUNT(*) FILTER (WHERE i.status = 'DELIVERED') AS delivered,
        COUNT(*) FILTER (WHERE i.status = 'FAILED') AS rejected,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM i."finishedAt" - o."paidAt") / 60)
          FILTER (WHERE i.status = 'DELIVERED' AND o."paidAt" IS NOT NULL) AS median
      FROM "OrderItem" i
      JOIN "Order" o ON o.id = i."orderId"
      JOIN "ProductVariant" v ON v.id = i."variantId"
      WHERE i."finishedAt" > NOW() - INTERVAL '90 days' AND o."paidAt" IS NOT NULL
        -- staff cancellations of unpaid or abandoned orders are not supplier failures
        AND NOT (i.status = 'FAILED' AND o.status = 'CANCELED')
      GROUP BY v."productId"`,
    prisma.$queryRaw<Waiting[]>`
      SELECT v."productId", COUNT(*) AS waiting, MAX(EXTRACT(EPOCH FROM NOW() - o."paidAt") / 60) AS oldest
      FROM "OrderItem" i
      JOIN "Order" o ON o.id = i."orderId"
      JOIN "ProductVariant" v ON v.id = i."variantId"
      WHERE i.status = 'PENDING' AND o.status IN ('PAID', 'PROCESSING')
      GROUP BY v."productId"`,
    prisma.$queryRaw<{ productId: string; reason: string }[]>`
      SELECT DISTINCT ON (x."productId") x."productId", x.reason FROM (
        SELECT v."productId", LEFT(i."deliveryNote", 120) AS reason, COUNT(*) AS n
        FROM "OrderItem" i JOIN "ProductVariant" v ON v.id = i."variantId"
        WHERE i.status = 'FAILED' AND i."finishedAt" > NOW() - INTERVAL '90 days' AND i."deliveryNote" IS NOT NULL
        GROUP BY v."productId", LEFT(i."deliveryNote", 120)
      ) x ORDER BY x."productId", x.n DESC`,
    prisma.product.findMany({
      where: { isPublished: true },
      select: { id: true, variants: { where: { isActive: true }, select: { soldOut: true, supplier: { select: { isEnabled: true, lastError: true } } } } },
    }),
  ]);
  const byId = new Map(rows.map((r) => [r.productId, r]));
  const wait = new Map(waiting.map((w) => [w.productId, w]));
  const why = new Map(reasons.map((r) => [r.productId, r.reason]));
  const out: Record<string, ServiceStats> = {};
  for (const p of products) {
    const r = byId.get(p.id);
    const delivered = Number(r?.delivered ?? 0);
    const rejected = Number(r?.rejected ?? 0);
    const median = r?.median == null ? null : Math.round(Number(r.median));
    // Orderable when at least one option is in stock and its supplier (if any) is switched on and answering.
    const orderable = p.variants.some((v) => !v.soldOut && (!v.supplier || (v.supplier.isEnabled && !v.supplier.lastError)));
    const w = wait.get(p.id);
    out[p.id] = {
      delivered,
      rejected,
      successRate: successRate(delivered, rejected, settings.successRate.minOrders),
      medianMinutes: delivered >= 3 ? median : null,
      topRejection: why.get(p.id) ?? null,
      status: liveStatus(median, Number(w?.waiting ?? 0), w?.oldest == null ? null : Number(w.oldest), orderable),
    };
  }
  return out;
}

/** Stats for every published service, refreshed every 10 minutes. */
export const allServiceStats = unstable_cache(compute, ["service-stats"], { revalidate: 600, tags: ["service-stats"] });

export async function serviceStats(productId: string): Promise<ServiceStats | null> {
  return (await allServiceStats())[productId] ?? null;
}

/** Store-wide numbers for the home page; only real figures, never a made-up starting value. */
export const storeNumbers = unstable_cache(
  async () => {
    const [delivered, customers, services, median] = await Promise.all([
      prisma.orderItem.count({ where: { status: "DELIVERED" } }),
      prisma.order.groupBy({ by: ["userId"], where: { paidAt: { not: null } } }).then((r) => r.length),
      prisma.product.count({ where: { isPublished: true, hideFromGoogle: false } }),
      prisma.$queryRaw<{ m: number | null }[]>`
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM i."finishedAt" - o."paidAt") / 60) AS m
        FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
        WHERE i.status = 'DELIVERED' AND o."paidAt" IS NOT NULL AND i."finishedAt" > NOW() - INTERVAL '90 days'`,
    ]);
    return { delivered, customers, services, medianMinutes: median[0]?.m == null ? null : Math.round(Number(median[0].m)) };
  },
  ["store-numbers"],
  { revalidate: 900, tags: ["service-stats"] },
);

/** Whether every supplier in use is answering ("All systems online"). */
export const systemsOnline = unstable_cache(
  async () => (await prisma.supplier.count({ where: { isEnabled: true, lastError: { not: null } } })) === 0,
  ["systems-online"],
  { revalidate: 300, tags: ["service-stats"] },
);

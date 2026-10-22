import "server-only";
import { prisma } from "./db";
import { getSettings, setSetting } from "./settings";
import { successRate } from "./service-stats";
import { staffAlert } from "./marketing";
import { t } from "./text";

type Row = { productId: string; delivered: bigint; rejected: bigint };

/**
 * Daily look at the last 14 days of each service: below "alert" → staff alert (once a day);
 * below "pause" (when set) → its options are marked out of stock until staff switch them back.
 */
export async function watchSuccessRates(now = new Date()) {
  const s = await getSettings();
  const { minOrders, alertBelowPct, pauseBelowPct } = s.successRate;
  if (!alertBelowPct && !pauseBelowPct) return { alerted: 0, paused: 0 };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT v."productId",
      COUNT(*) FILTER (WHERE i.status = 'DELIVERED') AS delivered,
      COUNT(*) FILTER (WHERE i.status = 'FAILED') AS rejected
    FROM "OrderItem" i
    JOIN "Order" o ON o.id = i."orderId"
    JOIN "ProductVariant" v ON v.id = i."variantId"
    WHERE i."finishedAt" > NOW() - INTERVAL '14 days' AND o."paidAt" IS NOT NULL
      AND NOT (i.status = 'FAILED' AND o.status = 'CANCELED')
    GROUP BY v."productId"`;
  const watch = { ...s.successWatch };
  const today = now.toISOString().slice(0, 10);
  let alerted = 0;
  let paused = 0;
  for (const r of rows) {
    const rate = successRate(Number(r.delivered), Number(r.rejected), minOrders);
    if (rate == null) continue;
    const w = { ...watch[r.productId] };
    const p = await prisma.product.findUnique({ where: { id: r.productId }, select: { id: true, name: true, isPublished: true } });
    if (!p?.isPublished) continue;
    const name = t(p.name, "en");
    // After a pause staff may switch it back on; it is not paused again for the same 14 days of results.
    const recentlyPaused = w.pausedAt && now.getTime() - new Date(w.pausedAt).getTime() < 14 * 86_400_000;
    if (pauseBelowPct && rate < pauseBelowPct && !recentlyPaused) {
      await prisma.productVariant.updateMany({ where: { productId: p.id, isActive: true, soldOut: false }, data: { soldOut: true } });
      w.pausedAt = now.toISOString();
      paused++;
      await staffAlert(`⛔ Paused ${name}: success rate ${rate}% in 14 days (pause below ${pauseBelowPct}%)`, `/admin/products/${p.id}`);
    } else if (alertBelowPct && rate < alertBelowPct && w.alertedAt?.slice(0, 10) !== today) {
      w.alertedAt = now.toISOString();
      alerted++;
      await staffAlert(`⚠️ ${name}: success rate ${rate}% in 14 days (alert below ${alertBelowPct}%)`, `/admin/products/${p.id}`);
    }
    watch[r.productId] = w;
  }
  await setSetting("successWatch", watch);
  return { alerted, paused };
}

import "server-only";
import { prisma } from "./db";
import { post, systemAccount, walletAccount } from "./ledger";
import { getSettings } from "./settings";

/**
 * "The full check is free if you order the unlock afterwards": when a paid order contains an IMEI that the same
 * customer had checked (a service in a "check" category) in the last N days, that check's price goes back to the
 * wallet as a bonus. Once per check line (idempotency key), whatever happens to the unlock afterwards.
 */
export async function creditChecksForOrder(orderId: string) {
  const settings = await getSettings();
  if (settings.checkCreditDays <= 0) return 0;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { where: { identifier: { not: null } }, include: { variant: { select: { product: { select: { category: { select: { slug: true } } } } } } } } },
  });
  if (!order?.paidAt) return 0;
  const unlockImeis = order.items.filter((i) => !i.variant.product.category.slug.includes("check")).map((i) => i.identifier!);
  if (!unlockImeis.length) return 0;
  const checks = await prisma.orderItem.findMany({
    where: {
      identifier: { in: unlockImeis },
      status: "DELIVERED",
      finishedAt: { gte: new Date(order.paidAt.getTime() - settings.checkCreditDays * 86_400_000) },
      order: { userId: order.userId, id: { not: order.id } },
      variant: { product: { category: { slug: { contains: "check" } } } },
    },
    include: { order: { select: { currency: true } } },
  });
  let credited = 0;
  for (const c of checks) {
    const amount = c.unitPrice * c.quantity;
    if (amount <= 0) continue;
    const r = await prisma.$transaction(async (tx) => {
      const source = await systemAccount(tx, "marketing", c.order.currency, "check-credit");
      const wallet = await walletAccount(tx, order.userId, c.order.currency);
      return post(tx, {
        type: "BONUS",
        idempotencyKey: `checkcredit:${c.id}`,
        description: `IMEI check refunded: you ordered ${c.identifier} afterwards`,
        metadata: { checkItemId: c.id, orderId },
        entries: [
          { accountId: source.id, currency: c.order.currency, amount: -amount },
          { accountId: wallet.id, currency: c.order.currency, amount },
        ],
      });
    });
    if (!r.duplicate) credited++;
  }
  return credited;
}

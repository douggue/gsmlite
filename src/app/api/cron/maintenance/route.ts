import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyMoncashIntent } from "@/lib/payments/verify";
import { grantTopupBonus, releaseHold } from "@/lib/wallet";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { refundOrCancel } from "@/lib/orders";
import { LIVE } from "@/lib/suppliers/dispatch";
import { endExpiredDeals } from "@/lib/deals";
import { deletePrivateFile } from "@/lib/storage";
import { applySpendGroups } from "@/lib/pricing";

/**
 * Scheduled maintenance (call every 5–10 minutes with `Authorization: Bearer $CRON_SECRET`, e.g. Vercel Cron or Inngest):
 * - re-checks pending MonCash payments in case a callback was lost
 * - releases held deposits whose hold period ended
 * - expires abandoned payment intents
 * - refunds paid orders that were not delivered within `autoRefundHours` (nothing delivered, nothing with a supplier,
 *   no open risk review)
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const result = { moncashChecked: 0, holdsReleased: 0, expired: 0, autoRefunded: 0, dealsEnded: await endExpiredDeals() };

  const pending = await prisma.paymentIntent.findMany({
    where: { provider: "MONCASH", status: "PENDING", createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
    take: 50,
  });
  for (const p of pending) {
    try {
      await verifyMoncashIntent(p.id);
      result.moncashChecked++;
    } catch (e) {
      console.error("MonCash poll failed", p.id, e);
    }
  }

  const settings = await getSettings();
  const held = await prisma.paymentIntent.findMany({ where: { status: "SUCCEEDED", holdUntil: { lte: now } }, take: 100 });
  for (const h of held) {
    const released = await prisma.$transaction(async (tx) => {
      const r = await releaseHold(tx, h);
      await tx.paymentIntent.update({ where: { id: h.id }, data: { holdUntil: null } });
      await grantTopupBonus(tx, h, settings.topupBonus, settings.htgPerUsd);
      return !r.duplicate;
    });
    if (released) {
      result.holdsReleased++;
      await notify(h.userId, "deposit_approved", { amount: h.amount, currency: h.currency }, "/account/wallet");
    }
  }

  const expired = await prisma.paymentIntent.updateMany({
    where: { provider: "MONCASH", status: "PENDING", createdAt: { lt: new Date(now.getTime() - 86_400_000) } },
    data: { status: "EXPIRED" },
  });
  result.expired = expired.count;

  if (settings.autoRefundHours > 0) {
    const cutoff = new Date(now.getTime() - settings.autoRefundHours * 3_600_000);
    const stuck = await prisma.order.findMany({
      where: {
        status: { in: ["PAID", "PROCESSING"] },
        paidAt: { lt: cutoff },
        // A line with a supplier may still succeed (and we pay for it): those wait for the supplier's answer.
        items: { none: { OR: [{ status: "DELIVERED" }, { supplierOrders: { some: { status: { in: [...LIVE] } } } }] } },
        riskFlags: { none: { status: "OPEN" } },
      },
      select: { id: true },
      take: 50,
    });
    for (const o of stuck) {
      try {
        await refundOrCancel(o.id, null, `Not delivered within ${settings.autoRefundHours} hours: refunded automatically`);
        result.autoRefunded++;
      } catch (e) {
        console.error("Auto-refund failed", o.id, e);
      }
    }
  }
  // KYC documents of accounts closed longer than the retention period are deleted for good.
  const cutoff = new Date(now.getTime() - settings.kycRetentionMonths * 30 * 86_400_000);
  const oldDocs = await prisma.kycDocument.findMany({ where: { deletedAt: null, submission: { user: { status: "CLOSED", updatedAt: { lt: cutoff } } } }, take: 200 });
  for (const d of oldDocs) {
    await deletePrivateFile(d.path);
    await prisma.kycDocument.update({ where: { id: d.id }, data: { deletedAt: new Date() } });
  }
  const groupsMoved = await applySpendGroups();
  return NextResponse.json({ ...result, kycDocsDeleted: oldDocs.length, groupsMoved });
}

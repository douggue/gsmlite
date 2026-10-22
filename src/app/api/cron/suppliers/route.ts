import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { pollSuppliers } from "@/lib/suppliers/dispatch";
import { refreshBalance } from "@/lib/suppliers/sync";

export const maxDuration = 60;

/**
 * Supplier follow-up, every 2–5 minutes with `Authorization: Bearer $CRON_SECRET` (server crontab on the VPS,
 * or an outside scheduler while on Vercel's free plan, whose own cron runs only once a day):
 * - checks the status of orders that are due, delivers results and refunds rejections
 * - sends paid lines that were never sent, marks sends that never finished as unknown
 * - refreshes balances about every 30 minutes and deletes logs older than 30 days
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await pollSuppliers();
  const minute = new Date().getUTCMinutes();
  let balances = 0;
  if (minute < 5 || (minute >= 30 && minute < 35)) {
    for (const s of await prisma.supplier.findMany({ where: { isEnabled: true }, select: { id: true } })) {
      await refreshBalance(s.id).catch((e) => console.error("balance refresh", s.id, e));
      balances++;
    }
    await prisma.supplierLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
  }
  return NextResponse.json({ ...result, balances });
}

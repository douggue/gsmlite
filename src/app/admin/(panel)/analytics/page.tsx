import { salesProfit } from "@/lib/reports";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { PageTitle, Stat, Table } from "@/components/admin/ui";
import { SalesChart } from "@/components/admin/SalesChart";
import { METHOD, label } from "@/lib/admin-labels";

export const metadata = { title: "Reports" };
const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaff("analytics.view");
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days) as 7) ? Number(sp.days) : 30;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const settings = await getSettings();

  const [paidOrders, items, deposits, newCustomers, totals] = await Promise.all([
    prisma.order.findMany({
      where: { paidAt: { gte: since }, status: { in: ["PAID", "PROCESSING", "FULFILLED"] } },
      select: { total: true, currency: true, paymentMethod: true, paidAt: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { paidAt: { gte: since }, status: { in: ["PAID", "PROCESSING", "FULFILLED"] } } },
      select: { quantity: true, unitPrice: true, priceUsd: true, costUsd: true, status: true, productName: true, order: { select: { currency: true } } },
    }),
    prisma.paymentIntent.groupBy({ by: ["provider", "currency"], where: { status: "SUCCEEDED", orderId: null, updatedAt: { gte: since } }, _sum: { amount: true }, _count: true }),
    prisma.user.count({ where: { createdAt: { gte: since }, role: "CUSTOMER" } }),
    salesProfit(since, new Date()),
  ]);

  // Everything is shown in USD; gourde payments are converted at the current admin rate.
  const toUsd = (amount: number, cur: string) => (cur === "USD" ? amount : Math.round(amount / settings.htgPerUsd));
  const revenue = paidOrders.reduce((s, o) => s + toUsd(o.total, o.currency), 0);
  // Same rule as the dashboard: paid lines that were not refunded, minus the supplier's cost (none for hand-delivered ones).
  const profit = totals.profit;
  const avg = paidOrders.length ? Math.round(revenue / paidOrders.length) : 0;

  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().slice(0, 10), usd: 0, orders: 0 };
  });
  for (const o of paidOrders) {
    const key = new Date(o.paidAt!.getTime() - o.paidAt!.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const row = daily.find((r) => r.date === key);
    if (row) {
      row.usd += toUsd(o.total, o.currency);
      row.orders++;
    }
  }

  const byProduct = new Map<string, { name: string; qty: number; usd: number }>();
  for (const i of items) {
    const name = t(i.productName, "en");
    const row = byProduct.get(name) ?? { name, qty: 0, usd: 0 };
    row.qty += i.quantity;
    row.usd += toUsd(i.unitPrice * i.quantity, i.order.currency);
    byProduct.set(name, row);
  }
  const top = [...byProduct.values()].sort((a, b) => b.usd - a.usd).slice(0, 10);

  const byMethod = [...new Set(paidOrders.map((o) => o.paymentMethod))].map((m) => {
    const list = paidOrders.filter((o) => o.paymentMethod === m);
    return { method: m, orders: list.length, usd: list.reduce((s, o) => s + toUsd(o.total, o.currency), 0) };
  }).sort((a, b) => b.usd - a.usd);
  const topups = deposits.reduce((s, d) => s + toUsd(d._sum.amount ?? 0, d.currency), 0);

  const money = (n: number) => formatMoney(n, "USD", "en");
  return (
    <>
      <PageTitle
        title="Sales & profit"
        sub={`Paid orders in the last ${days} days, in USD (gourde payments converted at today's rate, 1 USD = ${settings.htgPerUsd} HTG).`}
        actions={
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Link key={r} href={`/admin/analytics?days=${r}`} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold ${r === days ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`}>{r} days</Link>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Sales" value={money(revenue)} note={`${paidOrders.length} paid order${paidOrders.length === 1 ? "" : "s"}`} />
        <Stat label="Profit" value={money(profit)} tone="good" note="Sales minus supplier cost (refunds left out)" />
        <Stat label="Average order" value={money(avg)} />
        <Stat label="Wallet top-ups" value={money(topups)} />
        <Stat label="New customers" value={newCustomers} />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-semibold">Daily sales</h2>
        <SalesChart rows={daily} />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Show as table</summary>
          <table className="mt-2 w-full text-left text-xs">
            <thead><tr className="text-muted"><th className="py-1">Date</th><th>Orders</th><th>Sales</th></tr></thead>
            <tbody>{daily.map((r) => <tr key={r.date} className="border-t border-border"><td className="py-1">{r.date}</td><td>{r.orders}</td><td>{money(r.usd)}</td></tr>)}</tbody>
          </table>
        </details>
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <div>
          <h2 className="mb-3 font-semibold">Top services</h2>
          <Table head={["Service", "Units", "Sales"]} empty={top.length === 0}>
            {top.map((p) => <tr key={p.name}><td className="px-4 py-2.5">{p.name}</td><td className="px-4 py-2.5">{p.qty}</td><td className="px-4 py-2.5">{money(p.usd)}</td></tr>)}
          </Table>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Sales by payment method</h2>
          <Table head={["Method", "Orders", "Sales"]} empty={byMethod.length === 0}>
            {byMethod.map((m) => <tr key={m.method}><td className="px-4 py-2.5">{label(METHOD, m.method)}</td><td className="px-4 py-2.5">{m.orders}</td><td className="px-4 py-2.5">{money(m.usd)}</td></tr>)}
          </Table>
          <h2 className="mb-3 mt-6 font-semibold">Export (CSV)</h2>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary min-h-9 px-3 text-xs" href={`/api/admin/export?type=orders&days=${days}`}>Orders</a>
            <a className="btn-secondary min-h-9 px-3 text-xs" href={`/api/admin/export?type=payments&days=${days}`}>Payments</a>
            <a className="btn-secondary min-h-9 px-3 text-xs" href={`/api/admin/export?type=ledger&days=${days}`}>Ledger</a>
            <a className="btn-secondary min-h-9 px-3 text-xs" href={`/api/admin/export?type=customers&days=${days}`}>New customers</a>
          </div>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { salesProfit, dailySeries, topServices } from "@/lib/reports";
import { supplierAttentionCount } from "@/lib/suppliers/attention";
import { durationParts } from "@/lib/duration";

export const metadata = { title: "Dashboard" };

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dur = (m: number | null) => {
  if (m == null) return "—";
  const d = durationParts(m);
  return d.key === "instant" ? "instant" : `${d.n} ${d.key === "min" ? "min" : d.key === "h" ? "h" : "days"}`;
};

/** Dashboard (mockup): today's sales and profit, what's in progress, what needs you, 14 days of sales, top services. */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  const yStart = new Date(today.getTime() - 86_400_000);
  const yNow = new Date(now.getTime() - 86_400_000);
  const [td, yd, series, top, payments, kyc, supplierIssues, withSupplier, manualWaiting, lowBalance, suppliersDown] = await Promise.all([
    salesProfit(today, now),
    salesProfit(yStart, yNow),
    dailySeries(14),
    topServices(),
    prisma.paymentIntent.count({ where: { status: "REVIEW" } }),
    prisma.kycSubmission.count({ where: { status: "PENDING" } }),
    supplierAttentionCount(),
    prisma.orderItem.count({ where: { status: "PENDING", order: { status: { in: ["PAID", "PROCESSING"] } }, supplierOrders: { some: { status: { in: ["WAITING", "IN_PROCESS", "SUBMITTING"] } } } } }),
    prisma.orderItem.count({ where: { status: "PENDING", order: { status: { in: ["PAID", "PROCESSING"] } }, variant: { supplierId: null } } }),
    prisma.$queryRaw<{ name: string; balance: number }[]>`SELECT name, balance FROM "Supplier" WHERE "isEnabled" AND "lowBalanceAlert" > 0 AND balance < "lowBalanceAlert"`,
    prisma.supplier.count({ where: { isEnabled: true, lastError: { not: null } } }),
  ]);
  const needs = payments + kyc + supplierIssues + manualWaiting;
  const change = yd.sales ? Math.round(((td.sales - yd.sales) / yd.sales) * 100) : null;
  const max = Math.max(1, ...series.map((d) => d.sales));
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Port-au-Prince" }).format(now));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const card = "rounded-2xl border border-border bg-surface p-4";

  return (
    <div className="space-y-5">
      {sp.denied && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Your role does not have access to that page.</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[32px] tracking-tight">{hello}, {staff.name.split(" ")[0]}</h1>
          <p className="text-muted">Here is GSMLite today.</p>
        </div>
        <Link href="/admin/suppliers" className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${suppliersDown ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}>
          ● {suppliersDown ? `${suppliersDown} supplier${suppliersDown > 1 ? "s" : ""} with a problem` : "All suppliers online"}
        </Link>
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <div className={card}><span className="text-[13px] text-muted">Sales today</span><b className="display block text-3xl tabular-nums">{usd(td.sales)}</b>
          <span className={`text-[13px] ${change == null || change >= 0 ? "text-primary" : "text-danger"}`}>{change == null ? "No sales yesterday at this time" : `${change >= 0 ? "+" : ""}${change}% vs yesterday`}</span></div>
        <div className={card}><span className="text-[13px] text-muted">Profit today</span><b className="display block text-3xl tabular-nums">{usd(td.profit)}</b><span className="text-[13px] text-muted">Sales minus supplier cost</span></div>
        <div className={card}><span className="text-[13px] text-muted">Orders in progress</span><b className="display block text-3xl">{withSupplier + manualWaiting}</b><span className="text-[13px] text-muted">{withSupplier} with suppliers · {manualWaiting} manual</span></div>
        <div className={`${card} ${needs ? "!border-[1.5px] !border-warning" : ""}`}><span className="text-[13px] text-muted">Needs you</span><b className={`display block text-3xl ${needs ? "text-warning" : ""}`}>{needs}</b><span className={`text-[13px] ${needs ? "text-warning" : "text-muted"}`}>Payments, KYC, supplier problems</span></div>
      </div>

      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="ch" className={`${card} flex-[2_1_420px] p-[18px]`}>
          <h2 id="ch" className="mb-3.5 font-semibold">Sales and profit · last 14 days</h2>
          <div className="flex h-[200px] items-end gap-2 border-b border-border" role="img" aria-label={`Daily sales, highest ${usd(max)}`}>
            {series.map((d, i) => (
              <span key={i} className="group relative flex h-full flex-1 items-end" title={`${d.day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${usd(d.sales)} sales · ${usd(d.profit)} profit`}>
                <span className={`relative w-full rounded-t ${i === series.length - 1 ? "bg-primary" : "bg-[#c7e6d3] dark:bg-primary/40"}`} style={{ height: `${Math.max(2, (d.sales / max) * 100)}%` }}>
                  <span className="absolute inset-x-0 bottom-0 rounded-t bg-[#145c39]/60" style={{ height: d.sales ? `${Math.max(0, Math.min(100, (d.profit / d.sales) * 100))}%` : 0 }} />
                </span>
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>{series[0].day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span>Light: sales · dark: profit</span>
            <span>Today</span>
          </div>
        </section>

        <section aria-labelledby="todo" className="flex-[1_1_280px] overflow-hidden rounded-2xl border border-border bg-surface">
          <h2 id="todo" className="border-b border-border px-4 py-3.5 font-semibold">To do now</h2>
          {[
            { href: "/admin/payments", label: "Payments to approve", n: payments },
            { href: "/admin/kyc", label: "KYC documents to review", n: kyc },
            { href: "/admin/suppliers", label: "Supplier orders needing a decision", n: supplierIssues, warn: true },
            { href: "/admin/orders?show=manual", label: "Manual orders waiting", n: manualWaiting },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="flex justify-between border-b border-border px-4 py-3 last:border-0 hover:bg-surface-2">
              <span>{x.label}</span><b className={x.warn && x.n ? "text-warning" : ""}>{x.n}</b>
            </Link>
          ))}
          {lowBalance.map((s) => (
            <Link key={s.name} href="/admin/suppliers" className="flex justify-between border-t border-border px-4 py-3 hover:bg-surface-2"><span>{s.name} balance low</span><b className="text-warning">{usd(s.balance)}</b></Link>
          ))}
        </section>
      </div>

      <section aria-labelledby="top" className="overflow-hidden rounded-2xl border border-border bg-surface">
        <h2 id="top" className="border-b border-border px-4 py-3.5 font-semibold">Top services this week</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5">Service</th><th className="px-4 py-2.5">Orders</th><th className="px-4 py-2.5">Success rate</th><th className="px-4 py-2.5">Avg. time</th><th className="px-4 py-2.5">Profit</th></tr></thead>
            <tbody>
              {top.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No orders this week yet.</td></tr>}
              {top.map((r) => {
                const done = Number(r.delivered) + Number(r.failed);
                const rate = done ? Math.floor((Number(r.delivered) / done) * 1000) / 10 : null;
                return (
                  <tr key={r.productId} className="border-t border-border">
                    <td className="px-4 py-3"><Link href={`/admin/products/${r.productId}`} className="hover:text-primary">{t(r.name, "en")}</Link></td>
                    <td className="px-4 py-3">{Number(r.orders)}</td>
                    <td className={`px-4 py-3 font-semibold ${rate == null ? "text-muted" : rate < 80 ? "text-warning" : "text-primary"}`}>{rate == null ? "—" : `${rate}%${rate < 80 ? " · check supplier" : ""}`}</td>
                    <td className="px-4 py-3">{dur(r.median == null ? null : Number(r.median))}</td>
                    <td className="px-4 py-3 tabular-nums">{usd(Number(r.profit ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

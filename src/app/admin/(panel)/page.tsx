import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { salesProfit, dailySeries, topServices } from "@/lib/reports";
import { supplierAttentionCount } from "@/lib/suppliers/attention";
import { durationParts } from "@/lib/duration";
import { formatMoney } from "@/lib/money";
import { Stat } from "@/components/admin/ui";

const ORDER_STATUS: Record<string, [string, string]> = {
  AWAITING_PAYMENT: ["Awaiting payment", "bg-surface-2 text-muted"],
  PAYMENT_REVIEW: ["Payment to check", "bg-warning-soft text-warning"],
  PAID: ["Paid", "bg-primary-soft text-primary"],
  PROCESSING: ["Working", "bg-[#e3eefb] text-[#154a80] dark:bg-[#15263b] dark:text-[#8bb8ea]"],
  FULFILLED: ["Done", "bg-success-soft text-success"],
  FAILED: ["Failed", "bg-danger-soft text-danger"],
  REFUNDED: ["Refunded", "bg-warning-soft text-warning"],
  CANCELED: ["Canceled", "bg-surface-2 text-muted"],
};

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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [td, yd, series, top, payments, kyc, supplierIssues, withSupplier, manualWaiting, lowBalance, suppliersDown, month, recent, suppliers, newCustomers] = await Promise.all([
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
    salesProfit(monthStart, now),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } }, items: { select: { productName: true, identifier: true } } } }),
    prisma.supplier.findMany({ where: { isEnabled: true }, select: { id: true, name: true, balance: true, lowBalanceAlert: true, lastError: true }, orderBy: { name: "asc" } }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
  ]);
  const needs = payments + kyc + supplierIssues + manualWaiting;
  const change = yd.sales ? Math.round(((td.sales - yd.sales) / yd.sales) * 100) : null;
  const max = Math.max(1, ...series.map((d) => d.sales));
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Port-au-Prince" }).format(now));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const card = "rounded-2xl border border-border bg-surface p-4";

  const first = staff.name.split(" ")[0];

  return (
    <div className="space-y-5">
      {sp.denied && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Your role does not have access to that page.</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative overflow-hidden rounded-3xl bg-[#111418] p-6 text-white sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#1f7a4d]/40 blur-3xl" />
          <p className="text-sm font-semibold text-[#7ce0a8]">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="display mt-1 text-[32px] leading-tight tracking-tight sm:text-[40px]">{hello}, {first}</h1>
          <p className="mt-2 max-w-xl text-[15px] text-[#c9cfc6]">
            {withSupplier + manualWaiting > 0 ? `${withSupplier + manualWaiting} order line${withSupplier + manualWaiting > 1 ? "s" : ""} in progress` : "No orders in progress"}
            {needs > 0 ? ` · ${needs} thing${needs > 1 ? "s" : ""} need${needs > 1 ? "" : "s"} you` : " · nothing needs you right now"}.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={needs ? "/admin/orders?show=decision" : "/admin/orders"} className="inline-flex min-h-11 items-center rounded-xl bg-[#7ce0a8] px-5 font-semibold text-[#0b2a1a]">{needs ? "Handle what needs me" : "Open orders"}</Link>
            <Link href="/admin/suppliers" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-5 font-semibold">Import services</Link>
            <Link href="/admin/products/new" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-5 font-semibold">+ New service</Link>
          </div>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Suppliers</h2>
            <Link href="/admin/suppliers" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${suppliersDown ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}>{suppliersDown ? `${suppliersDown} with a problem` : "All online"}</Link>
          </div>
          {suppliers.length === 0 && <p className="mt-3 text-sm text-muted">No supplier yet. <Link href="/admin/suppliers" className="font-semibold text-primary">Add your first supplier</Link> to import services and send orders automatically.</p>}
          <ul className="mt-3 divide-y divide-border">
            {suppliers.map((s) => {
              const low = s.balance != null && s.lowBalanceAlert > 0 && s.balance < s.lowBalanceAlert;
              return (
                <li key={s.id}>
                  <Link href={`/admin/suppliers/${s.id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${s.lastError ? "bg-warning" : "bg-primary"}`} /><span className="truncate">{s.name}</span></span>
                    <b className={`tabular-nums ${low ? "text-warning" : ""}`}>{s.balance == null ? "—" : usd(s.balance)}</b>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Sales today" value={usd(td.sales)} note={change == null ? (yd.sales ? undefined : "No sales yesterday at this time") : undefined} delta={change == null ? undefined : { text: `${change >= 0 ? "+" : ""}${change}% vs yesterday`, good: change >= 0 }} />
        <Stat label="Profit today" value={usd(td.profit)} note="Sales minus supplier cost" tone="good" />
        <Stat label="This month" value={usd(month.sales)} note={`${usd(month.profit)} profit · ${newCustomers} new customer${newCustomers === 1 ? "" : "s"} this week`} />
        <Stat label="Needs you" value={needs} tone={needs ? "warn" : undefined} note="Payments, KYC, supplier problems" href={needs ? "/admin/orders?show=decision" : undefined} />
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

      <section aria-labelledby="recent" className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <h2 id="recent" className="font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold text-primary">All orders →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No orders yet. They appear here as soon as a customer orders.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((o) => {
              const [label, cls] = ORDER_STATUS[o.status] ?? [o.status, "bg-surface-2"];
              const names = [...new Set(o.items.map((i) => t(i.productName, "en")))];
              return (
                <li key={o.id}>
                  <Link href={`/admin/orders?id=${o.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-sm hover:bg-surface-2 sm:grid-cols-[70px_minmax(0,1.4fr)_minmax(0,1fr)_110px_90px]">
                    <b className="text-primary">#{o.number}</b>
                    <span className="truncate">{names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""}<span className="block text-xs text-muted sm:hidden">{o.user.name}</span></span>
                    <span className="hidden truncate text-muted sm:block">{o.user.name}</span>
                    <span className={`hidden justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${cls}`}>{label}</span>
                    <span className="text-right tabular-nums">{formatMoney(o.total, o.currency, "en")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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

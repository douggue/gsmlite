import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { ago } from "@/lib/ago";
import { deliverItem } from "@/actions/admin";
import { checkSupplierItemNow, refundSupplierItem } from "@/actions/suppliers";
import { ActionButton } from "@/components/admin/ActionButton";

export const metadata = { title: "Orders" };

const FILTERS = {
  all: "All",
  supplier: "With supplier",
  manual: "Manual",
  decision: "Needs decision",
  done: "Done",
  refunded: "Refunded",
} as const;
type Filter = keyof typeof FILTERS;
const LIVE = { in: ["WAITING", "IN_PROCESS", "SUBMITTING"] as ("WAITING" | "IN_PROCESS" | "SUBMITTING")[] };

function filterWhere(f: Filter): Prisma.OrderWhereInput {
  const open = { status: { in: ["PAID", "PROCESSING"] as ("PAID" | "PROCESSING")[] } };
  switch (f) {
    case "supplier": return { ...open, items: { some: { status: "PENDING", supplierOrders: { some: { status: LIVE } } } } };
    case "manual": return { ...open, items: { some: { status: "PENDING", variant: { supplierId: null } } } };
    case "decision": return {
      OR: [
        { riskFlags: { some: { status: "OPEN" } } },
        { items: { some: { status: "PENDING", supplierOrders: { some: { status: "UNKNOWN" } } } } },
        { ...open, items: { some: { status: "PENDING", variant: { supplierId: { not: null } }, supplierOrders: { none: { status: { in: ["WAITING", "IN_PROCESS", "SUBMITTING", "UNKNOWN", "SUCCESS"] } } } } }, paidAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      ],
    };
    case "done": return { status: "FULFILLED" };
    case "refunded": return { status: { in: ["REFUNDED", "CANCELED"] } };
    default: return {};
  }
}

/** Orders (mockup): filters, the list, and the selected order's lines with what can be done on each. */
export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ show?: string; q?: string; id?: string }> }) {
  await requireStaff("orders.view");
  const sp = await searchParams;
  const show: Filter = sp.show && sp.show in FILTERS ? (sp.show as Filter) : "all";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const where: Prisma.OrderWhereInput = { ...filterWhere(show) };
  if (q) {
    const n = Number(q.replace("#", ""));
    where.AND = [{ OR: [
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { items: { some: { identifier: q.replace(/\s/g, "") } } },
      ...(Number.isInteger(n) && n > 0 && n < 2 ** 31 ? [{ number: n }] : []),
    ] }];
  }
  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { name: true, priceGroup: { select: { name: true } } } }, items: { select: { status: true, identifier: true, productName: true } } },
    }),
    Promise.all((["supplier", "manual", "decision"] as Filter[]).map((f) => prisma.order.count({ where: filterWhere(f) }))),
  ]);
  const count = { supplier: counts[0], manual: counts[1], decision: counts[2] } as Record<string, number>;
  const selected = sp.id
    ? await prisma.order.findUnique({
        where: { id: sp.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { supplierOrders: { orderBy: { createdAt: "desc" }, take: 1, include: { supplier: { select: { name: true } } } } } },
          events: { orderBy: { createdAt: "asc" } },
          riskFlags: { where: { status: "OPEN" } },
        },
      })
    : null;
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ show: show === "all" ? undefined : show, q: q || undefined, ...p })) if (v) u.set(k, v);
    return `/admin/orders${u.size ? `?${u}` : ""}`;
  };
  const summary = (o: (typeof orders)[number]) => {
    if (o.status === "AWAITING_PAYMENT") return { text: `Awaiting ${o.paymentMethod === "WALLET" ? "payment" : o.paymentMethod.toLowerCase()}`, cls: "text-warning" };
    if (o.status === "PAYMENT_REVIEW") return { text: "Payment to check", cls: "text-warning" };
    const d = o.items.filter((i) => i.status === "DELIVERED").length;
    const f = o.items.filter((i) => i.status === "FAILED").length;
    const w = o.items.length - d - f;
    if (o.items.length > 1 && (d || f) && w) return { text: `${d} done · ${w} working · ${f} refunded`, cls: "" };
    if (w) return { text: "Working", cls: "text-[#154a80] dark:text-[#8bb8ea]" };
    if (f && !d) return { text: "Refunded", cls: "text-warning" };
    return { text: "Done", cls: "text-primary" };
  };

  return (
    <div className="space-y-4">
      <h1 className="display text-[30px] font-bold tracking-tight">Orders</h1>
      <form className="flex flex-wrap items-center gap-2">
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        <label htmlFor="oq" className="sr-only">Search orders</label>
        <input id="oq" name="q" defaultValue={q} placeholder="Order #, IMEI, customer email…" className="input min-h-11 flex-[1_1_260px]" />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <Link key={f} href={href({ show: f === "all" ? undefined : f, id: undefined })}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold ${show === f ? "bg-[#111418] text-white dark:bg-primary" : `border bg-surface ${f === "decision" && count.decision ? "border-warning/50 text-warning" : "border-border"}`}`}>
              {FILTERS[f]}{f in count ? ` ${count[f]}` : ""}
            </Link>
          ))}
        </div>
      </form>

      <div className={`grid gap-4 ${selected ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
        <section className="card overflow-hidden">
          <div className="hidden grid-cols-[80px_minmax(0,1fr)_minmax(0,1.4fr)_70px_minmax(0,1.1fr)_100px] gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
            <span>Order</span><span>Customer</span><span>Service</span><span>IMEIs</span><span>Status</span><span className="text-right">Total</span>
          </div>
          {orders.length === 0 && <div className="px-6 py-10 text-center"><p className="font-semibold">No orders here</p><p className="mt-1 text-sm text-muted">{show === "all" && !q ? "Orders appear as soon as a customer pays." : "Try another filter or search."}</p></div>}
          <ul className="divide-y divide-border">
            {orders.map((o) => {
              const st = summary(o);
              const names = [...new Set(o.items.map((i) => t(i.productName, "en")))];
              const imeis = o.items.filter((i) => i.identifier).length;
              return (
                <li key={o.id}>
                  <Link href={href({ id: o.id })} scroll={false}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[80px_minmax(0,1fr)_minmax(0,1.4fr)_70px_minmax(0,1.1fr)_100px] ${o.id === sp.id ? "bg-primary-soft" : "hover:bg-surface-2"}`}>
                    <b className="text-primary">#{o.number}</b>
                    <span className="min-w-0 md:order-none">
                      <span className="block truncate md:hidden">{names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""}</span>
                      <span className="block truncate text-xs text-muted md:text-sm md:text-text">{o.user.name}{o.user.priceGroup && <span className="ml-1.5 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">{o.user.priceGroup.name}</span>}</span>
                    </span>
                    <span className="hidden truncate md:block">{names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""}</span>
                    <span className="hidden text-muted md:block">{imeis || "—"}</span>
                    <span className={`col-span-2 text-xs font-semibold md:col-span-1 md:text-sm ${st.cls}`}>{st.text}{imeis > 1 ? <span className="font-normal text-muted md:hidden"> · {imeis} IMEIs</span> : null}</span>
                    <span className="row-start-1 text-right tabular-nums md:row-auto">{formatMoney(o.total, o.currency, "en")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {selected && (
          <aside className="card h-fit space-y-3 p-4 xl:sticky xl:top-6">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Order #{selected.number}</h2>
              <span className="flex items-center gap-3 text-sm"><Link href={`/admin/orders/${selected.id}`} className="font-semibold text-primary">Full page →</Link><Link href={href({ id: undefined })} scroll={false} className="text-muted" aria-label="Close">✕</Link></span>
            </div>
            <p className="text-sm text-muted">
              <Link href={`/admin/customers/${selected.user.id}`} className="text-primary">{selected.user.name}</Link> · {selected.paymentMethod.toLowerCase()} · {selected.currency} · {formatMoney(selected.total, selected.currency, "en")}
            </p>
            {selected.riskFlags.length > 0 && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Held for review: {selected.riskFlags.map((f) => f.reason).join("; ")} · <Link href="/admin/risk" className="underline">Risk queue</Link></p>}
            <ul className="space-y-2.5">
              {selected.items.map((i) => {
                const so = i.supplierOrders[0];
                return (
                  <li key={i.id} className="space-y-2 rounded-xl border border-border p-3 text-sm">
                    <div className="font-mono">{i.identifier ?? `${t(i.productName, "en")} × ${i.quantity}`}</div>
                    <p className="text-muted">
                      {i.status === "DELIVERED" && <>Done{so ? ` · ${so.supplier.name} ref ${so.remoteRef}` : ""}</>}
                      {i.status === "FAILED" && <>Refunded {formatMoney(i.unitPrice * i.quantity, selected.currency, "en")}</>}
                      {i.status === "PENDING" && (so
                        ? <>{so.status === "UNKNOWN" ? "No clear answer from" : so.status.replace("_", " ").toLowerCase() + " at"} {so.supplier.name}{so.remoteRef ? ` (ref ${so.remoteRef})` : ""} · checked {ago(so.updatedAt)} · {so.checks} checks</>
                        : <>Waiting{selected.paidAt ? " for staff" : " for payment"}</>)}
                    </p>
                    {i.deliveryNote && <p className="whitespace-pre-line rounded-lg bg-surface-2 px-2.5 py-2 text-[13px]">“{i.deliveryNote}”</p>}
                    {i.status === "PENDING" && selected.paidAt && (
                      <div className="flex flex-wrap gap-2">
                        {so && (so.status === "WAITING" || so.status === "IN_PROCESS") && <ActionButton label="Check now" action={checkSupplierItemNow.bind(null, i.id)} />}
                        <ActionButton label="Deliver by hand" prompt="Result shown to the customer (unlock code, report…)" action={deliverItem.bind(null, i.id)} />
                        <ActionButton label="Reject & refund" prompt="Reason shown to the customer" className="btn-secondary min-h-9 px-3 text-xs !text-warning" action={refundSupplierItem.bind(null, i.id)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">History</h3>
              <ol className="space-y-1 text-[13px] text-muted">
                {selected.events.map((e) => <li key={e.id}>{e.note || e.status.replace("_", " ").toLowerCase()} · {e.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</li>)}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

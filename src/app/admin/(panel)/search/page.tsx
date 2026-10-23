import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Search" };

const STATUS: Record<string, string> = { AWAITING_PAYMENT: "Awaiting payment", PAYMENT_REVIEW: "Payment to check", PAID: "Paid", PROCESSING: "Working", FULFILLED: "Done", FAILED: "Failed", REFUNDED: "Refunded", CANCELED: "Canceled" };

/** One search box for the whole admin: order number, IMEI/serial, customer, service. */
export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireStaff();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const n = Number(q.replace(/^#/, ""));
  const ident = q.replace(/[\s-]/g, "");
  const [orders, customers, services] = q.length < 2 ? [[], [], []] : await Promise.all([
    can(staff, "orders.view")
      ? prisma.order.findMany({
          where: { OR: [...(Number.isInteger(n) && n > 0 && n < 2 ** 31 ? [{ number: n }] : []), { items: { some: { identifier: { contains: ident, mode: "insensitive" } } } }, { user: { email: { contains: q, mode: "insensitive" } } }] as Prisma.OrderWhereInput[] },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true } }, items: { select: { productName: true, identifier: true }, take: 3 } },
        })
      : [],
    can(staff, "customers.view")
      ? prisma.user.findMany({ where: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || "—" } }] }, take: 20, select: { id: true, name: true, email: true, status: true } })
      : [],
    can(staff, "catalog.manage")
      ? prisma.product.findMany({ where: { OR: [{ slug: { contains: q.toLowerCase() } }, { name: { path: ["en"], string_contains: q } }, { tags: { has: q } }, { variants: { some: { supplierServiceId: q } } }] }, take: 20, select: { id: true, name: true, slug: true, isPublished: true } })
      : [],
  ]);
  const none = q.length >= 2 && !orders.length && !customers.length && !services.length;
  const box = "card divide-y divide-border";
  const row = "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-2";

  return (
    <>
      <PageTitle title="Search" sub="Order number, IMEI or serial, customer name or email, service name or supplier ID." />
      <form className="mb-6 flex max-w-xl gap-2">
        <input name="q" defaultValue={q} autoFocus placeholder="e.g. 1042, 356938035643809, jean@…, FRP" className="input min-h-12" />
        <button className="btn-primary min-h-12 px-5">Search</button>
      </form>
      {none && <p className="card p-8 text-center text-muted">Nothing found for “{q}”.</p>}
      <div className="grid gap-5 xl:grid-cols-3">
        {orders.length > 0 && (
          <section className="xl:col-span-2">
            <h2 className="mb-2 font-semibold">Orders</h2>
            <div className={box}>
              {orders.map((o) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className={row}>
                  <span><b className="text-primary">#{o.number}</b> · {o.user.name} · {o.items.map((i) => i.identifier ?? t(i.productName, "en")).join(", ")}</span>
                  <span className="text-muted">{STATUS[o.status] ?? o.status} · {formatMoney(o.total, o.currency, "en")}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {customers.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Customers</h2>
            <div className={box}>
              {customers.map((c) => <Link key={c.id} href={`/admin/customers/${c.id}`} className={row}><span><b>{c.name}</b><span className="block text-xs text-muted">{c.email}</span></span>{c.status !== "ACTIVE" && <span className="badge bg-warning-soft text-warning">{c.status.toLowerCase()}</span>}</Link>)}
            </div>
          </section>
        )}
        {services.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Services</h2>
            <div className={box}>
              {services.map((p) => <Link key={p.id} href={`/admin/products/${p.id}`} className={row}><span>{t(p.name, "en")}</span><span className="text-xs text-muted">{p.isPublished ? "On the site" : "Hidden"}</span></Link>)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

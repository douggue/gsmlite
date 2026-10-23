import { siteUrl } from "@/lib/site-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { itemTitle } from "@/lib/orders";
import { deliverItem, refundOrder, revealOrderCodes, runFulfillment } from "@/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { RevealCodes } from "@/components/admin/RevealCodes";
import { FieldAnswers } from "@/components/admin/FieldAnswers";
import type { FieldDef } from "@/lib/order-form";
import { StatusBadge } from "@/components/StatusBadge";
import { PageTitle } from "@/components/admin/ui";
import { formatPhone, waNumber } from "@/lib/phone";
import { ITEM_STATUS, METHOD, ORDER_STATUS, PAYMENT_STATUS, SUPPLIER_STATUS, label } from "@/lib/admin-labels";
import { CopyButton } from "@/components/CopyButton";
import { ago } from "@/lib/ago";

export const metadata = { title: "Order" };


export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("orders.view");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { variant: { include: { product: true } }, supplierOrders: { orderBy: { createdAt: "desc" }, take: 1, include: { supplier: { select: { name: true } } } }, _count: { select: { codes: true } } } },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      riskFlags: true,
    },
  });
  if (!order) notFound();
  const manage = can(staff, "orders.manage");

  return (
    <>
      <PageTitle
        title={`Order #${order.number}`}
        sub={`${order.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · paid by ${label(METHOD, order.paymentMethod).toLowerCase()} · ${formatMoney(order.total, order.currency, "en")}`}
        actions={<><Link href="/admin/orders" className="btn-secondary min-h-10 px-4">← All orders</Link><StatusBadge status={order.status} label={label(ORDER_STATUS, order.status)} /></>}
      />
      {order.riskFlags.filter((f) => f.status === "OPEN").map((f) => (
        <p key={f.id} className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Held for a risk check: {f.reason}. Nothing is delivered until it is approved in <Link href="/admin/risk" className="font-semibold underline">Money → Risk checks</Link>.</p>
      ))}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <section className="card divide-y divide-border">
            {order.items.map((i) => (
              <div key={i.id} className="space-y-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{i.identifier ? <span className="font-mono">{i.identifier}</span> : <>{itemTitle(i, "en")} × {i.quantity}</>}</p>
                  <StatusBadge status={i.status} label={label(ITEM_STATUS, i.status)} />
                </div>
                {i.identifier && <p className="text-sm">{itemTitle(i, "en")}</p>}
                {i.supplierOrders[0] && (() => {
                  const so = i.supplierOrders[0];
                  return <p className="text-sm text-muted">{label(SUPPLIER_STATUS, so.status)} {so.supplier.name}{so.remoteRef ? ` · their ref ${so.remoteRef}` : ""} · checked {ago(so.updatedAt)}{so.error ? ` · ${so.error}` : ""}</p>;
                })()}
                <p className="text-xs text-muted">{i.variant.product.fulfillmentType === "SUPPLIER_API" ? "Supplier" : i.variant.product.fulfillmentType === "CODE_INVENTORY" ? "License keys from stock" : "Delivered by hand"} · {formatMoney(i.unitPrice, order.currency, "en")} each{i._count.codes > 0 ? ` · ${i._count.codes} key(s) delivered` : ""}</p>
                <FieldAnswers itemId={i.id} values={i.fieldValues as Record<string, string>} defs={i.variant.product.fields as FieldDef[]} />
                {i.deliveryNote && <p className="rounded-lg bg-surface-2 p-3 text-sm">{i.deliveryNote}</p>}
                {manage && i.status === "PENDING" && ["PAID", "PROCESSING"].includes(order.status) && (
                  <ActionButton label="Deliver by hand…" className="btn-primary min-h-9 px-3 text-xs" prompt="Result shown to the customer (unlock code, report, license…)" action={deliverItem.bind(null, i.id)} />
                )}
              </div>
            ))}
          </section>
          {manage && (
            <div className="flex flex-wrap gap-2">
              {["PAID", "PROCESSING"].includes(order.status) && <ActionButton label="Send waiting lines again" confirm="Send the lines that are still waiting to their supplier (or deliver keys from stock) now?" action={runFulfillment.bind(null, order.id)} />}
              {["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAID", "PROCESSING", "FAILED"].includes(order.status) && (
                <ActionButton label="Cancel and refund to wallet…" className="btn-danger min-h-9 px-3 text-xs" prompt="Why? (shown in the order history)" confirm="Cancel the order and put the unpaid-for lines back in the customer's wallet?" action={refundOrder.bind(null, order.id)} />
              )}
            </div>
          )}
          {can(staff, "codes.reveal") && order.items.some((i) => i._count.codes > 0) && <RevealCodes action={revealOrderCodes.bind(null, order.id)} />}
        </div>
        <div className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            <Link href={`/admin/customers/${order.userId}`} className="font-medium text-primary">{order.user.name}</Link>
            <p className="text-muted">{order.user.email} {order.user.phone && <>· <a href={`https://wa.me/${waNumber(order.user.phone)}`} target="_blank" rel="noopener" className="text-[#1fa855]">{formatPhone(order.user.phone)} ↗</a></>}</p>
            {order.recipientNote && <p className="mt-2"><span className="text-muted">Note:</span> {order.recipientNote}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-muted">Order status link for the customer</span><CopyButton value={`${siteUrl()}/${order.user.locale}/order-status/${order.id}?t=${order.accessToken}`} label="Copy link" done="Copied" /></div>
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Payments</h2>
            {order.payments.length === 0 ? <p className="text-muted">{order.paymentMethod === "WALLET" ? "Paid from wallet" : "No payment yet"}</p> : order.payments.map((p) => (
              <p key={p.id} className="py-1">{label(METHOD, p.provider)} · {formatMoney(p.amount, p.currency, "en")} · <b>{label(PAYMENT_STATUS, p.status)}</b> {p.providerRef && <span className="font-mono text-xs text-muted">· {p.providerRef}</span>}</p>
            ))}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">History</h2>
            <ol className="space-y-2">
              {order.events.map((e) => (
                <li key={e.id}><b>{label(ORDER_STATUS, e.status)}</b> <span className="text-muted">{e.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>{e.note && <><br /><span className="text-muted">{e.note}</span></>}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

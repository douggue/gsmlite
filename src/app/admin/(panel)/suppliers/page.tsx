import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { supplierAttention } from "@/lib/suppliers/attention";
import { confirmSupplierOrder, refundSupplierItem, resendSupplierItem, resendWaiting, syncSupplier } from "@/actions/suppliers";
import { ActionButton } from "@/components/admin/ActionButton";
import { PageTitle } from "@/components/admin/ui";
import { ago } from "@/lib/ago";
import { SupplierForm } from "@/components/admin/SupplierForm";

export const metadata = { title: "Suppliers" };

const usd = (c: number | null) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);

const linkBtn = "inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-semibold";

export default async function SuppliersPage() {
  await requireStaff("suppliers.manage");
  const [suppliers, attention, counts, live] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { createdAt: "asc" } }),
    supplierAttention(),
    prisma.supplierService.groupBy({ by: ["supplierId"], where: { active: true }, _count: true }),
    prisma.supplierOrder.groupBy({ by: ["supplierId"], where: { status: { in: ["WAITING", "IN_PROCESS"] } }, _count: true }),
  ]);
  const nServices = new Map(counts.map((c) => [c.supplierId, c._count]));
  const nLive = new Map(live.map((c) => [c.supplierId, c._count]));
  const waiting = new Map<string, number>();
  for (const i of attention.stalled) if (i.variant.supplierId) waiting.set(i.variant.supplierId, (waiting.get(i.variant.supplierId) ?? 0) + 1);
  const rows = attention.unknown.length + attention.stalled.length + attention.slow.length;

  return (
    <>
      <PageTitle
        title="Suppliers"
        sub="Sites you buy from through their Dhru Fusion API. Paid orders are sent automatically and followed until they are done."
        actions={<a href="#add" className="btn-primary min-h-11 px-4">+ Add supplier</a>}
      />

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        {suppliers.map((s) => {
          const low = s.lowBalanceAlert > 0 && s.balance != null && s.balance < s.lowBalanceAlert;
          const stuck = waiting.get(s.id) ?? 0;
          const problem = !s.isEnabled || low || !!s.lastError || stuck > 0;
          const chip = !s.isEnabled ? "Switched off" : s.lastError ? "Problem" : low ? "Low balance" : "Connected";
          return (
            <article key={s.id} className={`card flex flex-col gap-2.5 p-4 ${problem ? "!border-[1.5px] !border-warning" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <b className="truncate text-base">{s.name}</b>
                <span className={`badge shrink-0 ${problem ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}>{chip}</span>
              </div>
              <div>
                <span className="text-xs text-muted">Balance</span>
                <b className={`display block text-[26px] tabular-nums ${low ? "text-warning" : ""}`}>{usd(s.balance)}{s.currency && s.currency !== "USD" ? ` ${s.currency}` : ""}</b>
              </div>
              {problem && (s.lastError || stuck > 0) ? (
                <p className="text-[13px] text-muted">
                  {s.lastError ? <>Says “{s.lastError}”</> : "Orders are waiting"}
                  {stuck > 0 && <>: {stuck} order{stuck === 1 ? " is" : "s are"} waiting, nobody was refunded</>}
                </p>
              ) : (
                <p className="text-[13px] text-muted">{nServices.get(s.id) ?? 0} services · synced {ago(s.lastSyncAt)} · {nLive.get(s.id) ?? 0} orders open</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                {stuck > 0 && s.isEnabled ? (
                  <ActionButton label="Send waiting orders again" className={`${linkBtn} bg-primary text-white`} action={resendWaiting.bind(null, s.id)} />
                ) : (
                  <Link href={`/admin/suppliers/${s.id}`} className={`${linkBtn} bg-[#111418] text-white dark:bg-surface-2`}>Service list &amp; import</Link>
                )}
                <ActionButton label="Sync now" className={`${linkBtn} border border-border bg-surface`} action={syncSupplier.bind(null, s.id)} />
                <Link href={`/admin/suppliers/${s.id}/logs`} className={`${linkBtn} border border-border bg-surface`}>Logs</Link>
              </div>
            </article>
          );
        })}
      </div>

      {rows > 0 && (
        <section aria-labelledby="att" className="card mt-6 overflow-hidden">
          <h2 id="att" className="border-b border-border px-4 py-3.5 font-semibold">Needs your attention</h2>
          <div className="divide-y divide-border">
            {attention.unknown.map((so) => (
              <Row key={so.id} order={so.orderItem.order} imei={so.orderItem.identifier}
                problem={<>No answer when sending: check on {so.supplier.name}&apos;s site whether the order exists. It is never sent twice by itself.</>}>
                <ActionButton label="It exists: enter its number" prompt="Order number shown on the supplier's site" action={confirmSupplierOrder.bind(null, so.id)} />
                <ActionButton label="Not there: send again" confirm="Only if you checked the supplier's site and the order is NOT there. Send again?" action={resendSupplierItem.bind(null, so.orderItemId)} />
              </Row>
            ))}
            {attention.stalled.map((i) => (
              <Row key={i.id} order={i.order} imei={i.identifier}
                problem={!i.variant.supplier?.isEnabled ? `${i.variant.supplier?.name} is switched off` : `Waiting on ${i.variant.supplier?.name}: ${i.supplierOrders[0]?.error ?? i.variant.supplier?.lastError ?? "not sent yet"}`}>
                <ActionButton label="Send again" action={resendSupplierItem.bind(null, i.id)} />
                <ActionButton label="Refund customer" prompt="Reason shown to the customer" className="btn-secondary min-h-9 px-3 text-xs !text-warning" action={refundSupplierItem.bind(null, i.id)} />
              </Row>
            ))}
            {attention.slow.map((so) => (
              <Row key={so.id} order={so.orderItem.order} imei={so.orderItem.identifier}
                problem={`With ${so.supplier.name} for ${ago(so.createdAt).replace(" ago", "")} (their order ${so.remoteRef}). Ask them, or cancel it there and refund.`}>
                <ActionButton label="Refund customer" prompt="Reason shown to the customer" className="btn-secondary min-h-9 px-3 text-xs !text-warning" action={refundSupplierItem.bind(null, so.orderItemId)} />
              </Row>
            ))}
          </div>
        </section>
      )}

      <section id="add" className="mt-8 scroll-mt-6">
        <h2 className="mb-3 font-semibold">{suppliers.length ? "Add another supplier" : "Add your first supplier"}</h2>
        <SupplierForm />
      </section>
    </>
  );
}

function Row({ order, imei, problem, children }: { order: { id: string; number: number }; imei: string | null; problem: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[6rem_11rem_1fr_auto] md:items-center md:gap-4">
      <Link href={`/admin/orders/${order.id}`} className="font-semibold text-primary">#{order.number}</Link>
      <span className="font-mono text-[13px]">{imei ?? "—"}</span>
      <span>{problem}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

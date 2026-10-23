import { METHOD, PAYMENT_STATUS, label } from "@/lib/admin-labels";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { approvePayment, rejectPaymentAction } from "@/actions/admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPhone } from "@/lib/phone";
import { moncashAvailable } from "@/lib/payments/moncash";
import { describeRule } from "@/lib/countries";

export const metadata = { title: "Payments" };

/** Block explorer link so staff can check a crypto deposit before approving. */
function explorer(network: string | null, hash: string) {
  const n = (network ?? "").toLowerCase();
  const h = encodeURIComponent(hash);
  if (n.includes("bep") || n.includes("bsc")) return `https://bscscan.com/tx/${h}`;
  if (n.includes("polygon")) return `https://polygonscan.com/tx/${h}`;
  if (n.includes("trc") || n.includes("tron")) return `https://tronscan.org/#/transaction/${h.replace(/^0x/, "")}`;
  if (n.includes("erc") || n.includes("eth")) return `https://etherscan.io/tx/${h}`;
  return null;
}

export default async function AdminPayments() {
  await requireStaff("payments.review");
  const [queue, recent, settings] = await Promise.all([
    prisma.paymentIntent.findMany({
      where: { status: "REVIEW" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } }, order: { select: { number: true } }, manualMethod: { select: { code: true, recipientNumber: true, kind: true, network: true } } },
    }),
    prisma.paymentIntent.findMany({ where: { status: { not: "REVIEW" } }, orderBy: { updatedAt: "desc" }, take: 50, include: { user: { select: { name: true } }, reviewedBy: { select: { name: true } } } }),
    getSettings(),
  ]);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const [today, manual] = await Promise.all([
    prisma.paymentIntent.groupBy({ by: ["provider", "manualMethodId", "currency"], where: { status: "SUCCEEDED", updatedAt: { gte: since } }, _sum: { amount: true } }),
    prisma.manualMethod.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const sum = (provider: string, manualId?: string) =>
    today.filter((x) => x.provider === provider && (manualId === undefined || x.manualMethodId === manualId)).map((x) => formatMoney(x._sum.amount ?? 0, x.currency, "en")).join(" + ") || "0";
  const where = (r: { countryMode: string; countries: string[] }) => describeRule(r);
  const cards = [
    { name: "MonCash", state: moncashAvailable(settings.moncashEnabled) ? (process.env.MONCASH_CLIENT_ID ? "● Connected · automatic" : "Test mode (no keys yet)") : "Off", ok: !!process.env.MONCASH_CLIENT_ID && settings.moncashEnabled, today: sum("MONCASH"), shown: where(settings.payCountries.moncash) },
    { name: "NatCash", state: settings.natcashEnabled ? `Staff approval · ${formatPhone(settings.natcashRecipientPhone)}` : "Off", ok: settings.natcashEnabled, today: sum("NATCASH"), shown: where(settings.payCountries.natcash) },
    { name: "Card (Stripe)", state: !settings.cardEnabled ? "Off" : process.env.STRIPE_SECRET_KEY ? "● Connected · automatic" : "To connect (add the Stripe keys)", ok: settings.cardEnabled && !!process.env.STRIPE_SECRET_KEY, today: sum("CARD"), shown: where(settings.payCountries.card) },
    ...manual.map((m) => ({ name: (m.name as Record<string, string>).en || m.code, state: `Staff approval${m.network ? ` · ${m.network}` : ""}`, ok: true, today: sum("MANUAL", m.id), shown: where(m) })),
  ];
  return (
    <>
      <PageTitle title="Payments" sub="MonCash and cards are confirmed automatically. NatCash, USDT and transfers wait for you here." actions={<Link href="/admin/reconciliation" className="btn-secondary min-h-10 px-4">Match a statement</Link>} />
      <div className="mb-6 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {cards.map((c) => (
          <Link key={c.name} href="/admin/payment-methods" className="rounded-2xl border border-border bg-surface p-4">
            <b className="block">{c.name}</b>
            <span className={`text-[13px] ${c.ok ? "text-primary" : "text-muted"}`}>{c.state}</span>
            <span className="mt-2 block text-[13px] text-muted">Today {c.today} · {c.shown}</span>
          </Link>
        ))}
      </div>
      <h2 className="mb-3 font-semibold">Review queue ({queue.length})</h2>
      <div className="space-y-3">
        {queue.length === 0 && <p className="card p-8 text-center text-sm text-muted">No payments waiting for review.</p>}
        {queue.map((p) => {
          const ageDays = Math.floor((Date.now() - p.user.createdAt.getTime()) / 86_400_000);
          return (
            <div key={p.id} className="card flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="space-y-1 text-sm">
                <p className="text-lg font-bold">{formatMoney(p.amount, p.currency, "en")} <span className="text-sm font-medium text-muted">via {p.manualMethod ? `${p.manualMethod.code} (${p.manualMethod.recipientNumber})` : p.provider}</span></p>
                <p className="break-all">{p.manualMethod?.kind === "crypto" ? "Transaction hash" : "Reference"}: <span className="font-mono font-bold">{p.providerRef}</span> {p.payerPhone && <>· from {formatPhone(p.payerPhone)}</>}</p>
                {p.manualMethod?.kind === "crypto" && p.providerRef && explorer(p.manualMethod.network, p.providerRef) && (
                  <a href={explorer(p.manualMethod.network, p.providerRef)!} target="_blank" rel="noreferrer" className="font-semibold text-primary">Check on the blockchain ({p.manualMethod.network}) ↗</a>
                )}
                <p className="text-muted">
                  <Link href={`/admin/customers/${p.user.id}`} className="text-primary">{p.user.name}</Link> ({p.user.email}) · account {ageDays} day(s) old
                </p>
                <p className="text-muted">{p.order ? <>For order <Link className="text-primary" href={`/admin/orders/${p.orderId}`}>#{p.order.number}</Link></> : "Wallet deposit"} · submitted {p.createdAt.toLocaleString("en-US")}</p>
                {p.evidencePath && <a href={`/api/admin/evidence/${p.id}`} target="_blank" className="font-semibold text-primary">View screenshot ↗</a>}
                {!p.orderId && (p.currency === "USD" ? Math.round(p.amount * settings.htgPerUsd) : p.amount) >= Math.round(settings.holdThresholdUsd * settings.htgPerUsd) && <p className="text-warning">Above hold threshold: funds will be held {settings.holdHours}h after approval.</p>}
              </div>
              <div className="flex gap-2">
                <ActionButton label="Approve" className="btn-primary min-h-9 px-4 text-xs" confirm={`Approve ${formatMoney(p.amount, p.currency, "en")} for ${p.user.name}? Only approve if the money is really there (statement or blockchain).`} action={approvePayment.bind(null, p.id)} />
                <ActionButton label="Reject…" className="btn-danger min-h-9 px-4 text-xs" prompt="Reason shown to the customer" action={rejectPaymentAction.bind(null, p.id)} />
              </div>
            </div>
          );
        })}
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Recent payments</h2>
      <Table head={["Customer", "Provider", "Amount", "Reference", "Status", "Reviewed by", "Updated"]} empty={recent.length === 0}>
        {recent.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3">{p.user.name}</td>
            <td className="px-4 py-3">{label(METHOD, p.provider)}</td>
            <td className="px-4 py-3">{formatMoney(p.amount, p.currency, "en")}</td>
            <td className="px-4 py-3 font-mono text-xs">{p.providerRef ?? "—"}</td>
            <td className="px-4 py-3"><StatusBadge status={p.status} label={label(PAYMENT_STATUS, p.status)} /></td>
            <td className="px-4 py-3">{p.reviewedBy?.name ?? (p.provider === "MONCASH" ? "Automatic" : "—")}</td>
            <td className="px-4 py-3 text-muted">{p.updatedAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

import { siteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { itemTitle, revealCode } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { t } from "@/lib/text";
import { refreshItems } from "@/lib/suppliers/dispatch";
import { allServiceStats } from "@/lib/service-stats";
import { durationParts } from "@/lib/duration";
import { CopyButton } from "@/components/CopyButton";
import { NatcashOrderForm, MoncashRetryButton } from "@/components/OrderPayment";
import { BackIcon, WhatsAppIcon } from "@/components/Icons";
import { PushToggle } from "@/components/PushToggle";
import { ReviewRequest } from "@/components/ReviewRequest";
import { formatPhone } from "@/lib/phone";
import { displayValue, type FieldDef } from "@/lib/order-form";

/** The customer's own answers: passwords masked, files named, removed ones skipped. */
function customerAnswers(values: Record<string, string>, defs: FieldDef[], locale: string) {
  return Object.entries(values).filter(([, v]) => v !== "(removed)").map(([k, v]) => {
    const d = defs.find((x) => x.key === k);
    const shown = v.startsWith("enc:") ? "••••••" : d?.type === "file" ? "📎" : displayValue(d, v);
    return d ? `${t(d.label, locale)}: ${shown}` : shown;
  });
}

const CHIP = {
  green: "bg-[#e4f3ea] text-[#145c39]",
  blue: "bg-[#dcebfa] text-[#154a80]",
  orange: "bg-[#fcebdd] text-[#8a3607]",
  gray: "bg-surface-2 text-muted",
};

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const where = { id, userId: user.id };
  const exists = await prisma.order.findFirst({ where, select: { items: { select: { id: true } } } });
  if (!exists) notFound();
  // Opening the order asks the supplier for news on lines whose check is due.
  await refreshItems(exists.items.map((i) => i.id)).catch(() => {});
  const order = await prisma.order.findFirst({
    where,
    include: {
      items: {
        include: {
          codes: true,
          supplierOrders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, status: true } },
          variant: { include: { product: { select: { id: true, slug: true, serviceType: true, deliveryEstimate: true, name: true, fields: true, instructions: true } } } },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      review: { select: { id: true } },
    },
  });
  if (!order) notFound();
  const [g, to, tc, fmt, settings, ts, stats] = await Promise.all([
    getTranslations("gl.order"), getTranslations("order"), getTranslations("common"), getFormatter(), getSettings(), getTranslations("support"), allServiceStats(),
  ]);
  const tt = await getTranslations("gl.time");

  const manual = order.manualMethodId ? await prisma.manualMethod.findUnique({ where: { id: order.manualMethodId } }) : null;
  const codes = order.items.flatMap((i) => i.codes);
  if (codes.length > 0) await audit(user.id, "code.view.customer", "Order", order.id, { codes: codes.length });

  const statusUrl = `${siteUrl()}/${locale}/order-status/${order.id}?t=${order.accessToken}`;
  const helpText = encodeURIComponent(`${tc("whatsappMessage")} ${to("title", { number: order.number })} ${statusUrl}`);
  const lastPayment = order.payments[0];
  const when = (d: Date) => fmt.dateTime(d, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const done = order.items.filter((i) => i.status === "DELIVERED").length;
  const refunded = order.items.filter((i) => i.status === "FAILED").length;
  const working = order.items.length - done - refunded;
  const head =
    order.status === "AWAITING_PAYMENT" ? { label: g("awaiting"), cls: CHIP.orange }
    : order.status === "PAYMENT_REVIEW" ? { label: g("review"), cls: CHIP.blue }
    : order.status === "REFUNDED" || order.status === "CANCELED" ? { label: to(`status.${order.status}`), cls: CHIP.orange }
    : working > 0 ? { label: g("inProgress"), cls: CHIP.blue }
    : refunded > 0 && done > 0 ? { label: g("partly"), cls: CHIP.green }
    : { label: g("done"), cls: CHIP.green };
  const services = [...new Set(order.items.map((i) => t(i.productName, locale)))];
  const phones = order.items.filter((i) => i.identifier).length;
  const method =
    order.paymentMethod === "MANUAL" && manual ? t(manual.name, locale)
    : order.paymentMethod === "WALLET" ? g("byWallet")
    : order.paymentMethod === "CARD" ? g("byCard")
    : order.paymentMethod === "MONCASH" ? "MonCash" : "NatCash";
  const usual = (productId: string, estimate: unknown) => {
    const m = stats[productId]?.medianMinutes;
    if (m != null) {
      const d = durationParts(m);
      return tt(d.key, { n: d.n });
    }
    return t(estimate, locale);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/account/orders" className="-ml-2 inline-flex min-h-11 items-center gap-1 text-[13px] text-muted hover:text-text"><BackIcon width={20} height={20} /> {tc("orders")}</Link>
        <div className="flex items-center justify-between gap-2">
          <h1 className="display text-[28px] tracking-tight">{to("title", { number: order.number })}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${head.cls}`}>{head.label}</span>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          {services.slice(0, 2).join(", ")}{phones > 1 ? ` · ${g("phones", { n: phones })}` : ""} · {order.paidAt ? g("paidWith", { method }) : g("payWith", { method })}
        </p>
        {order.items.length > 1 && ["PAID", "PROCESSING", "FULFILLED", "REFUNDED"].includes(order.status) && (
          <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#e4f3ea] px-1 py-2.5"><b className="block text-xl text-[#145c39]">{done}</b><span className="text-xs text-[#24302a]">{g("countDone")}</span></div>
            <div className="rounded-xl bg-[#dcebfa] px-1 py-2.5"><b className="block text-xl text-[#154a80]">{working}</b><span className="text-xs text-[#1d2b3a]">{g("countWorking")}</span></div>
            <div className="rounded-xl bg-[#fcebdd] px-1 py-2.5"><b className="block text-xl text-[#8a3607]">{refunded}</b><span className="text-xs text-[#3a2414]">{g("countRefunded")}</span></div>
          </div>
        )}
      </div>

      {order.status === "FULFILLED" && !order.review && <ReviewRequest orderId={order.id} city={(await prisma.user.findUnique({ where: { id: user.id }, select: { city: true } }))?.city ?? ""} />}

      {order.status === "AWAITING_PAYMENT" && order.paymentMethod === "MANUAL" && manual && (
        <section className="card border-warning p-5">
          <h2 className="font-semibold">{t(manual.name, locale)}</h2>
          {t(manual.instructions, locale) && <p className="mt-1 whitespace-pre-line text-sm">{t(manual.instructions, locale)}</p>}
          <p className="mt-1 text-sm text-muted">
            {to("payNatcashBody", { amount: formatMoney(order.total, order.currency, locale), name: manual.recipientName, phone: manual.kind === "crypto" ? manual.recipientNumber : formatPhone(manual.recipientNumber) }).replace("NatCash", t(manual.name, locale))}
          </p>
          {lastPayment?.status === "REJECTED" && lastPayment.reviewNote && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{lastPayment.reviewNote}</p>}
          <NatcashOrderForm orderId={order.id} phone={manual.recipientNumber} methodName={t(manual.name, locale)} />
        </section>
      )}
      {order.status === "AWAITING_PAYMENT" && order.paymentMethod === "NATCASH" && (
        <section className="card border-warning p-5">
          <h2 className="font-semibold">{to("payNatcashTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{to("payNatcashBody", { amount: formatMoney(order.total, "HTG", locale), name: settings.natcashRecipientName, phone: formatPhone(settings.natcashRecipientPhone) })}</p>
          {lastPayment?.status === "REJECTED" && lastPayment.reviewNote && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{lastPayment.reviewNote}</p>}
          <NatcashOrderForm orderId={order.id} phone={settings.natcashRecipientPhone} />
        </section>
      )}
      {order.status === "AWAITING_PAYMENT" && order.paymentMethod === "MONCASH" && <section className="card p-5"><MoncashRetryButton orderId={order.id} /></section>}
      {order.status === "PAYMENT_REVIEW" && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">{to("proofSubmitted")} {to("reviewTime", { hours: settings.supportHours })}</p>
      )}

      <section aria-label={g("lines")} className="space-y-3">
        {order.items.map((item) => {
          const product = item.variant.product;
          const chip = item.status === "DELIVERED" ? { l: g("itemDone"), c: CHIP.green }
            : item.status === "FAILED" ? { l: g("itemRefunded"), c: CHIP.orange }
            : order.paidAt ? { l: g("itemWorking"), c: CHIP.blue } : { l: g("itemWaiting"), c: CHIP.gray };
          const sent = item.supplierOrders[0]?.createdAt ?? (order.paidAt && item.status === "PENDING" ? order.paidAt : null);
          return (
            <article key={item.id} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  {item.identifier ? <span className="break-all font-mono text-[15px]">{item.identifier}</span> : <b className="text-[15px]">{itemTitle(item, locale)}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</b>}
                  {item.identifier && order.items.some((x) => x.variantId !== item.variantId) && <span className="block text-xs text-muted">{itemTitle(item, locale)}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${chip.c}`}>{chip.l}</span>
              </div>
              {Object.keys(item.fieldValues as object).length > 0 && (
                <p className="text-sm text-muted">{customerAnswers(item.fieldValues as Record<string, string>, item.variant.product.fields as FieldDef[], locale).join(" · ")}</p>
              )}

              {item.codes.length > 0 && (
                <ul className="space-y-2 rounded-xl bg-bg p-3">
                  {item.codes.map((c) => {
                    const code = revealCode(c.codeEncrypted);
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3">
                        <code className="break-all font-mono text-sm font-semibold">{code}</code>
                        <CopyButton value={code} label={to("copy")} done={to("copied")} />
                      </li>
                    );
                  })}
                </ul>
              )}

              {item.status === "DELIVERED" && item.deliveryNote && (
                <>
                  <div className="rounded-xl bg-bg p-3 text-sm leading-relaxed">
                    <b className="mb-1 block">{g("result")}</b>
                    <span className="whitespace-pre-line">{item.deliveryNote}</span>
                  </div>
                  <span className="self-start"><CopyButton value={item.deliveryNote} label={g("copyResult")} done={to("copied")} /></span>
                </>
              )}

              {item.status === "PENDING" && order.paidAt && (
                <>
                  <ol className="flex flex-col">
                    {[
                      { b: g("stepPaid"), s: when(order.paidAt), state: "done" },
                      { b: g("stepSent"), s: sent ? when(sent) : "", state: sent ? "done" : "now" },
                      { b: g("stepProcessing"), s: usual(product.id, product.deliveryEstimate) ? g("usually", { time: usual(product.id, product.deliveryEstimate) }) : "", state: sent ? "now" : "next" },
                      { b: g("stepReady"), s: "", state: "next" },
                    ].map((st, i, all) => (
                      <li key={st.b} className="flex items-start gap-2.5">
                        <span className="flex flex-col items-center">
                          <span className={`mt-1 h-3 w-3 rounded-full ${st.state === "done" ? "bg-primary" : st.state === "now" ? "border-[3px] border-[#2266aa] bg-surface" : "bg-border"}`} />
                          {i < all.length - 1 && <span className={`h-6 w-0.5 ${st.state === "done" ? "bg-primary" : "bg-border"}`} />}
                        </span>
                        <span className={`text-sm ${st.state === "next" ? "text-muted" : ""}`}><b className={st.state === "next" ? "font-normal" : ""}>{st.b}</b>{st.s && <span className="text-muted"> · {st.s}</span>}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="whitespace-pre-line text-xs text-muted">{t(product.instructions, locale) || (product.serviceType === "REMOTE" ? g("remoteKeepOpen") : g("checkNote"))}</p>
                </>
              )}

              {item.status === "FAILED" && (
                <>
                  <div className="rounded-xl bg-[#fcebdd] p-3 text-sm leading-relaxed text-[#3a2414]">
                    <b className="mb-1 block">{item.deliveryNote ? g("notPossible", { reason: item.deliveryNote }) : g("notPossibleNoReason")}</b>
                    {g("refundBack", { amount: formatMoney(item.unitPrice * item.quantity, order.currency, locale) })}
                  </div>
                  {product.serviceType === "IMEI" && <Link href="/check" className="text-sm font-semibold text-primary">{g("checkFirstNext")}</Link>}
                </>
              )}

              {item.status !== "PENDING" && (
                <Link href={`/products/${product.slug}`} className="self-start text-sm font-semibold text-primary">{to("buyAgain")} →</Link>
              )}
            </article>
          );
        })}
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="text-sm text-muted">{to("total")}</span>
        <b className="text-lg tabular-nums">{formatMoney(order.total, order.currency, locale)}</b>
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="rounded-2xl border border-border bg-surface p-3"><PushToggle /></div>
        <a href={`https://wa.me/${settings.whatsappNumber}?text=${helpText}`} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-border bg-surface font-semibold">
          <WhatsAppIcon width={18} height={18} className="text-[#1fa855]" /> {g("help")}
        </a>
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <CopyButton value={statusUrl} label={to("shareStatus")} done={to("copied")} />
          <Link href={`/account/support?order=${order.id}`} className="btn-ghost min-h-10">{ts("new")}</Link>
        </div>
      </section>

      <details className="rounded-2xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">{to("timeline")}</summary>
        <ol className="relative mt-3 space-y-3 border-l border-border pl-5">
          {order.events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
              <p className="text-sm font-medium">{to(`status.${e.status}`)}</p>
              <p className="text-xs text-muted">{fmt.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

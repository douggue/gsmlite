"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { linePrice, useStore } from "./CartProvider";

/**
 * Cart and checkout layout (inspired by Zoom's cart): the steps and the editable part on a white side,
 * the order summary on a grey side with today's total and one big button. Stacks on phones.
 */
export function CheckoutShell({ step, title, children, summary }: { step: "cart" | "checkout"; title: string; children: React.ReactNode; summary: React.ReactNode }) {
  const tc = useTranslations("cart");
  return (
    <div className="lg:grid lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[minmax(0,1fr)_minmax(380px,40%)]">
      <div className="bg-surface px-4 pb-8 pt-6 sm:px-6 lg:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pb-16 lg:pt-10 lg:pr-12">
        <div className="max-w-2xl">
          <Link href="/store" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
            <span aria-hidden className="rtl:-scale-x-100">‹</span> {tc("browseMore")}
          </Link>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <h1 className="display text-[30px] font-bold tracking-tight sm:text-4xl">{title}</h1>
            <ol className="flex items-center gap-2 pb-1.5 text-sm font-semibold" aria-label={tc("stepCart") + " › " + tc("stepCheckout")}>
              <li aria-current={step === "cart" ? "step" : undefined}>
                {step === "cart" ? <span>{tc("stepCart")}</span> : <Link href="/cart" className="text-muted hover:text-primary">{tc("stepCart")}</Link>}
              </li>
              <li aria-hidden className="text-muted rtl:-scale-x-100">›</li>
              <li aria-current={step === "checkout" ? "step" : undefined} className={step === "checkout" ? "" : "text-muted"}>{tc("stepCheckout")}</li>
            </ol>
          </div>
          <div className="mt-6 space-y-5">{children}</div>
        </div>
      </div>
      <aside className="border-t border-border bg-surface-2 px-4 py-6 sm:px-6 lg:border-l lg:border-t-0 lg:px-10 lg:py-10">
        <div className="lg:sticky lg:top-24 lg:max-w-md">{summary}</div>
      </aside>
    </div>
  );
}

/** Grey summary panel: items, total, today's total, the action button and a refund reminder. */
export function OrderSummary({ currency, button, extra }: { currency: "HTG" | "USD"; button: React.ReactNode; extra?: React.ReactNode }) {
  const tc = useTranslations("cart");
  const locale = useLocale();
  const store = useStore();
  const fmt = (n: number) => formatMoney(n, currency, locale);
  const total = store.lines.reduce((s, l) => s + linePrice(l, currency, store.htgPerUsd) * l.quantity, 0);
  const count = store.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <section aria-labelledby="sum">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sum" className="display text-2xl font-bold">{tc("orderSummary")}</h2>
        <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-semibold">{currency}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{tc("itemsCount", { n: count })}</p>
      <ul className="mt-5 divide-y divide-border border-y border-border">
        {store.lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-4 py-3.5 text-sm">
            <span className="min-w-0">
              <b className="block" dir="auto">{t(l.productName, locale)}</b>
              <span className="block text-muted">{t(l.variantName, locale)}</span>
              <span className="block text-muted">{l.identifiers?.length ? tc("imeis", { n: l.identifiers.length }) : `× ${l.quantity}`} · {tc("each", { price: fmt(linePrice(l, currency, store.htgPerUsd)) })}</span>
            </span>
            <b className="shrink-0 tabular-nums">{fmt(linePrice(l, currency, store.htgPerUsd) * l.quantity)}</b>
          </li>
        ))}
      </ul>
      {extra}
      <div className="mt-6 flex items-end justify-between gap-3 border-t border-border pt-5">
        <b className="text-lg">{tc("todaysTotal")}</b>
        <b className="display text-2xl tabular-nums">{fmt(total)}</b>
      </div>
      <div className="mt-4">{button}</div>
      <p className="mt-3 text-center text-xs text-muted">{tc("refundNote")}</p>
    </section>
  );
}

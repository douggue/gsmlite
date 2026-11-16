"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { t } from "@/lib/text";
import { formatMoney } from "@/lib/money";
import { linePrice, useStore } from "./CartProvider";
import { ProductArtSmall } from "./ProductArtSmall";
import { CheckoutShell, OrderSummary } from "./CheckoutShell";

export type Upsell = { slug: string; name: string; sub: string; priceUsd: number };

/** Cart (Zoom-style): one card per service with its IMEIs or quantity, a suggestion below, the summary on the side. */
export function CartView({ upsell }: { upsell?: Upsell | null }) {
  const tc = useTranslations("cart");
  const locale = useLocale();
  const store = useStore();
  const { lines, ready, setQuantity, remove, currency, htgPerUsd } = store;
  const fmt = (usd: number) => formatMoney(linePrice({ priceUsd: usd }, currency, htgPerUsd), currency, locale);

  if (!ready) return <p className="container-page py-12 text-muted">…</p>;
  if (lines.length === 0)
    return (
      <div className="container-page py-12">
        <div className="card mx-auto max-w-md p-10 text-center">
          <h1 className="text-xl font-bold">{tc("title")}</h1>
          <p className="mt-2 text-muted">{tc("empty")}</p>
          <Link href="/store" className="btn-primary mt-6">{tc("emptyCta")}</Link>
        </div>
      </div>
    );

  const showUpsell = upsell && !lines.some((l) => l.productSlug === upsell.slug) && lines.some((l) => l.identifiers?.length);

  return (
    <CheckoutShell
      step="cart"
      title={tc("title")}
      summary={<OrderSummary currency={currency} button={<Link href="/checkout" className="btn-primary min-h-12 w-full text-base">{tc("continue")}</Link>} />}
    >
      {lines.map((l) => (
        <article key={l.key} className="rounded-2xl border border-border bg-surface p-4 shadow-[0_8px_30px_rgba(15,27,61,0.08)] sm:p-5">
          <div className="flex items-start gap-3.5">
            <ProductArtSmall name={t(l.productName, locale)} accent={l.accent} image={l.image} />
            <div className="min-w-0 flex-1">
              <Link href={`/products/${l.productSlug}`} className="font-semibold leading-snug hover:text-primary" dir="auto">{t(l.productName, locale)}</Link>
              <p className="text-sm text-muted">{t(l.variantName, locale)} · {tc("each", { price: fmt(l.priceUsd) })}</p>
            </div>
            <button type="button" onClick={() => remove(l.key)} className="min-h-11 shrink-0 px-1 text-sm font-semibold text-danger hover:underline">{tc("remove")}</button>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            {l.identifiers?.length ? (
              <>
                <p className="text-sm font-semibold">{tc("imeis", { n: l.identifiers.length })}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {l.identifiers.map((id) => <li key={id} className="rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-[13px]">{id}</li>)}
                </ul>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-border">
                  <button type="button" className="h-11 w-11 text-lg" onClick={() => setQuantity(l.key, l.quantity - 1)} aria-label="−">−</button>
                  <span className="min-w-10 text-center font-semibold tabular-nums">{l.quantity}</span>
                  <button type="button" className="h-11 w-11 text-lg" onClick={() => setQuantity(l.key, l.quantity + 1)} aria-label="+">+</button>
                </div>
              </div>
            )}
            {Object.values(l.fields).length > 0 && <p className="mt-2 truncate text-sm text-muted">{Object.values(l.fields).join(" · ")}</p>}
            <p className="mt-3 text-right font-bold tabular-nums">{fmt(l.priceUsd * l.quantity)}</p>
          </div>
        </article>
      ))}

      {showUpsell && (
        <section className="border-t border-border pt-6">
          <h2 className="display text-xl font-bold">{tc("addToOrder")}</h2>
          <p className="mt-1 text-sm text-muted">{tc("addToOrderSub")}</p>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e0f5f9] text-xs font-bold text-[#0e7490]">IMEI</span>
            <span className="min-w-0 flex-1"><b className="block text-sm" dir="auto">{upsell.name}</b><span className="text-xs text-muted">{upsell.sub} · {fmt(upsell.priceUsd)}</span></span>
            <Link href={`/products/${upsell.slug}?ids=${lines.flatMap((l) => l.identifiers ?? []).join(",")}`} className="inline-flex min-h-10 items-center rounded-full border-[1.5px] border-primary px-4 text-sm font-semibold text-primary hover:bg-primary-soft">{tc("add")}</Link>
          </div>
        </section>
      )}
    </CheckoutShell>
  );
}

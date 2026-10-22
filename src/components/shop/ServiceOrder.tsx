"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { t } from "@/lib/text";
import type { FieldDef } from "@/lib/orders";
import { identifierProblem, parseIdentifiers, type IdentifierFormat } from "@/lib/imei";
import { formatMoney, priceIn } from "@/lib/money";
import { placeOrder } from "@/actions/checkout";
import { useStore } from "../cart/CartProvider";
import { CheckIcon, XIcon } from "../Icons";

export type OrderVariant = {
  id: string;
  name: Record<string, string>;
  listUsd: number;
  priceUsd: number;
  minQty: number;
  maxQty: number;
  inStock: boolean;
  lowStock?: boolean;
};
export type OrderMethod = { id: string; name: string; hint: string; currency: "HTG" | "USD" };

type Props = {
  product: {
    id: string;
    slug: string;
    name: Record<string, string>;
    accent: string | null;
    image: string | null;
    serviceType: "IMEI" | "SERVER" | "REMOTE";
    identifierLabel: Record<string, string> | null;
    identifierFormat: IdentifierFormat;
    allowBulk: boolean;
    fields: FieldDef[];
    variants: OrderVariant[];
  };
  saved: { id: string; label: string | null; values: Record<string, string> }[];
  methods: OrderMethod[];
  signedIn: boolean;
  balances: { HTG: number; USD: number } | null;
  /** Show the total in gourdes too (an HTG way to pay is offered to this shopper) */
  showHtg: boolean;
};

const DRAFT_KEY = "gl_order_draft";
type Draft = { slug: string; variantId?: string; idText: string; fields: Record<string, string>; qty: number; method: string };

/**
 * Service order card (mockup "Service"): option, IMEIs checked as you type, the service's fields, how to pay,
 * a summary, then one button. Signed-out visitors fill everything in; it is kept while they sign in.
 */
export function ServiceOrder({ product, saved, methods, signedIn, balances, showHtg }: Props) {
  const g = useTranslations("gl.service");
  const tc = useTranslations("checkout");
  const locale = useLocale();
  const router = useRouter();
  const store = useStore();
  const firstAvailable = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const variant = product.variants.find((v) => v.id === variantId);
  const [qty, setQty] = useState(variant?.minQty ?? 1);
  const [idText, setIdText] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(saved[0]?.values ?? {});
  const [method, setMethod] = useState(signedIn && balances ? "WALLET" : methods[0]?.id ?? "WALLET");
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonVisible, setButtonVisible] = useState(true);

  const isImei = product.serviceType === "IMEI";
  const isServer = product.serviceType === "SERVER";
  const idLabel = t(product.identifierLabel, locale) || "IMEI";
  const ids = useMemo(() => parseIdentifiers(idText, product.identifierFormat), [idText, product.identifierFormat]);
  const units = isImei ? ids.valid.length : qty;
  const min = variant?.minQty ?? 1;
  const max = Math.max(min, variant?.maxQty ?? 1);

  // Money: wallet pays in the shown currency; other methods in their own currency.
  const payCurrency: "HTG" | "USD" = method === "WALLET" ? store.currency : methods.find((m) => m.id === method)?.currency ?? store.currency;
  const unit = variant ? priceIn(variant.priceUsd, payCurrency, store.htgPerUsd) : 0;
  const total = unit * Math.max(1, units);
  const fmt = (n: number, c: "HTG" | "USD") => formatMoney(n, c, locale);
  const walletShort = method === "WALLET" && balances ? balances[payCurrency] < total : false;

  // Coming back from sign-in: put back what was typed.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (d.slug !== product.slug) return;
      sessionStorage.removeItem(DRAFT_KEY);
      if (d.variantId && product.variants.some((v) => v.id === d.variantId)) setVariantId(d.variantId);
      setIdText(d.idText ?? "");
      setFields(d.fields ?? {});
      setQty(d.qty ?? 1);
      if (d.method) setMethod(d.method);
    } catch {}
  }, [product.slug, product.variants]);

  // Phones: a bar with the total and "Order" while the card's own button is off screen.
  useEffect(() => {
    const el = buttonRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setButtonVisible(e.isIntersecting || e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function check(): boolean {
    setError("");
    if (!variant || !variant.inStock) return false;
    if (isImei) {
      if (ids.valid.length === 0) {
        setError(g("imeiMissing", { label: idLabel }));
        document.getElementById("identifiers")?.focus();
        return false;
      }
      if (ids.valid.length > 1 && !product.allowBulk) {
        setError(g("imeiOneOnly", { label: idLabel }));
        return false;
      }
    }
    for (const f of product.fields) {
      if (f.required && !fields[f.key]?.trim()) {
        setError(g("fieldMissing", { field: t(f.label, locale) }));
        document.getElementById(`field-${f.key}`)?.focus();
        return false;
      }
    }
    return true;
  }

  const cleanFields = () => Object.fromEntries(product.fields.map((f) => [f.key, (fields[f.key] ?? "").trim()]).filter(([, v]) => v));

  function addToCart() {
    if (!check() || !variant) return;
    store.add({
      variantId: variant.id,
      productSlug: product.slug,
      productName: product.name,
      variantName: variant.name,
      accent: product.accent,
      image: product.image,
      priceUsd: variant.priceUsd,
      quantity: units,
      fields: cleanFields(),
      ...(isImei ? { identifiers: ids.valid } : {}),
      ...(isServer ? { minQty: min, maxQty: max } : {}),
    });
    if (isImei) setIdText("");
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function orderNow() {
    if (!check() || !variant) return;
    if (!signedIn) {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ slug: product.slug, variantId, idText, fields, qty, method } satisfies Draft));
      } catch {}
      router.push(`/auth/login?next=${encodeURIComponent(`/products/${product.slug}#order`)}`);
      return;
    }
    start(async () => {
      const res = await placeOrder({
        items: [{ variantId: variant.id, quantity: units, fields: cleanFields(), ...(isImei ? { identifiers: ids.valid } : {}) }],
        currency: payCurrency,
        method: method.startsWith("MANUAL:") ? "MANUAL" : method,
        manualMethodId: method.startsWith("MANUAL:") ? method.slice(7) : undefined,
      });
      if (!res.ok) {
        if (res.error === "signin") return router.push(`/auth/login?next=${encodeURIComponent(`/products/${product.slug}#order`)}`);
        setError(tc.has(`errors.${res.error}`) ? tc(`errors.${res.error}`) : tc("errors.generic"));
        return;
      }
      if (res.redirect) window.location.href = res.redirect;
      else router.push(`/account/orders/${res.orderId}`);
    });
  }

  const label = isImei && units > 1 ? g("orderFor", { n: units }) : g("orderNow");
  const problem = (id: string) => {
    const p = identifierProblem(id, product.identifierFormat);
    return p.key === "len" ? g("bad.len", { n: p.n }) : g(`bad.${p.key}`);
  };

  return (
    <div id="order" className="scroll-mt-24 space-y-4">
      {product.variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{g("option")}</legend>
          <div className="space-y-2">
            {product.variants.map((v) => {
              const active = v.id === variantId;
              const [title, ...rest] = t(v.name, locale).split("·");
              return (
                <label key={v.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] bg-surface p-3.5 ${active ? "border-2 border-[#111418] dark:border-primary" : "border border-border"} ${!v.inStock ? "cursor-not-allowed opacity-60" : ""}`}>
                  <input type="radio" name="variant" checked={active} disabled={!v.inStock} onChange={() => { setVariantId(v.id); setQty(v.minQty); }} className="h-5 w-5 accent-[#111418] dark:accent-[var(--primary)]" />
                  <span className="min-w-0 flex-1">
                    <b className={`block text-[15px] ${!v.inStock ? "line-through" : ""}`}>{title.trim()}</b>
                    {rest.length > 0 && <span className="text-xs text-muted">{rest.join("·").trim()}</span>}
                    {!v.inStock && <span className="text-xs text-danger"> {g("soldOut")}</span>}
                  </span>
                  <span className="text-right">
                    <b className="text-[15px] tabular-nums">{fmt(priceIn(v.priceUsd, store.currency, store.htgPerUsd), store.currency)}</b>
                    {v.priceUsd < v.listUsd && <span className="block text-xs text-muted line-through">{fmt(priceIn(v.listUsd, store.currency, store.htgPerUsd), store.currency)}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          {variant?.inStock && variant.lowStock && <p role="status" className="mt-2 text-sm font-semibold text-warning">{g("lowStock")}</p>}
        </fieldset>
      )}

      {isImei && (
        <div>
          <label htmlFor="identifiers" className="block text-sm font-semibold">
            {idLabel}{product.allowBulk && <span className="font-normal text-muted"> · {g("onePerLine")}</span>}
          </label>
          <textarea
            id="identifiers"
            rows={product.allowBulk ? 3 : 1}
            inputMode={product.identifierFormat === "imei" ? "numeric" : "text"}
            autoComplete="off"
            spellCheck={false}
            value={idText}
            onChange={(e) => setIdText(e.target.value.slice(0, 2400))}
            aria-describedby="identifiers-help"
            className="mt-2 w-full resize-y rounded-xl border-[1.5px] border-[#111418] bg-white px-3.5 py-3 font-mono text-base leading-relaxed text-[#111418] focus:outline-none focus:ring-2 focus:ring-primary dark:border-border dark:bg-surface dark:text-text"
          />
          {(ids.valid.length > 0 || ids.invalid.length > 0) && (
            <ul className="mt-2 space-y-1.5 text-[13px]" aria-live="polite">
              {ids.valid.map((id) => (
                <li key={id} className="flex items-center gap-2"><CheckIcon width={16} height={16} className="text-primary" /><span className="font-mono">{id}</span><span className="font-semibold text-primary">{g("valid")}</span></li>
              ))}
              {ids.invalid.map((id) => (
                <li key={id} className="flex items-center gap-2"><XIcon width={16} height={16} className="shrink-0 text-[#b4480a]" /><span className="font-mono">{id}</span><span className="font-semibold text-[#b4480a]">{problem(id)}</span></li>
              ))}
            </ul>
          )}
          <p id="identifiers-help" className="mt-2 text-xs text-muted">{g.rich("imeiHelp", { mono: (c) => <span className="font-mono">{c}</span> })}</p>
        </div>
      )}

      {product.fields.length > 0 && (
        <fieldset className="space-y-3.5">
          <legend className="sr-only">{g("details")}</legend>
          {saved.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <button key={s.id} type="button" className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold" onClick={() => setFields(s.values)}>
                  {s.label ?? Object.values(s.values)[0]}
                </button>
              ))}
            </div>
          )}
          {product.fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`field-${f.key}`} className="block text-sm font-semibold">
                {t(f.label, locale)} {f.required && <span className="text-danger">*</span>}
              </label>
              {f.type === "select" ? (
                <select id={`field-${f.key}`} className="input mt-1.5" value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={`field-${f.key}`} className="input mt-1.5 min-h-24 py-3" maxLength={1000} placeholder={f.placeholder} value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
              ) : (
                <input id={`field-${f.key}`} className="input mt-1.5" type={f.type === "number" ? "text" : f.type} inputMode={f.type === "number" ? "numeric" : undefined}
                  autoComplete="off" maxLength={200} placeholder={f.placeholder} value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
        </fieldset>
      )}

      {isServer && max > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold" htmlFor="qty">{g("quantity")}</label>
          <div className="flex items-center rounded-xl border border-border bg-surface">
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.max(min, qty - 1))} aria-label="−">−</button>
            <input id="qty" className="h-11 w-20 bg-transparent text-center font-semibold" inputMode="numeric" value={qty}
              onChange={(e) => setQty(Math.max(min, Math.min(max, Number(e.target.value.replace(/\D/g, "")) || min)))} />
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.min(max, qty + 1))} aria-label="+">+</button>
          </div>
          <span className="text-xs text-muted">{min}–{max}</span>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{g("payWith")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...(signedIn && balances ? [{ id: "WALLET", name: g("wallet"), hint: g("walletLeft", { amount: fmt(balances[store.currency], store.currency) }) }] : !signedIn ? [{ id: "WALLET", name: g("wallet"), hint: g("walletHint") }] : []),
            ...methods.map((m) => ({ id: m.id, name: m.name === "Card" ? g("card") : m.name, hint: g(`hint.${m.hint}`) }))].map((m) => {
            const on = method === m.id;
            return (
              <label key={m.id} className={`relative flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl px-2.5 py-3 ${on ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`}>
                <input type="radio" name="pay" className="absolute opacity-0" checked={on} onChange={() => setMethod(m.id)} />
                <b className="text-sm">{m.name}</b>
                <span className={`text-[11px] ${on ? "text-[#b9c0b6] dark:text-white/80" : "text-muted"}`}>{m.hint}</span>
              </label>
            );
          })}
        </div>
        {walletShort && (
          <p className="mt-2 text-sm text-danger">{g("insufficient")} <Link href="/account/wallet/deposit" className="font-semibold underline">{g("topUp")}</Link></p>
        )}
      </fieldset>

      {variant && (
        <div className="space-y-2 rounded-[14px] border border-border bg-surface p-3.5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted">{isImei ? g("phones", { n: Math.max(1, units), price: fmt(unit, payCurrency) }) : g("units", { n: Math.max(1, units), price: fmt(unit, payCurrency) })}</span>
            <span className="tabular-nums">{fmt(total, payCurrency)}</span>
          </div>
          {showHtg && payCurrency === "USD" && (
            <div className="flex justify-between gap-3"><span className="text-muted">{g("inGourdes")}</span><span className="tabular-nums">{fmt(priceIn(variant.priceUsd, "HTG", store.htgPerUsd) * Math.max(1, units), "HTG")}</span></div>
          )}
          <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold"><span>{g("total")}</span><span className="tabular-nums">{fmt(total, payCurrency)}</span></div>
        </div>
      )}

      {isImei && ids.invalid.length > 0 && (
        <p role="alert" className="rounded-[10px] bg-[#fcebdd] px-3 py-2.5 text-[13px] text-[#8a3607]">{g("leftOut", { n: ids.invalid.length })}</p>
      )}
      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

      <button ref={buttonRef} type="button" onClick={orderNow} disabled={!variant?.inStock || pending}
        className="min-h-[52px] w-full rounded-[14px] bg-primary text-[17px] font-semibold text-white disabled:opacity-60">
        {pending ? "…" : label}
      </button>
      {!signedIn && <p className="text-center text-xs text-muted">{g("signInToPay")}</p>}
      <button type="button" onClick={addToCart} disabled={!variant?.inStock} className="mx-auto block min-h-11 text-sm font-semibold text-primary">
        {added ? `✓ ${g("added")}` : g("addToCart")}
      </button>
      <p className="text-center text-xs text-muted">{g("notifyNote")}</p>
      <p className="sr-only" aria-live="polite">{added ? g("added") : ""}</p>

      {/* Phones: total + Order while the button above is off screen */}
      {!buttonVisible && variant?.inStock && (
        <div className="fixed inset-x-0 z-30 flex items-center gap-3 border-t border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}>
          <span className="flex-1 text-sm"><span className="block text-xs text-muted">{g("total")}</span><b className="tabular-nums">{fmt(total, payCurrency)}</b></span>
          <button type="button" onClick={() => document.getElementById("order")?.scrollIntoView({ behavior: "smooth" })} className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-white">{g("stickyOrder")}</button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { t } from "@/lib/text";
import type { FieldDef } from "@/lib/orders";
import { parseIdentifiers, type IdentifierFormat } from "@/lib/imei";
import { useStore } from "./cart/CartProvider";
import { Price } from "./Money";

type Variant = {
  id: string;
  name: Record<string, string>;
  /** List price and this customer's price (group price when signed in), USD cents */
  listUsd: number;
  priceUsd: number;
  minQty: number;
  maxQty: number;
  inStock: boolean;
  lowStock?: boolean;
};
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
    variants: Variant[];
  };
  saved: { id: string; label: string | null; values: Record<string, string> }[];
};

/** The order card on a service page: option, IMEIs or quantity, the service's own fields, then Order now / Add to cart. */
export function ProductPurchase({ product, saved }: Props) {
  const tp = useTranslations("product");
  const locale = useLocale();
  const router = useRouter();
  const { add } = useStore();
  const firstAvailable = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const variant = product.variants.find((v) => v.id === variantId);
  const [qty, setQty] = useState(variant?.minQty ?? 1);
  const [idText, setIdText] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(saved[0]?.values ?? {});
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  const isImei = product.serviceType === "IMEI";
  const isServer = product.serviceType === "SERVER";
  const idLabel = t(product.identifierLabel, locale) || "IMEI";
  const ids = useMemo(() => parseIdentifiers(idText, product.identifierFormat), [idText, product.identifierFormat]);
  const units = isImei ? ids.valid.length : qty;
  const min = variant?.minQty ?? 1;
  const max = Math.max(min, variant?.maxQty ?? 1);

  function submit(goToCheckout: boolean) {
    setError("");
    if (!variant || !variant.inStock) return;
    if (isImei) {
      if (ids.valid.length === 0) {
        setError(tp("imeiMissing", { label: idLabel }));
        document.getElementById("identifiers")?.focus();
        return;
      }
      if (ids.valid.length > 1 && !product.allowBulk) {
        setError(tp("imeiOneOnly", { label: idLabel }));
        return;
      }
    }
    for (const f of product.fields) {
      if (f.required && !fields[f.key]?.trim()) {
        setError(`${t(f.label, locale)} *`);
        document.getElementById(`field-${f.key}`)?.focus();
        return;
      }
    }
    add({
      variantId: variant.id,
      productSlug: product.slug,
      productName: product.name,
      variantName: variant.name,
      accent: product.accent,
      image: product.image,
      priceUsd: variant.priceUsd,
      quantity: units,
      fields: Object.fromEntries(product.fields.map((f) => [f.key, (fields[f.key] ?? "").trim()]).filter(([, v]) => v)),
      ...(isImei ? { identifiers: ids.valid } : {}),
      ...(isServer ? { minQty: min, maxQty: max } : {}),
    });
    if (isImei) setIdText("");
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    if (goToCheckout) router.push("/checkout");
  }

  return (
    <div className="mt-6 space-y-5">
      {product.variants.length > 1 && (
        <fieldset>
          <legend className="label">{tp("chooseOption")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {product.variants.map((v) => {
              const active = v.id === variantId;
              return (
                <label
                  key={v.id}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                    active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-steel"
                  } ${!v.inStock ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input type="radio" name="variant" value={v.id} checked={active} disabled={!v.inStock} onChange={() => { setVariantId(v.id); setQty(v.minQty); }} className="h-5 w-5 accent-[var(--primary)]" />
                  <span className={`flex-1 text-sm font-semibold ${!v.inStock ? "line-through decoration-danger" : ""}`}>{t(v.name, locale)}</span>
                  <span className="text-right text-sm">
                    <Price usd={v.priceUsd} className="font-bold" />
                    {v.priceUsd < v.listUsd && <Price usd={v.listUsd} className="ml-1.5 text-xs text-muted line-through" />}
                  </span>
                </label>
              );
            })}
          </div>
          {variant?.inStock && variant.lowStock && <p role="status" className="mt-2 text-sm font-semibold text-warning">{tp("lowStock")}</p>}
        </fieldset>
      )}

      {isImei && (
        <div>
          <label htmlFor="identifiers" className="label">
            {idLabel} <span className="text-danger">*</span>
            {product.allowBulk && <span className="font-normal text-muted"> · {tp("onePerLine")}</span>}
          </label>
          <textarea
            id="identifiers"
            className="input min-h-24 py-3 font-mono text-base"
            rows={product.allowBulk ? 3 : 1}
            inputMode={product.identifierFormat === "imei" ? "numeric" : "text"}
            autoComplete="off"
            spellCheck={false}
            value={idText}
            onChange={(e) => setIdText(e.target.value.slice(0, 2400))}
            aria-describedby="identifiers-help"
          />
          {(ids.valid.length > 0 || ids.invalid.length > 0) && (
            <ul className="mt-2 space-y-1 text-sm" aria-live="polite">
              {ids.valid.map((id) => <li key={id} className="font-mono text-success">✓ {id}</li>)}
              {ids.invalid.map((id) => (
                <li key={id} className="font-mono text-danger">✗ {id} <span className="font-sans">{tp(product.identifierFormat === "imei" ? "imeiInvalid" : "idInvalid")}</span></li>
              ))}
            </ul>
          )}
          <p id="identifiers-help" className="mt-1 text-xs text-muted">{tp("imeiHelp")}</p>
        </div>
      )}

      {product.fields.length > 0 && (
        <fieldset className="space-y-4">
          <legend className="sr-only">{tp("requiredInfo")}</legend>
          {saved.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <button key={s.id} type="button" className="badge border border-border bg-surface-2 px-3 py-1.5" onClick={() => setFields(s.values)}>
                  {s.label ?? Object.values(s.values)[0]}
                </button>
              ))}
            </div>
          )}
          {product.fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`field-${f.key}`} className="label">
                {t(f.label, locale)} {f.required && <span className="text-danger">*</span>}
              </label>
              {f.type === "select" ? (
                <select id={`field-${f.key}`} className="input" value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={`field-${f.key}`} className="input min-h-24 py-3" maxLength={1000} placeholder={f.placeholder} value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
              ) : (
                <input
                  id={`field-${f.key}`}
                  className="input"
                  type={f.type === "number" ? "text" : f.type}
                  inputMode={f.type === "number" ? "numeric" : undefined}
                  autoComplete="off"
                  maxLength={200}
                  placeholder={f.placeholder}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </fieldset>
      )}

      {isServer && max > 1 && (
        <div className="flex items-center gap-3">
          <label className="label mb-0" htmlFor="qty">{tp("quantity")}</label>
          <div className="flex items-center rounded-xl border border-border bg-surface">
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.max(min, qty - 1))} aria-label="−">−</button>
            <input
              id="qty"
              className="h-11 w-20 bg-transparent text-center font-semibold"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(Math.max(min, Math.min(max, Number(e.target.value.replace(/\D/g, "")) || min)))}
            />
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty(Math.min(max, qty + 1))} aria-label="+">+</button>
          </div>
          <span className="text-xs text-muted">{min}–{max}</span>
        </div>
      )}

      {variant && (
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-muted">{units > 1 ? `${units} × ` : ""}{tp("total")}</span>
          <Price usd={variant.priceUsd * Math.max(1, units)} className="text-xl font-bold" />
        </div>
      )}

      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-primary min-h-12" onClick={() => submit(true)} disabled={!variant?.inStock}>
          {tp("orderNow")}
        </button>
        <button type="button" className="btn-secondary min-h-12" onClick={() => submit(false)} disabled={!variant?.inStock}>
          {added ? `✓ ${tp("added")}` : tp("addToCart")}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{added ? tp("added") : ""}</p>
    </div>
  );
}

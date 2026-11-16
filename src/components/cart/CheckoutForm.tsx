"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { placeOrder } from "@/actions/checkout";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { linePrice, useStore } from "./CartProvider";
import { PayLogo } from "@/components/PayLogo";
import { CheckoutShell, OrderSummary } from "./CheckoutShell";

type Method = string; // "WALLET" | "MONCASH" | "NATCASH" | "MANUAL:<id>"
type Manual = { id: string; name: string; instructions: string; logo: string | null };

export function CheckoutForm({ balances, moncashEnabled, natcashEnabled, manualMethods = [], user }: { balances: { HTG: number; USD: number }; moncashEnabled: boolean; natcashEnabled: boolean; manualMethods?: Manual[]; user: { name: string; email: string } }) {
  const tc = useTranslations("checkout");
  const tcart = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const store = useStore();
  const [method, setMethod] = useState<Method>(moncashEnabled ? "MONCASH" : "WALLET");
  const [walletCurrency, setWalletCurrency] = useState<"HTG" | "USD">(store.currency);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const currency = method === "WALLET" ? walletCurrency : "HTG";
  const total = store.lines.reduce((s, l) => s + linePrice(l, currency, store.htgPerUsd) * l.quantity, 0);
  const insufficient = method === "WALLET" && balances[walletCurrency] < total;
  const fmt = (n: number, c: "HTG" | "USD") => formatMoney(n, c, locale);

  if (store.ready && store.lines.length === 0)
    return (
      <div className="card mx-auto my-12 max-w-md p-10 text-center">
        <p className="text-muted">{tcart("empty")}</p>
        <Link href="/store" className="btn-primary mt-6">{tcart("emptyCta")}</Link>
      </div>
    );

  function submit() {
    setError("");
    start(async () => {
      const res = await placeOrder({
        items: store.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, fields: l.fields, ...(l.identifiers?.length ? { identifiers: l.identifiers } : {}) })),
        currency,
        method: method.startsWith("MANUAL:") ? "MANUAL" : method,
        manualMethodId: method.startsWith("MANUAL:") ? method.slice(7) : undefined,
        note: note || undefined,
      });
      if (!res.ok) {
        if (res.error === "signin") return router.push("/auth/login?next=/checkout");
        if (res.kyc) {
          setError(res.kyc.message || tc("errors.kyc_required"));
          if (res.kyc.level) router.push(`/account/verification?level=${res.kyc.level}&next=/checkout`);
          return;
        }
        setError(tc.has(`errors.${res.error}`) ? tc(`errors.${res.error}`) : tc("errors.generic"));
        return;
      }
      store.clear();
      if (res.redirect) window.location.href = res.redirect;
      else router.push(`/account/orders/${res.orderId}`);
    });
  }

  const options: { id: Method; title: string; hint: string; enabled: boolean; badge: React.ReactNode }[] = [
    { id: "MONCASH", title: tc("moncash"), hint: tc("moncashHint"), enabled: moncashEnabled, badge: <PayLogo brand="moncash" height={24} /> },
    { id: "NATCASH", title: tc("natcash"), hint: tc("natcashHint"), enabled: natcashEnabled, badge: <PayLogo brand="natcash" height={24} /> },
    {
      id: "WALLET",
      title: tc("wallet"),
      hint: `${tc("walletBalance", { balance: fmt(balances.HTG, "HTG") })} · ${fmt(balances.USD, "USD")}`,
      enabled: true,
      badge: <span className="rounded-md bg-navy px-2 py-1 text-[11px] font-extrabold text-white">GL</span>,
    },
    ...manualMethods.map((m) => ({
      id: `MANUAL:${m.id}`,
      title: m.name,
      hint: m.instructions || tc("natcashHint"),
      enabled: true,
      // eslint-disable-next-line @next/next/no-img-element
      badge: m.logo ? <img src={m.logo} alt="" className="h-6 w-auto rounded" /> : <span className="rounded-md bg-steel px-2 py-1 text-[11px] font-extrabold text-white">{m.name.slice(0, 10)}</span>,
    })),
  ];

  const chosen = options.find((o) => o.id === method);
  const card = "rounded-2xl border border-border bg-surface p-4 shadow-[0_8px_30px_rgba(15,27,61,0.08)] sm:p-5";

  return (
    <CheckoutShell
      step="checkout"
      title={tc("title")}
      summary={
        <OrderSummary
          currency={currency}
          extra={error ? <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}
          button={
            <button type="button" className="btn-primary min-h-12 w-full text-base" onClick={submit} disabled={pending || insufficient || !store.ready}>
              {pending ? tc("placing") : tc("placeOrder")}
            </button>
          }
        />
      }
    >
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{tc("signedInAs")}</h2>
          <Link href="/auth/login?next=/checkout" className="text-sm font-semibold text-primary">{tc("otherAccount")}</Link>
        </div>
        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <b className="truncate">{user.name}</b>
          <span className="truncate text-muted">{user.email}</span>
        </div>
      </section>

      <fieldset className={card}>
        <legend className="float-left mb-3 w-full text-lg font-bold">{tc("paymentMethod")}</legend>
        <div className="clear-both grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {options.filter((o) => o.enabled).map((o) => (
            <label key={o.id}
              className={`relative flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center text-sm font-semibold ${method === o.id ? "border-primary bg-primary-soft/40 ring-2 ring-primary/20" : "border-border bg-surface hover:border-[#c7d7fb]"}`}>
              <input type="radio" name="method" className="sr-only" checked={method === o.id} onChange={() => setMethod(o.id)} />
              {o.badge}
              <span>{o.title}</span>
              {method === o.id && <span aria-hidden className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] text-white">✓</span>}
            </label>
          ))}
        </div>
        {chosen && <p className="mt-3 text-sm text-muted">{chosen.hint}</p>}

        {method === "WALLET" ? (
          <div className="mt-4">
            <span className="label">{tc("payIn")}</span>
            <div className="inline-flex rounded-xl border border-border bg-surface p-1">
              {(["HTG", "USD"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setWalletCurrency(c)} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${walletCurrency === c ? "bg-primary text-white" : ""}`}>
                  {c}
                </button>
              ))}
            </div>
            {insufficient && (
              <p className="mt-3 text-sm text-danger">
                {tc("errors.insufficient")} <Link href="/account/wallet/deposit" className="font-semibold underline">{tc("topUp")}</Link>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{tc("htgOnly")}</p>
        )}
      </fieldset>

      <section className={card}>
        <label htmlFor="note" className="text-lg font-bold">{tc("noteLabel")}</label>
        <input id="note" className="input mt-3" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
      </section>
    </CheckoutShell>
  );
}

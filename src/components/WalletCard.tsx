"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { PlusIcon, StoreIcon, SwapIcon, WalletIcon } from "./Icons";

type B = { available: number; held: number };

export function WalletCard({ balances, initial }: { balances: { HTG: B; USD: B }; initial: "HTG" | "USD" }) {
  const ta = useTranslations("account");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [cur, setCur] = useState<"HTG" | "USD">(initial);
  const b = balances[cur];
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(140deg,#1d4ed8_0%,#1e40af_50%,#172554_100%)] p-6 text-white shadow-[0_26px_50px_-24px_var(--glow)] sm:p-7">
      <div className="ds-hide pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-[#93c5fd]/15 blur-3xl" aria-hidden />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#e6eeff]"><WalletIcon width={18} height={18} /> {tc("wallet")}</span>
        <div className="inline-flex rounded-full bg-white/10 p-1 text-xs font-bold" role="tablist" aria-label={tc("currency")}>
          {(["HTG", "USD"] as const).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cur === c} onClick={() => setCur(c)} className={`min-h-8 rounded-full px-3 py-1 ${cur === c ? "bg-white text-[#172554]" : "text-white/85"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <p className="relative mt-6 text-xs font-bold uppercase tracking-widest text-[#e6eeff]">{ta("available")} · {cur}</p>
      <p className="relative text-4xl font-extrabold tracking-tight sm:text-5xl">{formatMoney(b.available, cur, locale)}</p>
      {b.held > 0 && <p className="relative mt-1 text-sm text-[#ffd48a]">{ta("held", { amount: formatMoney(b.held, cur, locale) })}</p>}
      <div className="relative mt-6 grid grid-cols-3 gap-2">
        {([["/account/wallet/deposit", PlusIcon, ta("deposit")], ["/account/wallet/exchange", SwapIcon, ta("exchange")], ["/store", StoreIcon, ta("shop")]] as const).map(([href, Icon, label]) => (
          <Link key={href} href={href} className="group flex flex-col items-center gap-1.5 text-xs font-bold">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-white/20 transition-colors group-hover:bg-white/30"><Icon /></span>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

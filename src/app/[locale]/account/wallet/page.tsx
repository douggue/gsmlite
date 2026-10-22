import { siteUrl } from "@/lib/site-url";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBalances } from "@/lib/ledger";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { shopperCountry } from "@/lib/prefs";
import { payMethodsFor } from "@/lib/pay-methods";
import { ensureReferralCode } from "@/lib/referrals";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { GiftIcon } from "@/components/Icons";

/** Wallet (mockup "Wallet"): both balances, bonus offer, the ways to add money this customer may use, invite link, history. */
export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const country = await shopperCountry(user);
  const [g, tw, to, fmt, balances, settings, entries, pending, methods, me] = await Promise.all([
    getTranslations("gl.wallet"),
    getTranslations("wallet"),
    getTranslations("order"),
    getFormatter(),
    getBalances(prisma, user.id),
    getSettings(),
    prisma.ledgerEntry.findMany({
      where: { account: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { transaction: true, account: { select: { type: true } } },
    }),
    prisma.paymentIntent.findMany({
      where: { userId: user.id, orderId: null, status: { in: ["PENDING", "REVIEW", "REJECTED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    payMethodsFor(country, "deposits", locale),
    prisma.user.findUnique({ where: { id: user.id }, select: { priceGroup: { select: { name: true, discountBps: true } } } }),
  ]);
  const money = (n: number, c: "HTG" | "USD") => formatMoney(n, c, locale);
  const firstTopUp = (await prisma.paymentIntent.count({ where: { userId: user.id, orderId: null, status: "SUCCEEDED" } })) === 0;
  const bonus = settings.topupBonus;
  const showBonus = (firstTopUp && bonus.firstPct > 0) || bonus.pct > 0;
  const code = settings.referralEnabled ? await ensureReferralCode(user.id) : null;
  const refLink = code ? `${siteUrl().replace(/^https?:\/\//, "")}/?ref=${code}` : "";
  const held = balances.USD.held + balances.HTG.held;

  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="display text-[28px] tracking-tight">{tw("title")}</h1>
        {me?.priceGroup && me.priceGroup.discountBps > 0 && (
          <span className="rounded-full bg-[#111418] px-2.5 py-1.5 text-xs font-semibold text-[#7ce0a8]">{g("groupChip", { group: me.priceGroup.name, pct: me.priceGroup.discountBps / 100 })}</span>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 rounded-[20px] bg-[#111418] p-[18px] text-white">
        <div><span className="text-xs text-[#b9c0b6]">USD</span><b className="display block text-[30px] tabular-nums">{money(balances.USD.available, "USD")}</b></div>
        <div><span className="text-xs text-[#b9c0b6]">HTG</span><b className="display block text-[30px] tabular-nums">{money(balances.HTG.available, "HTG").replace(" HTG", " G")}</b></div>
        {held > 0 && <p className="col-span-2 text-xs text-[#ffd48a]">{g("held", { usd: money(balances.USD.held, "USD"), htg: money(balances.HTG.held, "HTG") })}</p>}
        <Link href="/account/wallet/deposit" className="col-span-2 flex min-h-12 items-center justify-center rounded-xl bg-[#7ce0a8] font-semibold text-[#0b2a1a]">{g("addMoney")}</Link>
        <Link href="/account/wallet/exchange" className="col-span-2 -mt-1 text-center text-xs font-semibold text-[#b9c0b6] underline">{g("exchange")}</Link>
      </section>

      {showBonus && (
        <section className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3.5">
          <GiftIcon width={28} height={28} className="shrink-0 text-[#145c39] dark:text-primary" />
          <span className="text-sm">
            {firstTopUp && bonus.firstPct > 0 && <b>{g("bonusFirst", { pct: bonus.firstPct })} </b>}
            {bonus.pct > 0 && g("bonusMore", { min: money(bonus.minUsd, "USD"), pct: bonus.pct })}
          </span>
        </section>
      )}

      {methods.length > 0 && (
        <section aria-labelledby="w-pay">
          <h2 id="w-pay" className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{g("addWith")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <Link key={m.id} href={`/account/wallet/deposit?method=${encodeURIComponent(m.id)}`} className="rounded-[14px] border border-border bg-surface p-3.5">
                <b className="block">{m.kind === "card" ? g("card") : m.name}</b>
                <span className="text-xs text-muted">{g(`hint.${m.hint}`)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {code && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          <b className="text-[15px]">
            {settings.referralFriendRewardHtg > 0
              ? g("inviteBoth", { amount: money(settings.referralRewardHtg, "HTG") })
              : g("invite", { amount: money(settings.referralRewardHtg, "HTG") })}
          </b>
          <span className="text-[13px] text-muted">{g("inviteSub")}</span>
          <div className="flex gap-2">
            <span className="flex h-11 min-w-0 flex-1 items-center overflow-hidden rounded-[10px] bg-bg px-3 font-mono text-sm"><span className="truncate">{refLink}</span></span>
            <CopyButton value={`https://${refLink}`} label={g("share")} done={to("copied")} />
          </div>
          <Link href="/account/referrals" className="text-xs font-semibold text-primary">{g("invited")}</Link>
        </section>
      )}

      {pending.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-[15px] font-semibold">{tw("pending")}</h2>
          <ul className="divide-y divide-border">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  {formatMoney(p.amount, p.currency, locale)}
                  {p.status === "REJECTED" && p.reviewNote && <span className="block text-xs text-danger">{p.reviewNote}</span>}
                </span>
                <StatusBadge status={p.status} label={tw(`depositStatus.${p.status}`)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="w-hist" className="overflow-hidden rounded-2xl border border-border bg-surface">
        <h2 id="w-hist" className="border-b border-border px-4 py-3.5 text-[15px] font-semibold">{tw("history")}</h2>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{tw("noHistory")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block">
                    {e.transaction.description && !/^[A-Z]+ payment/.test(e.transaction.description) && e.transaction.type !== "PURCHASE"
                      ? e.transaction.description
                      : tw(`tx.${e.transaction.type}`)}
                    {e.account.type === "CUSTOMER_HELD" && <span className="badge ml-2 bg-warning-soft text-warning">⏳</span>}
                  </span>
                  <span className="block text-xs text-muted">{fmt.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <b className={`shrink-0 tabular-nums ${e.amount > 0 ? "text-[#145c39] dark:text-success" : ""}`}>
                  {e.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(e.amount), e.currency, locale)}
                </b>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted">{tw("storeCredit")} {tw("heldHint", { hours: settings.holdHours })}</p>
    </div>
  );
}

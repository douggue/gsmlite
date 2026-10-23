import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBalances } from "@/lib/ledger";
import { getDisplayCurrency } from "@/lib/prefs";
import { formatMoney } from "@/lib/money";
import { itemTitle } from "@/lib/orders";
import { WalletCard } from "@/components/WalletCard";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { emailEnabled } from "@/lib/email";
import { StatusBadge } from "@/components/StatusBadge";
import { TechnicianCta } from "@/components/shop/TechnicianCta";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TelegramConnect } from "@/components/TelegramConnect";
import { telegramReady } from "@/lib/telegram";
import { currentShopper, getCategories } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { t as txt } from "@/lib/text";

export default async function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const shopper = await currentShopper();
  const [ta, to, tw, fmt, balances, currency, orders, counts, activity, cats, spent, settings, me] = await Promise.all([
    getTranslations("account"),
    getTranslations("order"),
    getTranslations("wallet"),
    getFormatter(),
    getBalances(prisma, user.id),
    getDisplayCurrency(),
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { items: true } }),
    prisma.order.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    prisma.ledgerEntry.findMany({
      where: { account: { userId: user.id, type: "CUSTOMER_WALLET" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { transaction: true },
    }),
    getCategories(shopper),
    prisma.order.groupBy({ by: ["currency"], where: { userId: user.id, status: { in: ["PAID", "PROCESSING", "FULFILLED"] } }, _sum: { total: true } }),
    getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { telegramChatId: true } }),
  ]);
  const count = (s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);
  const working = count(["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAID", "PROCESSING"]);
  const done = count(["FULFILLED"]);
  // Total spent shown in USD; gourde orders converted at today's rate.
  const spentUsd = spent.reduce((n, r) => n + (r.currency === "USD" ? r._sum.total ?? 0 : Math.round((r._sum.total ?? 0) / settings.htgPerUsd)), 0);
  const tiles = cats.filter((c) => c._count.products + c.children.reduce((n, k) => n + k._count.products, 0) > 0);
  const available = tiles.reduce((n, c) => n + c._count.products + c.children.reduce((m, k) => m + k._count.products, 0), 0);
  const showTelegram = telegramReady() && !me?.telegramChatId;
  const stats = [
    { label: ta("statsPending"), value: String(working), href: "/account/orders" },
    { label: ta("statsCompleted"), value: String(done), href: "/account/orders" },
    { label: ta("statsFailed"), value: String(count(["FAILED", "REFUNDED", "CANCELED"])), href: "/account/orders" },
    { label: ta("totalSpent"), value: formatMoney(spentUsd, "USD", locale), href: "/account/wallet" },
  ];

  return (
    <div className="space-y-5">
      {!user.emailVerified && emailEnabled() && <VerifyEmailBanner email={user.email} />}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="relative overflow-hidden rounded-3xl bg-[#111418] p-6 text-white sm:p-7">
          <div className="ds-hide pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#1f7a4d]/50 blur-3xl" aria-hidden />
          <p className="relative text-sm font-semibold text-[#7ce0a8]">{fmt.dateTime(new Date(), { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="relative mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{ta("welcomeBack", { name: user.name.split(" ")[0] })}</h1>
          <p className="relative mt-2 text-white/70">{ta("welcomeSub", { working, done })}</p>
          <div className="relative mt-6 flex flex-wrap gap-2.5">
            <Link href="/store" className="inline-flex min-h-12 items-center rounded-2xl bg-[#7ce0a8] px-5 font-bold text-[#0b2a1b] hover:bg-[#9aeabd]">{ta("placeOrder")}</Link>
            <Link href="/prices" className="inline-flex min-h-12 items-center rounded-2xl border border-white/20 px-5 font-semibold hover:bg-white/10">{ta("browseServices")}</Link>
          </div>
        </section>
        <WalletCard balances={balances} initial={currency} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 hover:border-primary">
            <span className="block text-xs font-medium text-muted sm:text-sm">{s.label}</span>
            <span className="mt-1 block text-2xl font-bold tabular-nums sm:text-3xl">{s.value}</span>
          </Link>
        ))}
      </div>

      <TechnicianCta userId={user.id} />

      {tiles.length > 0 && (
        <section aria-labelledby="by-type">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="by-type" className="font-semibold">{ta("shopByType")}</h2>
            <span className="text-sm text-muted">{ta("servicesAvailable")}: <b className="text-text">{available}</b></span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {tiles.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`} className="card flex flex-col items-start gap-3 p-4 hover:border-primary">
                <CategoryIcon image={c.image} icon={c.icon} size={40} />
                <span className="min-w-0">
                  <b className="block text-sm leading-tight">{txt(c.name, locale)}</b>
                  <span className="text-xs text-muted">{ta("servicesCount", { count: c._count.products + c.children.reduce((n, k) => n + k._count.products, 0) })}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{ta("recentOrders")}</h2>
            <Link href="/account/orders" className="text-sm font-semibold text-primary"><span className="inline-block rtl:-scale-x-100">→</span></Link>
          </div>
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{ta("noOrders")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.items[0] ? itemTitle(o.items[0], locale) : `#${o.number}`}</span>
                      <span className="text-xs text-muted">#{o.number} · {fmt.dateTime(o.createdAt, { dateStyle: "medium" })}</span>
                    </span>
                    <StatusBadge status={o.status} label={to(`status.${o.status}`)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{ta("recentActivity")}</h2>
            <Link href="/account/wallet" className="text-sm font-semibold text-primary"><span className="inline-block rtl:-scale-x-100">→</span></Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{ta("noActivity")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="block font-medium">{tw(`tx.${e.transaction.type}`)}</span>
                    <span className="text-xs text-muted">{fmt.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  <span className={`font-semibold ${e.amount > 0 ? "text-success" : ""}`}>
                    {e.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(e.amount), e.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className={`grid gap-4 ${showTelegram ? "lg:grid-cols-2" : ""}`}>
        {showTelegram && (
          <section className="card p-5">
            <h2 className="mb-1 font-semibold">{ta("telegramTitle")}</h2>
            <TelegramConnect linked={false} />
          </section>
        )}
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="font-semibold">{ta("needHelp")}</h2>
          <Link href="/account/support" className="btn-secondary min-h-11 px-4">{ta("support")}</Link>
        </section>
      </div>
    </div>
  );
}

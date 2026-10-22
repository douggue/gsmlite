import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/permissions";
import { getDisplaySettings } from "@/lib/settings";
import { getDisplayCurrency } from "@/lib/prefs";
import { getBalances } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { t as txt } from "@/lib/text";
import { Logo } from "../Logo";
import { BellIcon, WalletIcon } from "../Icons";
import { CartButton, CurrencySwitch, LocaleSwitch, MobileMenu, ThemeToggle } from "../HeaderClient";
import { SearchBox } from "./SearchBox";

/** Wallet balance in the visitor's display currency, shown next to the logo (mockup: "$12.40" pill). */
async function balanceLabel(userId: string, locale: string) {
  const [b, currency] = await Promise.all([getBalances(prisma, userId), getDisplayCurrency()]);
  return formatMoney(b[currency].available, currency, locale);
}

/**
 * Phones: light bar with the logo and the wallet balance (or Sign in), as in the mockup.
 * Wide screens: thin trust bar, dark header with a wide search, then the category row with "Hot" badges.
 */
export async function SiteHeader() {
  const locale = await getLocale();
  const [t, tc, user, settings] = await Promise.all([getTranslations("gl"), getTranslations("common"), getUser(), getDisplaySettings()]);
  const [unread, balance, menu] = await Promise.all([
    user ? prisma.notification.count({ where: { userId: user.id, readAt: null } }) : 0,
    user ? balanceLabel(user.id, locale) : null,
    prisma.category.findMany({ where: { isVisible: true, inMenu: true, parentId: null }, orderBy: { sortOrder: "asc" }, take: 9, select: { slug: true, name: true, isHot: true } }),
  ]);
  const custom = settings.navigation?.header ?? [];
  const nav = custom.length
    ? custom.map((l) => ({ href: l.href, label: txt(l.label, locale) }))
    : [
        { href: "/store", label: t("nav.services") },
        { href: "/check", label: t("header.freeCheck") },
        { href: "/prices", label: t("header.prices") },
        { href: "/news", label: tc("news") },
        { href: "/faq", label: tc("faqShort") },
      ];

  return (
    <>
      {/* Thin trust bar (wide screens) */}
      <div className="hidden bg-[#111418] text-[12.5px] text-[#c9cfc6] lg:block">
        <div className="container-page flex h-8 items-center justify-between gap-4">
          <span className="flex gap-5">
            <span>{t("top.delivery")}</span>
            <span>{t("top.moneyBack")}</span>
            <span>{t("top.wallets")}</span>
            <span>{t("top.support")}</span>
          </span>
          <span className="flex items-center gap-4">
            <Link href="/faq" className="hover:text-white">{t("top.help")}</Link>
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md lg:border-[#1d2226] lg:bg-[#111418] lg:text-white">
        <div className="container-page flex h-16 items-center gap-2 lg:h-[82px] lg:gap-5">
          <Link href="/" className="shrink-0 lg:[&_.font-display]:text-white lg:[&_.font-display_span]:!text-[#7ce0a8]">
            <Logo src={settings.logoUrl} darkSrc={settings.logoDarkUrl} alt={settings.businessName} />
          </Link>
          <div className="hidden flex-1 lg:block">
            <SearchBox variant="dark" placeholder={t("header.search")} buttonLabel={t("home.searchButton")} id="hq" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0 lg:gap-2">
            <div className="hidden items-center gap-1.5 lg:flex">
              <LocaleSwitch />
              <CurrencySwitch compact />
              <ThemeToggle />
            </div>
            {user && (
              <Link href="/account/notifications" className="btn-ghost relative min-h-10 px-2 lg:text-white lg:hover:bg-white/10" aria-label={`${tc("notifications")} (${unread})`}>
                <BellIcon />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface" />}
              </Link>
            )}
            <div className="lg:[&_a]:text-white lg:[&_a:hover]:bg-white/10">
              <CartButton />
            </div>
            {user ? (
              <Link
                href="/account/wallet"
                aria-label={`${t("header.balance")}: ${balance}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-semibold tabular-nums lg:border-white/15 lg:bg-white/[0.06] lg:text-white"
              >
                <WalletIcon width={16} height={16} className="text-primary lg:text-[#7ce0a8]" />
                {balance}
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-semibold lg:rounded-xl lg:border-white/20 lg:bg-transparent lg:px-4 lg:text-white">
                  {t("header.signIn")}
                </Link>
                <Link href="/auth/register" className="hidden min-h-11 items-center rounded-xl bg-[#7ce0a8] px-4 text-sm font-semibold text-[#0b2a1a] lg:inline-flex">
                  {t("header.createAccount")}
                </Link>
              </>
            )}
            {user && (
              <Link href="/account" className="hidden min-h-10 px-1 lg:inline-flex" aria-label={tc("account")}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#7ce0a8] text-sm font-bold text-[#0b2a1a]">{user.name.slice(0, 1).toUpperCase()}</span>
              </Link>
            )}
            {user && isStaff(user.role) && <a href="/admin" className="hidden min-h-10 items-center rounded-xl border border-white/20 px-3 text-sm font-semibold xl:inline-flex">{tc("admin")}</a>}
            <div className="lg:hidden">
              <MobileMenu nav={nav} signedIn={!!user} name={user?.name} />
            </div>
          </div>
        </div>
      </header>

      {/* Category row with "Hot" badges (wide screens) */}
      <nav aria-label={t("header.allCategories")} className="hidden border-b border-border bg-surface lg:block">
        <div className="container-page flex h-[62px] items-center gap-1 overflow-x-auto whitespace-nowrap text-[15px]">
          <Link href="/categories" className="mr-2 inline-flex min-h-[42px] items-center rounded-xl bg-[#111418] px-3.5 font-semibold text-white dark:bg-primary">{t("header.allCategories")}</Link>
          {menu.map((c) => (
            <Link key={c.slug} href={`/categories/${c.slug}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 hover:bg-surface-2">
              {txt(c.name, locale)}
              {c.isHot && <span className="rounded-md bg-primary px-1.5 py-px text-[11px] font-bold text-white">{t("header.hot")}</span>}
            </Link>
          ))}
          <Link href="/check" className="inline-flex min-h-10 items-center rounded-lg px-2.5 hover:bg-surface-2">{t("header.freeCheck")}</Link>
          <Link href="/prices" className="inline-flex min-h-10 items-center rounded-lg px-2.5 hover:bg-surface-2">{t("header.prices")}</Link>
        </div>
      </nav>
    </>
  );
}

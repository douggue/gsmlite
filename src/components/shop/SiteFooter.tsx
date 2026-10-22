import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Settings } from "@/lib/settings";
import type { PayMethod } from "@/lib/pay-methods";
import { listNames } from "@/lib/pay-methods";
import { Logo } from "../Logo";
import { DataSaverToggle } from "../DataSaverToggle";
import { InstallLink } from "../InstallPrompt";
import { NewsletterForm } from "../NewsletterForm";

/** Footer from the mockup: trust strip, link columns, and only the payment methods this visitor can use. */
export async function SiteFooter({ settings, methods, categories }: { settings: Settings; methods: PayMethod[]; categories: { slug: string; name: string }[] }) {
  const locale = await getLocale();
  const t = await getTranslations("gl.footer");
  const names = listNames(methods, locale);
  const badges = [...new Set(methods.map((m) => (m.kind === "card" ? "Visa · Mastercard" : m.name)))];
  const link = "text-[#b9c0b6] hover:text-white";
  return (
    <footer className="mt-16 bg-[#0b0e10] text-white">
      <div className="container-page grid gap-5 border-b border-white/10 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><b className="block">{t("trust1")}</b><span className="text-[#b9c0b6]">{t("trust1Sub")}</span></p>
        <p><b className="block">{t("trust2")}</b><span className="text-[#b9c0b6]">{t("trust2Sub")}</span></p>
        <p><b className="block">{t("trust3")}</b><span className="text-[#b9c0b6]">{names ? t("trust3Sub", { methods: names }) : t("trust3Wallet")}</span></p>
        <p><b className="block">{t("trust4")}</b><span className="text-[#b9c0b6]">{t("trust4Sub")}</span></p>
      </div>
      <div className="container-page grid gap-8 py-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 [&_.font-display]:text-white [&_.font-display_span]:!text-[#7ce0a8]">
          <Logo src={settings.logoDarkUrl || settings.logoUrl} alt={settings.businessName} />
          <p className="text-[#b9c0b6]">{t("tagline")}</p>
          {settings.businessAddress && <p className="text-[#8a9187]">{settings.businessAddress}</p>}
        </div>
        <div>
          <h2 className="mb-3 font-semibold">{t("colServices")}</h2>
          <ul className="space-y-2">
            {categories.slice(0, 5).map((c) => <li key={c.slug}><Link className={link} href={`/categories/${c.slug}`}>{c.name}</Link></li>)}
            <li><Link className={link} href="/check">{t("imeiCheck")}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">{t("colAccount")}</h2>
          <ul className="space-y-2">
            <li><Link className={link} href="/account/orders">{t("orders")}</Link></li>
            <li><Link className={link} href="/account/wallet">{t("wallet")}</Link></li>
            <li><Link className={link} href="/account/wallet/deposit">{t("addFunds")}</Link></li>
            <li><Link className={link} href="/track">{t("track")}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">{t("colSite")}</h2>
          <ul className="space-y-2">
            <li><Link className={link} href="/about">{t("about")}</Link></li>
            <li><Link className={link} href="/prices">{t("prices")}</Link></li>
            <li><Link className={link} href="/status">{t("status")}</Link></li>
            <li><Link className={link} href="/news">{t("news")}</Link></li>
            <li><Link className={link} href="/faq">{t("faq")}</Link></li>
            <li><Link className={link} href="/terms">{t("terms")}</Link></li>
            <li><Link className={link} href="/privacy">{t("privacy")}</Link></li>
            <li><Link className={link} href="/refunds">{t("refunds")}</Link></li>
          </ul>
        </div>
      </div>
      {settings.newsletterEnabled && <div className="container-page pb-6"><NewsletterForm /></div>}
      <div className="container-page flex flex-wrap items-center gap-x-6 gap-y-3 pb-5 text-[#b9c0b6] [&_*]:!text-[#b9c0b6]"><DataSaverToggle /><InstallLink /></div>
      <div className="container-page flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-5 text-[13px] text-[#b9c0b6]">
        <span>© {new Date().getFullYear()} {settings.legal?.entity || settings.businessName}. {t("rights")}{settings.legal?.registration ? ` · ${settings.legal.registration}` : ""}{settings.legal?.taxId ? ` · NIF ${settings.legal.taxId}` : ""}</span>
        {badges.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {badges.map((b) => <span key={b} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-[#111418]">{b}</span>)}
          </span>
        )}
      </div>
    </footer>
  );
}

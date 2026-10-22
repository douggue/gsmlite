import { siteUrl } from "@/lib/site-url";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, rtlLocales } from "@/i18n/routing";
import { getDisplaySettings } from "@/lib/settings";
import { getDisplayCurrency } from "@/lib/prefs";
import { CartProvider } from "@/components/cart/CartProvider";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { SiteFooter } from "@/components/shop/SiteFooter";
import { payMethodsFor } from "@/lib/pay-methods";
import { shopperCountry } from "@/lib/prefs";
import { getCategories } from "@/lib/catalog";
import { t as txt } from "@/lib/text";
import { BottomNav, ThemeKeeper } from "@/components/HeaderClient";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { alternates } from "@/lib/seo";
import { themeAttrs, themeCss, themeScript, cssGuardScript } from "@/lib/theme-css";
import { fullTheme } from "@/lib/settings";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies, headers } from "next/headers";
import { getUser } from "@/lib/session";
import { ServiceWorker } from "@/components/ServiceWorker";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SPLASH } from "@/lib/splash";
import { SiteLangs } from "@/components/SiteLangs";
import { isStaff } from "@/lib/permissions";
import "../globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#111418" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0E10" },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings] = await Promise.all([getTranslations({ locale, namespace: "meta" }), getDisplaySettings()]);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title"), template: "%s · GSMLite" },
    description: t("description"),
    alternates: alternates(locale, ""),
    openGraph: { siteName: settings.businessName, locale, type: "website", ...(settings.ogImageUrl ? { images: [{ url: settings.ogImageUrl, width: 1200, height: 630 }] } : {}) },
    manifest: "/manifest.webmanifest",
    // Installed on iPhone: full screen, no Safari bar, logo launch screen.
    appleWebApp: { capable: true, title: "GSMLite", statusBarStyle: "black", startupImage: SPLASH },
    icons: (() => {
      const v = settings.appIconVersion ? `?v=${settings.appIconVersion}` : "";
      return { icon: [{ url: `/app-icon/48${v}`, sizes: "48x48", type: "image/png" }, { url: `/app-icon/192${v}`, sizes: "192x192", type: "image/png" }], apple: `/app-icon/180${v}` };
    })(),
  };
}

// Self-hosted at build time by Next.js (no request to Google from visitors' phones).
// Arabic letters: same family, downloaded only by pages that show Arabic (not preloaded).
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "600", "700"], variable: "--font-arabic", display: "swap", preload: false });
const sans = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], weight: ["600", "800"], variable: "--font-display-face", display: "optional" });

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [settings, currency, t, user, hdrs, jar] = await Promise.all([getDisplaySettings(), getDisplayCurrency(), getTranslations("common"), getUser(), headers(), cookies()]);
  // Data saver: the visitor's toggle, or the browser's Save-Data signal.
  const dataSaver = jar.get("gl_ds")?.value === "1" || (jar.get("gl_ds")?.value !== "0" && hdrs.get("save-data") === "on");
  // Light/dark: the visitor's saved choice (cookie), else the store default. Rendered by the server, so it never flashes.
  const themeCookie = jar.get("gl_theme")?.value;
  const dark = themeCookie ? themeCookie === "dark" : fullTheme(settings.theme).defaultMode === "dark";
  const country = await shopperCountry(user);
  // Maintenance mode: customers see the message; staff keep using the site.
  const closed = settings.maintenance.on && !(user && isStaff(user.role));
  const [methods, cats] = await Promise.all([payMethodsFor(country, "orders", locale), getCategories({ country, signedIn: !!user })]);

  return (
    <html lang={locale} dir={rtlLocales.includes(locale) ? "rtl" : "ltr"} suppressHydrationWarning className={`${sans.variable} ${display.variable} ${arabic.variable}${dataSaver ? " data-saver" : ""}${dark ? " dark" : ""}`} {...themeAttrs(settings.theme)}>
      <head>
        {/* Applies light/dark before paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript(fullTheme(settings.theme).defaultMode) }} />
        <script dangerouslySetInnerHTML={{ __html: cssGuardScript }} />
        {themeCss(settings.theme) && <style dangerouslySetInnerHTML={{ __html: themeCss(settings.theme) }} />}
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <SiteLangs value={settings.languages}>
          <CartProvider currency={currency} htgPerUsd={settings.htgPerUsd} signedIn={!!user}>
            <AnnouncementBar settings={settings} locale={locale} />
            <SiteHeader />
            <main id="main">{closed ? <Maintenance message={txt(settings.maintenance.message, locale) || t("maintenance")} until={settings.maintenance.until} /> : children}</main>
            <SiteFooter settings={settings} methods={methods} categories={cats.filter((c) => c.inMenu).map((c) => ({ slug: c.slug, name: txt(c.name, locale) }))} />
            {/* Room for the phone bottom navigation so it never covers the footer */}
            <div className="md:hidden" style={{ height: "calc(4rem + env(safe-area-inset-bottom, 0px))" }} aria-hidden />
            <BottomNav signedIn={!!user} />
            <ThemeKeeper defaultMode={fullTheme(settings.theme).defaultMode} />
            <ServiceWorker />
            <InstallPrompt />
          </CartProvider>
          </SiteLangs>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function Maintenance({ message, until }: { message: string; until?: string }) {
  return (
    <section className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16 text-center">
      <div className="space-y-3">
        <p className="text-5xl" aria-hidden>🛠</p>
        <p className="whitespace-pre-line text-lg font-semibold">{message}</p>
        {until && <p className="text-sm text-muted">{new Date(until).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>}
      </div>
    </section>
  );
}

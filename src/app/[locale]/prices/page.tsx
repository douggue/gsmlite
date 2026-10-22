import { TechnicianCta } from "@/components/shop/TechnicianCta";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageSeo } from "@/lib/seo";
import { t } from "@/lib/text";
import { currentShopper, getCategories, searchProducts } from "@/lib/catalog";
import { getUser } from "@/lib/session";
import { priceContext } from "@/lib/pricing";
import { fromPrice } from "@/lib/storefront";
import { allServiceStats } from "@/lib/service-stats";
import { durationParts } from "@/lib/duration";
import { currentDeal } from "@/lib/deals";
import { getDisplaySettings } from "@/lib/settings";
import { PriceList, type PriceGroupView } from "@/components/shop/PriceList";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const g = await getTranslations({ locale, namespace: "gl.prices" });
  return pageSeo(locale, "/prices", g("metaTitle"), g("metaDescription"));
}

/** Public price list (mockup "Prices"): every service the visitor may buy, grouped, with live status and real time. */
export default async function PricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const shopper = await currentShopper();
  const user = await getUser();
  const [g, tt, categories, products, stats, ctx, deal, settings] = await Promise.all([
    getTranslations("gl.prices"), getTranslations("gl.time"), getCategories(shopper), searchProducts({ shopper }), allServiceStats(), priceContext(user?.id), currentDeal(), getDisplaySettings(),
  ]);
  const time = (m: number) => {
    const d = durationParts(m);
    return tt(d.key, { n: d.n });
  };
  const topOf = new Map<string, string>();
  for (const c of categories) {
    topOf.set(c.id, c.id);
    for (const ch of c.children) topOf.set(ch.id, c.id);
  }
  const groups: PriceGroupView[] = categories
    .map((c) => ({
      id: c.id,
      name: t(c.name, locale),
      rows: products
        .filter((p) => topOf.get(p.categoryId) === c.id)
        .map((p) => {
          const s = stats[p.id];
          return {
            slug: p.slug,
            name: t(p.name, locale),
            type: p.serviceType,
            status: s?.status ?? "online",
            time: s?.medianMinutes != null ? time(s.medianMinutes) : t(p.deliveryEstimate, locale) || "—",
            price: fromPrice(p, ctx),
            haystack: `${t(p.name, "en")} ${t(p.name, "fr")} ${t(p.name, "ht")} ${t(p.name, "es")} ${p.tags.join(" ")}`.toLowerCase(),
          };
        }),
    }))
    .filter((x) => x.rows.length > 0);

  return (
    <div className="container-page max-w-[1040px] pb-10 pt-4 lg:pt-8">
      <h1 className="display text-[32px] tracking-tight sm:text-[40px]">{g("title")}</h1>
      <p className="mt-1.5 text-muted">{g("sub")}</p>
      <div className="mt-4"><TechnicianCta userId={user?.id ?? null} /></div>
      <PriceList
        groups={groups}
        deal={deal ? { slug: deal.product.slug, name: t(deal.product.name, locale), price: deal.deal.priceUsd, endsAt: deal.deal.endsAt.toISOString() } : null}
        telegram={settings.telegramUrl}
      />
    </div>
  );
}

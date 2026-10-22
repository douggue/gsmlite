import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageSeo } from "@/lib/seo";
import { currentShopper, searchProducts } from "@/lib/catalog";
import { getUser } from "@/lib/session";
import { priceContext } from "@/lib/pricing";
import { cardView } from "@/lib/storefront";
import { currentDeal } from "@/lib/deals";
import { ServiceCard } from "@/components/shop/ServiceCard";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const g = await getTranslations({ locale, namespace: "gl.deals" });
  return pageSeo(locale, "/deals", g("title"), g("sub"));
}

/** Deal of the week first, then everything on sale and the hand-picked deals of the day. */
export default async function DealsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const shopper = await currentShopper();
  const user = await getUser();
  const [g, gh, all, ctx, deal] = await Promise.all([getTranslations("gl.deals"), getTranslations("gl.home"), searchProducts({ shopper }), priceContext(user?.id), currentDeal()]);
  const onSale = all.filter((p) => p.isFeatured || p.variants.some((v) => v.salePriceUsd != null));
  onSale.sort((a, b) => Number(b.id === deal?.product.id) - Number(a.id === deal?.product.id));
  return (
    <div className="container-page pb-10 pt-4 lg:pt-8">
      <h1 className="display text-[32px] tracking-tight">{g("title")}</h1>
      <p className="mt-1.5 text-muted">{g("sub")}</p>
      {onSale.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center text-muted">{g("none")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {onSale.map((p) => <ServiceCard key={p.id} card={cardView(p, ctx, locale)} orderLabel={gh("addToCart")} />)}
        </div>
      )}
    </div>
  );
}

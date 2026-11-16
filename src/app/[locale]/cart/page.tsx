import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { t } from "@/lib/text";
import { currentShopper, shopperWhere } from "@/lib/catalog";
import { CartView, type Upsell } from "@/components/cart/CartView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return { title: t("title"), robots: { index: false } };
}

/** Suggest the IMEI check people should run before an unlock (the cheapest published check service). */
async function imeiCheckUpsell(locale: string): Promise<Upsell | null> {
  const shopper = await currentShopper();
  const p = await prisma.product.findFirst({
    where: { isPublished: true, serviceType: "IMEI", ...shopperWhere(shopper), category: { OR: [{ slug: { contains: "check" } }, { slug: { contains: "tchek" } }] }, variants: { some: { isActive: true } } },
    include: { variants: { where: { isActive: true }, orderBy: { priceUsd: "asc" }, take: 1 } },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
  });
  const v = p?.variants[0];
  if (!p || !v) return null;
  return { slug: p.slug, name: t(p.name, locale), sub: t(p.deliveryEstimate, locale), priceUsd: v.salePriceUsd ?? v.priceUsd };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CartView upsell={await imeiCheckUpsell(locale)} />;
}

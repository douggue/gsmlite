import { servicePageContent } from "@/lib/content/machine";
import { SeoArticle } from "@/components/shop/SeoArticle";
import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { minPrice, productCardInclude, searchProducts } from "@/lib/catalog";
import { getDisplaySettings } from "@/lib/settings";
import { getUser } from "@/lib/session";
import { t } from "@/lib/text";
import { alternates } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { allowedIn } from "@/lib/countries";
import { shopperCountry } from "@/lib/prefs";
import { payMethodsFor } from "@/lib/pay-methods";
import { getBalances } from "@/lib/ledger";
import { serviceStats } from "@/lib/service-stats";
import { durationParts } from "@/lib/duration";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ServiceOrder } from "@/components/shop/ServiceOrder";
import { Price } from "@/components/Money";
import { BackIcon } from "@/components/Icons";
import type { FieldDef } from "@/lib/orders";
import { lowStockVariants } from "@/lib/trust";
import { listPrice, priceContext, unitPriceUsd } from "@/lib/pricing";
import type { IdentifierFormat } from "@/lib/imei";

type P = Promise<{ locale: string; slug: string }>;

async function load(slug: string) {
  return prisma.product.findFirst({ where: { slug, isPublished: true }, include: productCardInclude });
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p) return {};
  // An approved content-machine page gives the search title and description when staff left them empty.
  const written = p.hideFromGoogle ? null : await servicePageContent(p.id, locale);
  const title = t(p.seoTitle, locale) || written?.title || t(p.name, locale);
  const description = t(p.seoDescription, locale) || written?.description || t(p.description, locale).slice(0, 160);
  return {
    title,
    description,
    alternates: alternates(locale, `/products/${slug}`),
    openGraph: { title, description, ...(p.image ? { images: [p.image] } : {}) },
    // "Hide from Google" services: never indexed
    ...(p.hideFromGoogle ? { robots: { index: false, follow: false } } : {}),
  };
}

/** A cheap check service to offer next to unlocks ("check first, then buy"). */
async function checkService(productId: string) {
  return prisma.product.findFirst({
    where: { id: { not: productId }, isPublished: true, hideFromGoogle: false, serviceType: "IMEI", category: { slug: { contains: "check" } } },
    include: { variants: { where: { isActive: true, soldOut: false }, orderBy: { priceUsd: "asc" }, take: 1 } },
    orderBy: { sortOrder: "asc" },
  });
}

export default async function ProductPage({ params }: { params: P }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await load(slug);
  if (!product) notFound();
  const user = await getUser();
  const written = product.hideFromGoogle ? null : await servicePageContent(product.id, locale);
  const country = await shopperCountry(user);
  // Not sold here: nothing about it is shown. "Hide from Google" services: signed-in customers only.
  if (!allowedIn(product, country)) notFound();
  const [g, tc, settings] = await Promise.all([getTranslations("gl"), getTranslations("common"), getDisplaySettings()]);
  if (product.hideFromGoogle && !user) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <h1 className="display text-2xl">{t(product.name, locale)}</h1>
        <p className="mt-3 text-muted">{g("service.membersOnly")}</p>
        <Link href={`/auth/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="btn-primary mt-6 min-h-12">{g("header.signIn")}</Link>
      </div>
    );
  }

  const [saved, stats, methods, balances, check, ctx] = await Promise.all([
    user ? prisma.savedPlayerId.findMany({ where: { userId: user.id, productId: product.id }, orderBy: { createdAt: "desc" }, take: 5 }) : [],
    serviceStats(product.id),
    payMethodsFor(country, "orders", locale),
    user ? getBalances(prisma, user.id) : null,
    product.serviceType === "IMEI" && product.offerCheck && !product.category.slug.includes("check") ? checkService(product.id) : null,
    priceContext(user?.id),
  ]);
  const stock = product.fulfillmentType === "CODE_INVENTORY"
    ? Object.fromEntries(
        (await prisma.codeItem.groupBy({ by: ["variantId"], where: { status: "AVAILABLE", variantId: { in: product.variants.map((v) => v.id) } }, _count: true }))
          .map((x) => [x.variantId, x._count]),
      )
    : null;
  const low = new Set(lowStockVariants(product.variants, stock, settings.lowStockLimit));
  const related = (await searchProducts({ category: product.category.slug, take: 5 })).filter((p) => p.id !== product.id).slice(0, 4);
  const name = t(product.name, locale);
  const images = [product.image, ...((product.gallery ?? []) as string[])].filter((x): x is string => !!x);
  const from = Math.min(...product.variants.map((v) => unitPriceUsd(v, ctx)));
  const time = (m: number) => {
    const d = durationParts(m);
    return g(`time.${d.key}`, { n: d.n });
  };
  const deliveryText = stats?.medianMinutes != null ? time(stats.medianMinutes) : t(product.deliveryEstimate, locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: t(product.description, locale),
    ...(product.image ? { image: [product.image, ...((product.gallery ?? []) as string[])] } : {}),
    brand: { "@type": "Brand", name: settings.businessName },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: (minPrice(product) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: "https://schema.org/InStock",
    },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tc("store"), item: `${siteUrl()}/${locale}/store` },
      { "@type": "ListItem", position: 2, name: t(product.category.name, locale), item: `${siteUrl()}/${locale}/categories/${product.category.slug}` },
      { "@type": "ListItem", position: 3, name },
    ],
  };

  const statBox = (
    <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-[14px] border border-border bg-surface text-center">
      <div className="p-3"><dt className="text-xs text-muted">{g("service.statPrice")}</dt><dd className="mt-0.5 font-semibold tabular-nums"><Price usd={from} /></dd></div>
      <div className="p-3"><dt className="text-xs text-muted">{stats?.medianMinutes != null ? g("service.statAvg") : g("service.statTime")}</dt><dd dir="auto" className="mt-0.5 font-semibold">{deliveryText || "—"}</dd></div>
      <div className="p-3">
        <dt className="text-xs text-muted">{g("service.statSuccess")}</dt>
        <dd className="mt-0.5 font-semibold">{stats?.successRate != null ? `${stats.successRate.toLocaleString(locale === "ht" ? "fr" : locale)} %` : g("service.newService")}</dd>
      </div>
    </dl>
  );

  return (
    <div className="container-page pb-10 pt-2 lg:pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, crumbs]) }} />
      <nav className="-ml-2 flex items-center gap-1 text-[13px] text-muted lg:ml-0" aria-label="Breadcrumb">
        <Link href={`/categories/${product.category.slug}`} aria-label={g("service.back")} className="grid h-11 w-11 place-items-center text-text lg:hidden"><BackIcon width={22} height={22} /></Link>
        <Link href="/store" className="hidden hover:text-text lg:inline">{g("nav.services")}</Link>
        <span className="hidden lg:inline">/</span>
        <Link href={`/categories/${product.category.slug}`} className="hover:text-text">{t(product.category.name, locale)}</Link>
      </nav>

      {/* One grid: on phones everything stacks (order card right after the price/time/success box);
          on computers the order card sits in a sticky right column next to the rest. */}
      <div className="mt-1 flex flex-col gap-5 lg:mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[repeat(6,auto)_1fr] lg:gap-x-10 lg:gap-y-0 [&>*:empty]:hidden [&>*]:lg:col-start-1 [&>*:not(:empty)]:lg:mb-5">
        <div>
          <h1 dir="auto" className="display text-[28px] leading-[1.1] tracking-tight lg:text-4xl">{name}</h1>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {deliveryText && <span dir="auto" className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold">{deliveryText}</span>}
            {product.tags.slice(0, 3).map((x) => <span key={x} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold">{x}</span>)}
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{g("service.refundChip")}</span>
          </div>
          {t(product.description, locale) && <p dir="auto" className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted lg:text-base">{t(product.description, locale)}</p>}
        </div>

        <div>
          {statBox}
          {stats?.successRate != null && <p className="mt-1.5 text-xs text-muted">{g("service.basedOn", { n: stats.delivered + stats.rejected })}</p>}
          {stats?.topRejection && product.serviceType === "IMEI" && (
            <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">{g("service.topRejection", { reason: stats.topRejection })}</p>
          )}
        </div>

        <div>
          {check && check.variants[0] && (
            <Link href={`/products/${check.slug}#order`} className="flex items-center justify-between gap-3 rounded-[14px] border border-[#cfe7d8] bg-primary-soft px-4 py-3 text-sm">
              <span>{g("service.checkFirst", { name: t(check.name, locale) })}</span>
              <b className="shrink-0 text-primary"><Price usd={unitPriceUsd(check.variants[0], ctx)} /> <span className="inline-block rtl:-scale-x-100">→</span></b>
            </Link>
          )}
        </div>

        <aside className="lg:!col-start-2 lg:row-[1/-1] lg:!mb-0 lg:self-start lg:sticky lg:top-28 lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:p-5 lg:shadow-sm">
          <div className="mb-4 hidden items-baseline justify-between gap-3 lg:flex">
            <h2 className="font-semibold">{g("service.orderTitle")}</h2>
            <span className="text-sm text-muted">{g("service.from")} <b className="text-text"><Price usd={from} /></b></span>
          </div>
          <ServiceOrder
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name as Record<string, string>,
              accent: product.accent,
              image: product.image,
              serviceType: product.serviceType,
              identifierLabel: (product.identifierLabel ?? null) as Record<string, string> | null,
              identifierFormat: product.identifierFormat as IdentifierFormat,
              allowBulk: product.allowBulk,
              fields: product.fields as FieldDef[],
              variants: product.variants.map((v) => ({
                id: v.id,
                name: v.name as Record<string, string>,
                listUsd: listPrice(v),
                priceUsd: unitPriceUsd(v, ctx),
                minQty: v.minQty,
                maxQty: v.maxQty,
                inStock: !v.soldOut && (stock ? (stock[v.id] ?? 0) > 0 : true),
                lowStock: low.has(v.id),
              })),
            }}
            saved={saved.map((x) => ({ id: x.id, label: x.label, values: x.values as Record<string, string> }))}
            methods={methods.map((m) => ({ id: m.id, name: m.name, hint: m.hint, currency: m.currency }))}
            signedIn={!!user}
            balances={balances ? { HTG: balances.HTG.available, USD: balances.USD.available } : null}
            showHtg={methods.some((m) => m.currency === "HTG")}
          />
        </aside>

        {product.serviceType === "IMEI" ? (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold">{g("service.findImeiTitle")}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>{g("service.findImei1")}</li>
              <li>{g("service.findImei2")}</li>
              <li>{g("service.findImei3")}</li>
            </ul>
          </section>
        ) : <div />}

        <div>{images.length > 0 && <div className="max-w-xl"><ProductGallery name={name} accent={product.accent} images={images} /></div>}</div>

        <div>{written && <SeoArticle page={written} stepsTitle={g("seo.steps")} faqTitle={g("seo.faq")} />}</div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold">{g("service.related")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

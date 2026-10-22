import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { alternates } from "@/lib/seo";
import { currentShopper, productCardInclude, shopperWhere } from "@/lib/catalog";
import { brandProducts } from "@/lib/content/facts";
import type { PageContent } from "@/lib/content/machine";
import { ProductCard } from "@/components/ProductCard";
import { SeoArticle } from "@/components/shop/SeoArticle";

type P = Promise<{ locale: string; slug: string }>;

async function load(slug: string, locale: string) {
  const page = await prisma.contentPage.findFirst({ where: { slug, kind: "hub", status: "PUBLISHED" } });
  if (!page) return null;
  const c = page.content as unknown as PageContent;
  return { page, text: c[locale] ?? c.en ?? Object.values(c)[0] };
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { locale, slug } = await params;
  const r = await load(slug, locale);
  if (!r?.text) return {};
  return { title: r.text.title, description: r.text.description, alternates: alternates(locale, `/brand/${slug}`) };
}

/** Brand hub (content machine): the brand's public services with an approved explainer and FAQ. */
export default async function BrandHub({ params }: { params: P }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const r = await load(slug, locale);
  if (!r?.text) notFound();
  const [g, shopper] = await Promise.all([getTranslations("gl.seo"), currentShopper()]);
  const ids = (await brandProducts(r.page.brand ?? "")).map((p) => p.id);
  const products = await prisma.product.findMany({ where: { id: { in: ids }, ...shopperWhere(shopper) }, include: productCardInclude, orderBy: { sortOrder: "asc" } });
  return (
    <div className="container-page max-w-[1040px] pb-12 pt-4 lg:pt-8">
      <h1 className="display text-[32px] leading-tight tracking-tight sm:text-[40px]">{r.text.title}</h1>
      <div className="mt-3 max-w-3xl space-y-3 whitespace-pre-line text-muted">{r.text.intro}</div>
      {products.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">{g("hubServices")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
      <div className="mt-10 max-w-3xl"><SeoArticle page={r.text} stepsTitle={g("steps")} faqTitle={g("faq")} showIntro={false} /></div>
    </div>
  );
}

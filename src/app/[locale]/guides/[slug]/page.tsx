import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { alternates } from "@/lib/seo";
import type { PageContent } from "@/lib/content/machine";
import { Link } from "@/i18n/navigation";
import { SeoArticle } from "@/components/shop/SeoArticle";

type P = Promise<{ locale: string; slug: string }>;

async function load(slug: string, locale: string) {
  const page = await prisma.contentPage.findFirst({ where: { slug, kind: "guide", status: "PUBLISHED" } });
  if (!page) return null;
  const c = page.content as unknown as PageContent;
  return { page, text: c[locale] ?? c.en ?? Object.values(c)[0] };
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { locale, slug } = await params;
  const r = await load(slug, locale);
  if (!r?.text) return {};
  return { title: r.text.title, description: r.text.description, alternates: alternates(locale, `/guides/${slug}`), openGraph: { type: "article", title: r.text.title, description: r.text.description } };
}

/** Guide (content machine): answers one search, then points to the free IMEI check or a matching service. */
export default async function Guide({ params }: { params: P }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const r = await load(slug, locale);
  if (!r?.text) notFound();
  const [g, gc] = await Promise.all([getTranslations("gl.seo"), getTranslations("gl.check")]);
  return (
    <div className="container-page max-w-3xl pb-12 pt-4 lg:pt-8">
      <Link href="/guides" className="text-sm font-semibold text-primary">← {g("guides")}</Link>
      <h1 className="display mt-2 text-[30px] leading-tight tracking-tight sm:text-[38px]">{r.text.title}</h1>
      <p className="mt-1 text-xs text-muted">{r.page.publishedAt?.toISOString().slice(0, 10)}</p>
      <div className="mt-6"><SeoArticle page={r.text} stepsTitle={g("steps")} faqTitle={g("faq")} /></div>
      <Link href="/check" className="btn-primary mt-8 inline-flex min-h-12 px-6">{gc("checkNow")}</Link>
    </div>
  );
}

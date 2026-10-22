import type { Metadata } from "next";
import type { ServiceChangeKind } from "@prisma/client";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { pageSeo } from "@/lib/seo";
import { t } from "@/lib/text";
import { Link } from "@/i18n/navigation";
import { currentShopper, shopperWhere } from "@/lib/catalog";
import { NewsCard } from "@/components/NewsCard";
import { Price } from "@/components/Money";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tn = await getTranslations({ locale, namespace: "news" });
  return { ...pageSeo(locale, "/news", tn("title"), tn("subtitle")), alternates: { types: { "application/rss+xml": `/${locale}/news/rss.xml` } } };
}

const KINDS = ["post", "tool", "feature", "security", "howto"] as const;
const CHANGES: ServiceChangeKind[] = ["NEW", "PRICE_DOWN", "BACK", "PRICE_UP", "REMOVED"];
/** Price rises and removals are only shown to signed-in customers. */
const PUBLIC_CHANGES: ServiceChangeKind[] = ["NEW", "PRICE_DOWN", "BACK"];

/** News (inspired by sickw's news page): written posts, and the automatic feed of service changes. */
export default async function NewsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; kind?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const tab = sp.tab === "changes" ? "changes" : "posts";
  const shopper = await currentShopper();
  const [tn, g, fmt] = await Promise.all([getTranslations("news"), getTranslations("gl.news"), getFormatter()]);
  const allowed = shopper.signedIn ? CHANGES : PUBLIC_CHANGES;
  const tabCls = (on: boolean) => `inline-flex min-h-11 items-center rounded-xl px-4 font-semibold ${on ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`;
  const pill = (on: boolean) => `rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`;

  let body: React.ReactNode;
  if (tab === "posts") {
    const kind = KINDS.includes(sp.kind as (typeof KINDS)[number]) ? sp.kind : undefined;
    const articles = await prisma.newsArticle.findMany({
      where: { isPublished: true, publishedAt: { lte: new Date() }, ...(kind ? { kind } : {}) },
      orderBy: { publishedAt: "desc" },
      take: 60,
    });
    body = (
      <>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/news" className={pill(!kind)}>{g("all")}</Link>
          {KINDS.map((k) => <Link key={k} href={`/news?kind=${k}`} className={pill(kind === k)}>{g(`kind.${k}`)}</Link>)}
        </div>
        {articles.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-10 text-center text-muted">{tn("empty")}</div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.map((a) => <NewsCard key={a.id} article={a} locale={locale} />)}</div>
        )}
      </>
    );
  } else {
    const kind = allowed.includes(sp.kind as ServiceChangeKind) ? (sp.kind as ServiceChangeKind) : undefined;
    const visible = { product: { isPublished: true, ...shopperWhere(shopper) } };
    const since = new Date(Date.now() - 60 * 86_400_000);
    // Changes reference products by id; only services this visitor may see are listed.
    const ids = (await prisma.product.findMany({ where: visible.product, select: { id: true } })).map((p) => p.id);
    const [rows, counts] = await Promise.all([
      prisma.serviceChange.findMany({ where: { productId: { in: ids }, kind: kind ? kind : { in: allowed }, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.serviceChange.groupBy({ by: ["kind"], where: { productId: { in: ids }, kind: { in: allowed }, createdAt: { gte: since } }, _count: true }),
    ]);
    const products = new Map((await prisma.product.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.productId))] } }, select: { id: true, slug: true, name: true } })).map((p) => [p.id, p]));
    const n = new Map(counts.map((c) => [c.kind, c._count]));
    const badge: Record<ServiceChangeKind, string> = {
      NEW: "bg-primary text-white", PRICE_DOWN: "bg-[#e4f3ea] text-[#145c39]", BACK: "bg-[#dcebfa] text-[#154a80]", PRICE_UP: "bg-[#fcebdd] text-[#8a3607]", REMOVED: "bg-surface-2 text-muted",
    };
    body = (
      <>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/news?tab=changes" className={pill(!kind)}>{g("all")}</Link>
          {allowed.map((k) => <Link key={k} href={`/news?tab=changes&kind=${k}`} className={pill(kind === k)}>{g(`change.${k}`)} {n.get(k) ?? 0}</Link>)}
        </div>
        {!shopper.signedIn && <p className="mt-3 text-xs text-muted">{g("signInForAll")}</p>}
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.length === 0 && <li className="p-8 text-center text-muted">{g("noChanges")}</li>}
          {rows.map((r) => {
            const p = products.get(r.productId);
            if (!p) return null;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${badge[r.kind]}`}>{g(`change.${r.kind}`)}</span>
                <Link href={`/products/${p.slug}`} className="min-w-0 flex-1 font-semibold hover:text-primary">{t(p.name, locale)}</Link>
                {r.oldPrice != null && r.newPrice != null && (
                  <span className="tabular-nums"><span className="text-muted line-through"><Price usd={r.oldPrice} /></span> → <b><Price usd={r.newPrice} /></b></span>
                )}
                <span className="w-full text-xs text-muted sm:w-auto">{fmt.dateTime(r.createdAt, { dateStyle: "medium" })}</span>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl tracking-tight">{tn("title")}</h1>
          <p className="mt-1 text-muted">{tn("subtitle")}</p>
        </div>
        <a href={`/${locale}/news/rss.xml`} className="text-sm font-semibold text-primary">RSS</a>
      </div>
      <div className="mt-5 flex gap-2">
        <Link href="/news" className={tabCls(tab === "posts")}>{g("posts")}</Link>
        <Link href="/news?tab=changes" className={tabCls(tab === "changes")}>{g("changes")}</Link>
        <Link href="/status" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary">{g("status")} →</Link>
      </div>
      {body}
    </div>
  );
}

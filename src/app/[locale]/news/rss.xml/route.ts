import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";
import { t } from "@/lib/text";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** RSS: published posts and public service changes (new, price down, back online; never hidden services). */
export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const base = `${siteUrl()}/${locale}`;
  const [posts, changes] = await Promise.all([
    prisma.newsArticle.findMany({ where: { isPublished: true, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 30 }),
    prisma.serviceChange.findMany({ where: { kind: { in: ["NEW", "PRICE_DOWN", "BACK"] }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const products = new Map(
    (await prisma.product.findMany({ where: { id: { in: changes.map((c) => c.productId) }, isPublished: true, hideFromGoogle: false, countryMode: "all" }, select: { id: true, slug: true, name: true } })).map((p) => [p.id, p]),
  );
  const label = { NEW: "New service", PRICE_DOWN: "Price down", BACK: "Back online", PRICE_UP: "Price up", REMOVED: "Removed" } as const;
  const items = [
    ...posts.map((p) => ({ title: t(p.title, locale), link: `${base}/news/${p.slug}`, desc: t(p.excerpt, locale), date: p.publishedAt ?? p.createdAt })),
    ...changes.flatMap((c) => {
      const p = products.get(c.productId);
      if (!p) return [];
      const price = c.newPrice != null ? ` · $${(c.newPrice / 100).toFixed(2)}` : "";
      return [{ title: `${label[c.kind]}: ${t(p.name, locale)}${price}`, link: `${base}/products/${p.slug}`, desc: "", date: c.createdAt }];
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 60);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>GSMLite</title><link>${base}/news</link><description>GSMLite news and service changes</description>
${items.map((i) => `<item><title>${esc(i.title)}</title><link>${esc(i.link)}</link><guid>${esc(i.link)}#${i.date.getTime()}</guid><pubDate>${i.date.toUTCString()}</pubDate><description>${esc(i.desc)}</description></item>`).join("\n")}
</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}

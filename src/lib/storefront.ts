import "server-only";
import { prisma } from "./db";
import { t } from "./text";
import { countryWhere } from "./countries";
import { currentShopper, getCategories, productCardInclude, searchProducts, shopperWhere, type ProductWithVariants } from "./catalog";
import { priceContext, unitPriceUsd, type PriceContext } from "./pricing";
import { payMethodsFor } from "./pay-methods";
import { getUser } from "./session";

/** Lowest price this shopper pays for a service (their price group applies). */
export function fromPrice(p: ProductWithVariants, ctx: PriceContext) {
  const prices = p.variants.filter((v) => !v.soldOut).map((v) => unitPriceUsd(v, ctx));
  return prices.length ? Math.min(...prices) : p.variants.length ? Math.min(...p.variants.map((v) => unitPriceUsd(v, ctx))) : 0;
}

export type CardView = {
  id: string;
  slug: string;
  name: string;
  category: string;
  title: string;
  tag: string;
  style: string;
  price: number;
  delivery: string;
  image: string | null;
};

export function cardView(p: ProductWithVariants, ctx: PriceContext, locale: string): CardView {
  const name = t(p.name, locale);
  return {
    id: p.id,
    slug: p.slug,
    name,
    category: t(p.category.name, locale),
    title: t(p.cardTitle, locale) || name,
    tag: t(p.cardTag, locale) || t(p.deliveryEstimate, locale),
    style: p.cardStyle,
    price: fromPrice(p, ctx),
    delivery: t(p.deliveryEstimate, locale),
    image: p.image,
  };
}

/** Best sellers: most ordered in the last 30 days, then the hand-picked featured ones. */
async function popular(take: number, where: ReturnType<typeof shopperWhere>) {
  const top = await prisma.$queryRaw<{ productId: string; n: bigint }[]>`
    SELECT v."productId", COUNT(*) AS n FROM "OrderItem" i
    JOIN "Order" o ON o.id = i."orderId" JOIN "ProductVariant" v ON v.id = i."variantId"
    WHERE o."paidAt" > NOW() - INTERVAL '30 days' GROUP BY v."productId" ORDER BY n DESC LIMIT 40`;
  const ids = top.map((r) => r.productId);
  const rows = await prisma.product.findMany({
    where: { isPublished: true, variants: { some: { isActive: true } }, ...where, OR: [{ id: { in: ids } }, { isFeatured: true }] },
    include: productCardInclude,
    take: 60,
  });
  const rank = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (rank.get(a.id) ?? 999 + a.sortOrder) - (rank.get(b.id) ?? 999 + b.sortOrder)).slice(0, take);
}

export async function homeData(locale: string) {
  const shopper = await currentShopper();
  const user = await getUser();
  const ctx = await priceContext(user?.id);
  const where = shopperWhere(shopper);
  const now = new Date();
  const [categories, deals, best, tools, slides, updates, methods] = await Promise.all([
    getCategories(shopper),
    searchProducts({ featured: true, take: 10, shopper }),
    popular(8, where),
    prisma.category.findMany({
      where: { isVisible: true, isTool: true },
      orderBy: { sortOrder: "asc" },
      take: 12,
      include: { products: { where: { isPublished: true, ...where }, include: productCardInclude, orderBy: { sortOrder: "asc" }, take: 6 } },
    }),
    prisma.homeSlide.findMany({
      where: {
        isActive: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }, countryWhere(shopper.country)],
      },
      orderBy: { sortOrder: "asc" },
      take: 8,
    }),
    prisma.newsArticle.findMany({ where: { isPublished: true, kind: "tool", publishedAt: { lte: now } }, orderBy: { publishedAt: "desc" }, take: 3 }),
    payMethodsFor(shopper.country, "orders", locale),
  ]);
  return {
    user,
    ctx,
    shopper,
    methods,
    categories: categories.filter((c) => c.inMenu),
    deals: deals.map((p) => cardView(p, ctx, locale)),
    best: best.map((p) => cardView(p, ctx, locale)),
    tools: tools.map((c) => ({
      slug: c.slug,
      name: t(c.name, locale),
      code: c.code || initials(t(c.name, "en")),
      image: c.image,
      // "12 months · New activation" → title + sub
      options: c.products.flatMap((p) =>
        p.variants.map((v) => {
          const [title, ...rest] = t(v.name, locale).split("·");
          return { id: v.id, slug: p.slug, title: title.trim() || t(p.name, locale), sub: rest.join("·").trim() || t(p.name, locale), price: unitPriceUsd(v, ctx) };
        }),
      ).slice(0, 6),
    })),
    slides: slides.map((s) => ({
      id: s.id,
      tag: t(s.tag, locale),
      label: t(s.label, locale),
      title: t(s.title, locale),
      bullets: t(s.bullets, locale).split("\n").map((b) => b.trim()).filter(Boolean),
      buttonText: t(s.buttonText, locale),
      buttonHref: s.buttonHref,
      button2Text: t(s.button2Text, locale),
      button2Href: s.button2Href,
      image: s.image,
    })),
    updates: updates.map((n) => ({ slug: n.slug, tool: n.toolName || t(n.title, locale), code: initials(n.toolName || t(n.title, "en")), version: n.version, text: t(n.excerpt, locale) || t(n.title, locale) })),
  };
}

/** "UnlockTool" → "UT", "Carrier unlock" → "CU" */
export function initials(name: string) {
  const caps = name.match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps.slice(0, 2).join("");
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { countryWhere } from "./countries";

/** Who is looking: services not sold in their country are hidden, and "Hide from Google" services need a signed-in customer. */
export type Shopper = { country: string | null; signedIn: boolean };

export function shopperWhere(s: Shopper | null): Prisma.ProductWhereInput {
  if (!s) return {};
  return { AND: [countryWhere(s.country) as Prisma.ProductWhereInput, ...(s.signedIn ? [] : [{ hideFromGoogle: false }])] };
}

/** The current visitor (server components and actions only). */
export async function currentShopper(): Promise<Shopper> {
  const { getUser } = await import("./session");
  const { shopperCountry } = await import("./prefs");
  const user = await getUser();
  return { country: await shopperCountry(user), signedIn: !!user };
}

export const productCardInclude = {
  variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
  category: true,
} satisfies Prisma.ProductInclude;

export type ProductWithVariants = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export function minPrice(p: ProductWithVariants) {
  const prices = p.variants.map((v) => v.salePriceUsd ?? v.priceUsd);
  return prices.length ? Math.min(...prices) : 0;
}

export async function getCategories(shopper?: Shopper | null) {
  const s = shopper === undefined ? await currentShopper() : shopper;
  const visible = { isPublished: true, ...shopperWhere(s) };
  return prisma.category.findMany({
    where: { isVisible: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: { where: visible } } },
      children: { where: { isVisible: true }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: visible } } } } },
    },
  });
}

/** Distinct filter tags across published products (e.g. "Apple", "Samsung", "USA"). */
export async function getTags(): Promise<string[]> {
  const rows = await prisma.product.findMany({ where: { isPublished: true }, select: { tags: true } });
  return [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b));
}

export async function searchProducts(opts: {
  q?: string; category?: string; sort?: string; featured?: boolean; take?: number; tag?: string; minUsd?: number; maxUsd?: number;
  serviceType?: "IMEI" | "SERVER" | "REMOTE" | "FILE"; tool?: boolean;
  /** Defaults to the current visitor; null = no country/sign-in filter (staff tools) */
  shopper?: Shopper | null;
}) {
  const s = opts.shopper === undefined ? await currentShopper() : opts.shopper;
  const where: Prisma.ProductWhereInput = { isPublished: true, variants: { some: { isActive: true } }, ...shopperWhere(s) };
  if (opts.serviceType) where.serviceType = opts.serviceType;
  if (opts.tool) where.category = { isTool: true };
  // A parent category also shows the products of its subcategories.
  if (opts.category) where.category = { OR: [{ slug: opts.category }, { parent: { slug: opts.category } }] };
  if (opts.tag) where.tags = { has: opts.tag };
  if (opts.featured) where.isFeatured = true;
  let rank: Map<string, number> | null = null;
  if (opts.q) {
    rank = await searchRank(opts.q);
    where.id = { in: [...rank.keys()] };
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    opts.sort === "newest" ? [{ createdAt: "desc" }] : [{ isFeatured: "desc" }, { sortOrder: "asc" }];
  const products = await prisma.product.findMany({ where, include: productCardInclude, orderBy, take: opts.take });
  let list = products;
  if (opts.minUsd !== undefined) list = list.filter((p) => minPrice(p) >= opts.minUsd!);
  if (opts.maxUsd !== undefined) list = list.filter((p) => minPrice(p) <= opts.maxUsd!);
  if (list !== products) products.splice(0, products.length, ...list);
  // A search lists the closest matches first, unless the shopper picked another order.
  if (rank && !opts.sort) products.sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0));
  if (opts.sort === "price_asc") products.sort((a, b) => minPrice(a) - minPrice(b));
  if (opts.sort === "price_desc") products.sort((a, b) => minPrice(b) - minPrice(a));
  return products;
}

/**
 * Word-by-word search over names (every language), slug, tags, category and option names.
 * Products matching every word come first; if none do (e.g. "iPhone 13 AT&T" when no name says "13"),
 * the best partial matches are returned instead of an empty page. Returns product id → number of words matched.
 */
export async function searchRank(q: string): Promise<Map<string, number>> {
  const words = [...new Set(q.toLowerCase().replace(/[^\p{L}\p{N}&+]+/gu, " ").split(" ").filter((w) => w.length >= 2 || /\d/.test(w)))].slice(0, 8);
  if (!words.length) return new Map();
  const doc = Prisma.sql`(p.name::text || ' ' || p.slug || ' ' || array_to_string(p.tags, ' ') || ' ' || c.name::text || ' ' ||
    COALESCE((SELECT string_agg(v.name::text, ' ') FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive"), ''))`;
  const score = Prisma.join(words.map((w) => Prisma.sql`(CASE WHEN ${doc} ILIKE ${"%" + w + "%"} THEN 1 ELSE 0 END)`), " + ");
  const rows = await prisma.$queryRaw<{ id: string; n: number }[]>`
    SELECT p.id, (${score})::int AS n FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" WHERE p."isPublished" = true`;
  const hits = rows.filter((r) => r.n > 0);
  const best = Math.max(0, ...hits.map((r) => r.n));
  // Everything that matched all words; otherwise everything as good as the best partial match (at least half the words).
  const keep = best === words.length ? hits.filter((r) => r.n === best) : hits.filter((r) => r.n >= Math.max(1, Math.ceil(words.length / 2)) && r.n >= best - 1);
  return new Map(keep.map((r) => [r.id, r.n]));
}

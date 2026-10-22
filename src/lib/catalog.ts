import type { Prisma } from "@prisma/client";
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
  if (opts.q) {
    const q = opts.q.trim().slice(0, 80);
    // Localized names are JSON; search the serialized value so any language matches.
    const ids = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product" WHERE "isPublished" = true AND (name::text ILIKE ${"%" + q + "%"} OR slug ILIKE ${"%" + q + "%"})`;
    where.id = { in: ids.map((r) => r.id) };
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    opts.sort === "newest" ? [{ createdAt: "desc" }] : [{ isFeatured: "desc" }, { sortOrder: "asc" }];
  const products = await prisma.product.findMany({ where, include: productCardInclude, orderBy, take: opts.take });
  let list = products;
  if (opts.minUsd !== undefined) list = list.filter((p) => minPrice(p) >= opts.minUsd!);
  if (opts.maxUsd !== undefined) list = list.filter((p) => minPrice(p) <= opts.maxUsd!);
  if (list !== products) products.splice(0, products.length, ...list);
  if (opts.sort === "price_asc") products.sort((a, b) => minPrice(a) - minPrice(b));
  if (opts.sort === "price_desc") products.sort((a, b) => minPrice(b) - minPrice(a));
  return products;
}

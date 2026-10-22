import "server-only";
import { prisma } from "./db";
import { currentShopper, productCardInclude, shopperWhere } from "./catalog";
import { priceContext } from "./pricing";
import { fromPrice } from "./storefront";

/** Cheapest unlock for this brand that the shopper may buy, for "Unlock this iPhone 13 · from $x". */
export async function unlockOfferFor(brand: string | null, user: { id: string } | null) {
  const shopper = await currentShopper();
  // Localized names are JSON: match the brand in any language, in the tags or in the address.
  const named = brand
    ? (await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE name::text ILIKE ${"%" + brand + "%"}`).map((r) => r.id)
    : [];
  const brandWhere = brand ? { OR: [{ tags: { has: brand } }, { id: { in: named } }, { slug: { contains: brand.toLowerCase() } }] } : {};
  const products = await prisma.product.findMany({
    where: { isPublished: true, serviceType: "IMEI", category: { slug: { contains: "unlock" } }, ...shopperWhere(shopper), ...brandWhere },
    include: productCardInclude,
    take: 30,
  });
  if (!products.length) return null;
  const ctx = await priceContext(user?.id);
  const from = Math.min(...products.map((p) => fromPrice(p, ctx)));
  return { href: brand ? `/store?q=${encodeURIComponent(brand)}` : "/store", from };
}

/** The full (paid) check service shown next to the free result. */
export async function fullCheckOffer(user: { id: string } | null) {
  const shopper = await currentShopper();
  const p = await prisma.product.findFirst({
    where: { isPublished: true, serviceType: "IMEI", category: { slug: { contains: "check" } }, ...shopperWhere(shopper) },
    include: productCardInclude,
    orderBy: { sortOrder: "asc" },
  });
  if (!p) return null;
  return { slug: p.slug, price: fromPrice(p, await priceContext(user?.id)) };
}

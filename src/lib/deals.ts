import "server-only";
import { revalidateTag } from "next/cache";
import { prisma } from "./db";
import { recordChange } from "./service-changes";

/** Start a deal: the option's sale price becomes the deal price until `endsAt` (only one running deal per option). */
export async function startDeal(variantId: string, priceUsd: number, endsAt: Date, actorId: string | null) {
  const before = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  const deal = await prisma.$transaction(async (tx) => {
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    if (priceUsd <= 0 || priceUsd >= v.priceUsd) throw new Error("The deal price must be lower than the normal price");
    const running = await tx.deal.findFirst({ where: { variantId, endedAt: null } });
    if (running) throw new Error("This option already has a running deal");
    const deal = await tx.deal.create({ data: { variantId, priceUsd, previousSale: v.salePriceUsd, endsAt, createdById: actorId } });
    await tx.productVariant.update({ where: { id: variantId }, data: { salePriceUsd: priceUsd } });
    return deal;
  });
  await recordChange("PRICE_DOWN", before.productId, { variantId, oldPrice: before.salePriceUsd ?? before.priceUsd, newPrice: priceUsd });
  return deal;
}

/** End a deal now (or when its time is up): the option gets back the sale price it had before. */
export async function endDeal(dealId: string) {
  await prisma.$transaction(async (tx) => {
    const d = await tx.deal.findUnique({ where: { id: dealId } });
    if (!d || d.endedAt) return;
    await tx.deal.update({ where: { id: d.id }, data: { endedAt: new Date() } });
    // Only undo our own price: if staff changed the sale price meanwhile, keep theirs.
    await tx.productVariant.updateMany({ where: { id: d.variantId, salePriceUsd: d.priceUsd }, data: { salePriceUsd: d.previousSale } });
  });
  try {
    revalidateTag("service-stats");
  } catch {}
}

export async function endExpiredDeals() {
  const due = await prisma.deal.findMany({ where: { endedAt: null, endsAt: { lte: new Date() } }, select: { id: true } });
  for (const d of due) await endDeal(d.id);
  return due.length;
}

/** The running deal shown on the price list and home ("Deal of the week"). */
export async function currentDeal() {
  const d = await prisma.deal.findFirst({
    where: { endedAt: null, endsAt: { gt: new Date() }, startsAt: { lte: new Date() } },
    orderBy: { startsAt: "desc" },
  });
  if (!d) return null;
  const v = await prisma.productVariant.findUnique({ where: { id: d.variantId }, include: { product: true } });
  if (!v || !v.product.isPublished) return null;
  return { deal: d, variant: v, product: v.product };
}

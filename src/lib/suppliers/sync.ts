import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { callSupplier } from "../dhru/client";
import { parseAccountInfo, parseServiceList, replyError, resultText, type SupplierField } from "../dhru/protocol";
import type { FieldDef } from "../orders";
import { importPrice, type PriceRounding } from "../import-price";

const L = (v: string) => ({ ht: v, fr: v, en: v, es: v });

/** Balance check (accountinfo). Returns an error message or null. */
export async function refreshBalance(supplierId: string): Promise<string | null> {
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  const { reply, error } = await callSupplier(supplier, "accountinfo");
  const problem = reply ? replyError(reply) : error;
  if (problem || !reply) {
    await prisma.supplier.update({ where: { id: supplierId }, data: { lastError: (problem ?? "No answer").slice(0, 500) } });
    return problem ?? "No answer";
  }
  const info = parseAccountInfo(reply);
  await prisma.supplier.update({ where: { id: supplierId }, data: { balance: info.credit, currency: info.currency, lastError: null } });
  return null;
}

/**
 * Pull the supplier's service list into SupplierService and refresh the cost of every linked option.
 * Services that disappeared are marked inactive (options linked to them keep working until staff change them).
 */
export async function syncCatalog(supplierId: string): Promise<{ ok: true; services: number; gone: number } | { ok: false; error: string }> {
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  const balanceError = await refreshBalance(supplierId);
  if (balanceError) return { ok: false, error: balanceError };
  const { reply, error } = await callSupplier(supplier, "imeiservicelist");
  const problem = reply ? replyError(reply) : error;
  if (problem || !reply) return { ok: false, error: problem ?? "No answer" };
  const services = parseServiceList(reply);
  if (services.length === 0) return { ok: false, error: "The supplier returned an empty service list" };

  const seen = new Set<string>();
  const before = new Map(
    (await prisma.supplierService.findMany({ where: { supplierId }, select: { remoteId: true, credit: true } })).map((r) => [r.remoteId, r.credit]),
  );
  for (const s of services) {
    seen.add(s.remoteId);
    const old = before.get(s.remoteId);
    const data = {
      groupName: s.groupName.slice(0, 200),
      name: s.name.slice(0, 300),
      type: s.type,
      credit: s.credit,
      time: s.time?.slice(0, 100) ?? null,
      info: s.info ? resultText(s.info).slice(0, 4000) : null,
      fields: { identifierLabel: s.identifierLabel, bulk: s.bulk, qty: s.qty, inputs: s.fields } as Prisma.InputJsonValue,
      active: true,
      ...(old != null && old !== s.credit ? { previousCredit: old, priceChangedAt: new Date() } : {}),
    };
    await prisma.supplierService.upsert({
      where: { supplierId_remoteId: { supplierId, remoteId: s.remoteId } },
      create: { supplierId, remoteId: s.remoteId, ...data },
      update: data,
    });
    // Costs are tracked in USD; a supplier billing in another currency keeps its last manual cost.
    if (!supplier.currency || supplier.currency.toUpperCase() === "USD") {
      await prisma.productVariant.updateMany({ where: { supplierId, supplierServiceId: s.remoteId }, data: { costUsd: s.credit } });
    }
  }
  const gone = await prisma.supplierService.updateMany({ where: { supplierId, remoteId: { notIn: [...seen] }, active: true }, data: { active: false } });
  // Nobody can order a service the supplier dropped; it comes back by itself if the supplier lists it again.
  await prisma.productVariant.updateMany({
    where: { supplierId, supplierServiceId: { notIn: [...seen] }, soldOut: false },
    data: { soldOut: true, pausedBySupplier: true },
  });
  await prisma.productVariant.updateMany({
    where: { supplierId, supplierServiceId: { in: [...seen] }, pausedBySupplier: true },
    data: { soldOut: false, pausedBySupplier: false },
  });
  await prisma.supplier.update({ where: { id: supplierId }, data: { lastSyncAt: new Date(), lastError: null } });
  return { ok: true, services: services.length, gone: gone.count };
}

export type ServiceMeta = {
  identifierLabel: string | null;
  bulk: boolean;
  qty: { min: number; max: number } | null;
  inputs: SupplierField[];
};

/** Supplier inputs → our order form fields, each remembering the exact name to send back. */
export function fieldsFromSupplier(inputs: SupplierField[]): FieldDef[] {
  return inputs.map((f, i) => ({
    key: `f${i + 1}`,
    label: L(f.kind === "param" ? paramLabel(f.name) : f.name),
    type: f.type,
    required: f.required,
    ...(f.options ? { options: f.options } : {}),
    ...(f.description ? { placeholder: f.description.slice(0, 100) } : {}),
    supplierName: f.kind === "param" ? `param:${f.name}` : f.name,
  }));
}

function paramLabel(p: string) {
  return (
    { NETWORK: "Network", MODELID: "Model", PROVIDERID: "Carrier", PIN: "PIN", KBH: "KBH", MEP: "MEP", PRD: "PRD", TYPE: "Type", REFERENCE: "Reference", LOCKS: "Locks", SN: "Serial number", SECRO: "SecRO" } as Record<string, string>
  )[p] ?? p;
}


function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "service";
}

/** Find or create the category named after a supplier group (e.g. "Apple USA unlocks"). */
async function categoryForGroup(groupName: string) {
  const slug = slugify(groupName);
  const found = await prisma.category.findUnique({ where: { slug } });
  if (found) return found.id;
  return (await prisma.category.create({ data: { slug, name: L(groupName), isVisible: true } })).id;
}

/**
 * Create a product from a supplier service, priced at cost + markup. Hidden for staff to review unless `publish`.
 * `categoryId` "group" puts it in a category named after the supplier's group. Returns the product id, or null if
 * this service is already sold on the site.
 */
export async function importService(supplierServiceId: string, opts: { categoryId: string; markupBps: number; minProfitUsd: number; round?: PriceRounding; publish?: boolean }) {
  const s = await prisma.supplierService.findUniqueOrThrow({ where: { id: supplierServiceId } });
  if (await prisma.productVariant.findFirst({ where: { supplierId: s.supplierId, supplierServiceId: s.remoteId } })) return null;
  const meta = s.fields as unknown as ServiceMeta;
  const price = importPrice(s.credit, opts.markupBps, opts.minProfitUsd, opts.round);
  const categoryId = opts.categoryId === "group" ? await categoryForGroup(s.groupName) : opts.categoryId;
  let slug = slugify(s.name);
  if (await prisma.product.findUnique({ where: { slug } })) slug = `${slug}-${s.remoteId}`.slice(0, 80);
  const product = await prisma.product.create({
    data: {
      slug,
      categoryId,
      name: L(s.name),
      description: L(s.info ?? ""),
      deliveryEstimate: s.time ? L(s.time) : Prisma.JsonNull,
      fulfillmentType: "SUPPLIER_API",
      serviceType: s.type,
      identifierLabel: s.type === "IMEI" ? L(meta.identifierLabel || "IMEI") : Prisma.JsonNull,
      identifierFormat: s.type === "IMEI" && /^imei$/i.test(meta.identifierLabel ?? "IMEI") ? "imei" : "any",
      allowBulk: s.type === "IMEI",
      fields: fieldsFromSupplier(meta.inputs ?? []) as Prisma.InputJsonValue,
      isPublished: !!opts.publish,
      variants: {
        create: {
          name: L(s.name),
          priceUsd: price,
          costUsd: s.credit,
          supplierId: s.supplierId,
          supplierServiceId: s.remoteId,
          minQty: meta.qty?.min ?? 1,
          maxQty: meta.qty?.max ?? 1,
        },
      },
    },
  });
  return product.id;
}

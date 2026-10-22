import "server-only";
import { Prisma, type SupplierOrder } from "@prisma/client";
import { prisma } from "../db";
import { callSupplier } from "../dhru/client";
import { encodeCustomFields, FILE_ID_PREFIX, isAccountProblem, parseOrderStatus, parsePlaceOrder, resultText, type DhruParams } from "../dhru/protocol";
import { deliverItemManually, rejectItem, type FieldDef } from "../orders";
import { t } from "../text";
import { decrypt } from "../crypto";
import { readEncryptedDocument } from "../storage";
import { parseModel, rememberTac } from "../free-check";

/** Supplier orders that still count as "with the supplier" (at most one per line, enforced by a unique index). */
export const LIVE = ["SUBMITTING", "WAITING", "IN_PROCESS", "UNKNOWN", "SUCCESS"] as const;

/** Wait before the next status check: 2, 5, 10, 20 min, then doubling from 30 min up to 6 h. */
export function nextCheckDelayMs(checks: number): number {
  const steps = [2, 5, 10, 20];
  const min = checks < steps.length ? steps[checks] : Math.min(30 * 2 ** (checks - steps.length), 360);
  return min * 60_000;
}

/** Send every waiting supplier line of an order. Called right after payment, and by staff ("Send again"). */
export async function dispatchOrder(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: {
      orderId,
      status: "PENDING",
      order: { status: { in: ["PAID", "PROCESSING"] }, riskFlags: { none: { status: "OPEN" } } },
      variant: { supplierId: { not: null }, supplierServiceId: { not: null }, product: { fulfillmentType: "SUPPLIER_API" } },
      supplierOrders: { none: { status: { in: [...LIVE] } } },
    },
    select: { id: true },
  });
  for (const i of items) await submitItem(i.id);
}

/** Order parameters for one line: IMEI/QNT, standard parameters, and the CUSTOMFIELD block. */
export function buildOrderParams(
  item: { identifier: string | null; quantity: number; fieldValues: unknown },
  product: { serviceType: string; fields: unknown },
  serviceId: string,
): DhruParams {
  const values = (item.fieldValues ?? {}) as Record<string, string>;
  const params: DhruParams = { ID: serviceId };
  if (product.serviceType === "IMEI") params.IMEI = item.identifier ?? "";
  if (product.serviceType === "SERVER") params.QNT = item.quantity;
  const custom: Record<string, string> = {};
  for (const f of (product.fields ?? []) as FieldDef[]) {
    const raw = values[f.key];
    if (!raw || raw === "(removed)" || f.type === "file" || f.type === "info") continue;
    const v = raw.startsWith("enc:") ? decrypt(raw.slice(4)) : raw;
    const target = f.supplierName?.trim() || t(f.label, "en") || f.key;
    if (target.startsWith("param:")) params[target.slice(6).toUpperCase()] = v;
    else custom[target] = v;
  }
  params.CUSTOMFIELD = encodeCustomFields(custom);
  return params;
}

/**
 * Send one line to its supplier. The SUBMITTING row is written first, so if we crash or time out mid-call the
 * line is never sent a second time by itself: it becomes UNKNOWN and waits for staff to check with the supplier
 * (the Dhru API has no idempotency key, so a blind retry could pay twice).
 */
export async function submitItem(itemId: string): Promise<SupplierOrder | null> {
  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { variant: { include: { product: true, supplier: true } } } });
  const supplier = item?.variant.supplier;
  const serviceId = item?.variant.supplierServiceId;
  if (!item || item.status !== "PENDING" || !supplier || !serviceId) return null;
  if (!supplier.isEnabled) {
    await prisma.supplier.update({ where: { id: supplier.id }, data: { lastError: "Supplier switched off: orders are waiting in Admin → Suppliers" } });
    return null;
  }

  let so: SupplierOrder;
  try {
    so = await prisma.supplierOrder.create({ data: { orderItemId: item.id, supplierId: supplier.id, serviceId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null; // already with the supplier
    throw e;
  }

  const isFile = serviceId.startsWith(FILE_ID_PREFIX);
  const params = buildOrderParams(item, item.variant.product, isFile ? serviceId.slice(FILE_ID_PREFIX.length) : serviceId);
  if (isFile) {
    // File services: the customer's upload goes as FILENAME + FILEDATA (base64).
    const fileDef = ((item.variant.product.fields ?? []) as FieldDef[]).find((f) => f.type === "file");
    const fileId = fileDef ? ((item.fieldValues ?? {}) as Record<string, string>)[fileDef.key] : undefined;
    const file = fileId ? await prisma.orderFile.findFirst({ where: { id: fileId, deletedAt: null } }) : null;
    if (!file) {
      await prisma.supplierOrder.update({ where: { id: so.id }, data: { status: "REJECTED", error: "No file attached to send" } });
      await rejectItem(item.id, null, "The file was missing: nothing was charged by the supplier");
      return prisma.supplierOrder.findUniqueOrThrow({ where: { id: so.id } });
    }
    params.FILENAME = file.name;
    params.FILEDATA = (await readEncryptedDocument(file.path)).toString("base64");
  }
  const { reply, error } = await callSupplier(supplier, isFile ? "placefileorder" : "placeimeiorder", params);
  if (!reply) {
    return prisma.supplierOrder.update({ where: { id: so.id }, data: { status: "UNKNOWN", error } });
  }
  const placed = parsePlaceOrder(reply);
  if ("ref" in placed) {
    return prisma.supplierOrder.update({
      where: { id: so.id },
      data: { status: "WAITING", remoteRef: placed.ref, nextCheckAt: new Date(Date.now() + nextCheckDelayMs(0)) },
    });
  }
  const updated = await prisma.supplierOrder.update({ where: { id: so.id }, data: { status: "REJECTED", error: placed.error.slice(0, 1000) } });
  if (isAccountProblem(placed.error)) {
    // Our account with the supplier (balance, key, IP): keep the customer's line waiting and tell staff.
    await prisma.supplier.update({ where: { id: supplier.id }, data: { lastError: placed.error.slice(0, 500) } });
  } else {
    await rejectItem(item.id, null, resultText(placed.error) || "Rejected by the supplier");
  }
  return updated;
}

/** Ask the supplier where one order stands and apply the answer. Safe to run twice at the same time. */
export async function checkSupplierOrder(so: SupplierOrder & { supplier?: unknown }) {
  if (!so.remoteRef || !["WAITING", "IN_PROCESS"].includes(so.status)) return so.status;
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id: so.supplierId } });
  const { reply, error } = await callSupplier(supplier, so.serviceId.startsWith(FILE_ID_PREFIX) ? "getfileorder" : "getimeiorder", { ID: so.remoteRef });
  const parsed = reply ? parseOrderStatus(reply) : { error: error ?? "No answer" };
  const nextCheckAt = new Date(Date.now() + nextCheckDelayMs(so.checks + 1));

  if ("error" in parsed) {
    await prisma.supplierOrder.update({ where: { id: so.id }, data: { checks: { increment: 1 }, nextCheckAt, error: parsed.error.slice(0, 1000) } });
    return so.status;
  }
  if (parsed.status === "WAITING" || parsed.status === "IN_PROCESS") {
    await prisma.supplierOrder.update({ where: { id: so.id }, data: { status: parsed.status, checks: { increment: 1 }, nextCheckAt, error: null } });
    return parsed.status;
  }

  const text = resultText(parsed.code || parsed.comments);
  // Claim the final transition so two checkers can't both deliver or both refund.
  const claimed = await prisma.supplierOrder.updateMany({
    where: { id: so.id, status: { in: ["WAITING", "IN_PROCESS"] } },
    data: { status: parsed.status, result: text, checks: { increment: 1 }, nextCheckAt: null, error: null },
  });
  if (claimed.count === 0) return so.status;
  if (parsed.status === "SUCCESS") {
    await deliverItemManually(so.orderItemId, text || "Done", null).catch((e) => console.error("deliver after supplier success", so.id, e));
    // A result that names the model teaches the free IMEI check this phone's TAC.
    const found = parseModel(text);
    if (found.model) {
      const item = await prisma.orderItem.findUnique({ where: { id: so.orderItemId }, select: { identifier: true } });
      if (item?.identifier) await rememberTac(item.identifier, found.brand, found.model, "learned").catch(() => {});
    }
  } else {
    await rejectItem(so.orderItemId, null, text || "Rejected by the supplier");
  }
  return parsed.status;
}

/**
 * Cron: check supplier orders that are due, and turn sends that never finished (crash mid-call) into UNKNOWN.
 * Limited per run so one slow supplier can't use up the function's time.
 */
export async function pollSuppliers(limit = 60) {
  const now = new Date();
  const stuck = await prisma.supplierOrder.updateMany({
    where: { status: "SUBMITTING", createdAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    data: { status: "UNKNOWN", error: "The send never finished: check on the supplier's site whether the order exists" },
  });
  const due = await prisma.supplierOrder.findMany({
    where: { status: { in: ["WAITING", "IN_PROCESS"] }, nextCheckAt: { lte: now } },
    orderBy: { nextCheckAt: "asc" },
    take: limit,
  });
  let finished = 0;
  // A few at a time: fast enough, and gentle with suppliers' rate limits.
  for (let i = 0; i < due.length; i += 5) {
    const results = await Promise.all(due.slice(i, i + 5).map((so) => checkSupplierOrder(so).catch((e) => (console.error("supplier check", so.id, e), so.status))));
    finished += results.filter((s) => s === "SUCCESS" || s === "REJECTED").length;
  }
  // Paid lines whose send never started (e.g. the request ended right after payment).
  const unsent = await prisma.orderItem.findMany({
    where: {
      status: "PENDING",
      order: { status: { in: ["PAID", "PROCESSING"] }, paidAt: { lt: new Date(now.getTime() - 2 * 60_000) }, riskFlags: { none: { status: "OPEN" } } },
      variant: { supplierId: { not: null }, supplierServiceId: { not: null }, product: { fulfillmentType: "SUPPLIER_API" } },
      supplierOrders: { none: {} },
    },
    select: { id: true },
    take: 20,
  });
  for (const u of unsent) await submitItem(u.id).catch((e) => console.error("late submit", u.id, e));
  return { checked: due.length, finished, markedUnknown: stuck.count, lateSubmits: unsent.length };
}

/** Check the given lines now if their check is due (customer opened the order, reseller polled the API). */
export async function refreshItems(itemIds: string[]) {
  if (!itemIds.length) return;
  const due = await prisma.supplierOrder.findMany({
    where: { orderItemId: { in: itemIds }, status: { in: ["WAITING", "IN_PROCESS"] }, nextCheckAt: { lte: new Date() } },
    take: 5,
  });
  await Promise.all(due.map((so) => checkSupplierOrder(so).catch((e) => console.error("supplier refresh", so.id, e))));
}

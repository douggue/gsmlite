import { Prisma, type Currency, type OrderStatus, type PaymentMethodKind } from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "./db";
import { decrypt, randomToken } from "./crypto";
import { priceIn } from "./money";
import { getSettings } from "./settings";
import { chargeOrder, refundItemToWallet } from "./wallet";
import { assertWithinNewAccountLimit, flag } from "./risk";
import { notify } from "./notify";
import { t } from "./text";
import { moncashAvailable } from "./payments/moncash";
import { cardAvailable } from "./payments/card";
import { methodAllowed } from "./pay-methods";
import { allowedIn } from "./countries";
import { maybeRewardReferral } from "./referrals";
import { parseIdentifiers, type IdentifierFormat } from "./imei";
import { priceContext, unitPriceUsd } from "./pricing";

export type FieldDef = {
  key: string;
  label: Record<string, string>;
  type: "text" | "email" | "number" | "tel" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  /** select: the choices */
  options?: string[];
  /** Name of this input on the supplier's side (Dhru CUSTOMFIELD key). Empty = same as the label in English. */
  supplierName?: string;
};

/** Most identifiers one order can carry (each one is its own order line). */
export const MAX_IDENTIFIERS = 100;

export const cartItemSchema = z.object({
  variantId: z.string().min(1).max(64),
  /** IMEI/REMOTE services: always 1 per identifier. SERVER services: units (credits), checked against the option's range. */
  quantity: z.number().int().min(1).max(100_000),
  fields: z.record(z.string().max(1000)).default({}),
  /** IMEI services: one or more IMEIs / serial numbers */
  identifiers: z.array(z.string().max(100)).max(MAX_IDENTIFIERS).optional(),
});
export const cartSchema = z.array(cartItemSchema).min(1).max(20);
export type CartItemInput = z.infer<typeof cartItemSchema>;

export class OrderError extends Error {
  constructor(public code: string, public detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export function validateFields(defs: FieldDef[], values: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const d of defs) {
    const v = (values[d.key] ?? "").trim();
    if (d.required && !v) throw new OrderError("missing_field", t(d.label, "en") || d.key);
    if (v && d.type === "email" && !z.string().email().safeParse(v).success) throw new OrderError("invalid_field", d.key);
    if (v && d.type === "number" && !/^\d+$/.test(v)) throw new OrderError("invalid_field", d.key);
    if (v && d.type === "select" && d.options?.length && !d.options.includes(v)) throw new OrderError("invalid_field", d.key);
    if (v.length > (d.type === "textarea" ? 1000 : 200)) throw new OrderError("invalid_field", d.key);
    if (v) clean[d.key] = v;
  }
  return clean; // unknown keys are dropped (data minimization)
}

export async function addEvent(tx: Tx, orderId: string, status: OrderStatus, note?: string, actorId?: string | null) {
  await tx.orderEvent.create({ data: { orderId, status, note, actorId: actorId ?? null } });
}

type Line = {
  variantId: string;
  productName: Prisma.InputJsonValue;
  variantName: Prisma.InputJsonValue;
  quantity: number;
  unitPrice: number;
  unitUsd: number;
  identifier: string | null;
  fieldValues: Record<string, string>;
};

/**
 * Turn cart items into order lines with server-side prices and validation.
 * IMEI services become one line per identifier, so each phone is processed, tracked and refunded on its own.
 */
export async function buildLines(userId: string, items: CartItemInput[], currency: Currency, htgPerUsd: number, country?: string | null): Promise<Line[]> {
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) }, isActive: true, product: { isPublished: true } },
    include: { product: true },
  });
  const ctx = await priceContext(userId);
  const lines: Line[] = [];
  for (const item of items) {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v || v.soldOut) throw new OrderError("unavailable");
    if (country !== undefined && !allowedIn(v.product, country)) throw new OrderError("not_in_country");
    const fieldValues = validateFields(v.product.fields as FieldDef[], item.fields);
    const unitUsd = unitPriceUsd(v, ctx);
    const base = {
      variantId: v.id,
      productName: v.product.name as Prisma.InputJsonValue,
      variantName: v.name as Prisma.InputJsonValue,
      unitPrice: priceIn(unitUsd, currency, htgPerUsd),
      unitUsd,
      fieldValues,
    };
    if (v.product.serviceType === "IMEI") {
      const format = v.product.identifierFormat as IdentifierFormat;
      const { valid, invalid } = parseIdentifiers((item.identifiers ?? []).join("\n"), format);
      if (invalid.length) throw new OrderError("invalid_identifier", invalid[0]);
      if (valid.length === 0) throw new OrderError("missing_identifier");
      if (valid.length > 1 && !v.product.allowBulk) throw new OrderError("bulk_not_allowed");
      for (const id of valid) lines.push({ ...base, quantity: 1, identifier: id });
    } else if (v.product.serviceType === "SERVER") {
      if (item.quantity < v.minQty || item.quantity > Math.max(v.minQty, v.maxQty)) throw new OrderError("invalid_quantity", `${v.minQty}-${v.maxQty}`);
      lines.push({ ...base, quantity: item.quantity, identifier: null });
    } else {
      lines.push({ ...base, quantity: Math.min(item.quantity, 10), identifier: null });
    }
  }
  if (lines.length > MAX_IDENTIFIERS) throw new OrderError("too_many_lines");
  return lines;
}

/**
 * Create an order with server-side price and field validation.
 * WALLET orders are charged immediately; MONCASH and NATCASH orders are charged in HTG once payment is verified.
 */
export async function createOrder(input: {
  userId: string;
  items: CartItemInput[];
  currency: Currency;
  method: PaymentMethodKind;
  manualMethodId?: string;
  recipientNote?: string;
  source?: "WEB" | "API";
  /** Shopper's country: services and payment methods not offered there are refused */
  country?: string | null;
}) {
  const settings = await getSettings();
  let manualCurrency: Currency = "HTG";
  if (input.method === "MONCASH" && !moncashAvailable(settings.moncashEnabled)) throw new OrderError("method_unavailable");
  if (input.method === "NATCASH" && !settings.natcashEnabled) throw new OrderError("method_unavailable");
  if (input.method === "CARD" && !cardAvailable(settings.cardEnabled)) throw new OrderError("method_unavailable");
  if (input.method === "MANUAL") {
    const m = input.manualMethodId ? await prisma.manualMethod.findUnique({ where: { id: input.manualMethodId } }) : null;
    if (!m || !m.isEnabled || !m.allowOrders) throw new OrderError("method_unavailable");
    manualCurrency = m.currency;
  }
  if (input.country !== undefined) {
    const id = input.method === "MANUAL" ? `MANUAL:${input.manualMethodId}` : input.method;
    if (!(await methodAllowed(id, input.country, "orders"))) throw new OrderError("method_unavailable");
  }
  // Wallet: the currency the customer picked. Otherwise the method's own currency (MonCash/NatCash HTG, card USD).
  const currency: Currency =
    input.method === "WALLET" ? input.currency : input.method === "CARD" ? "USD" : input.method === "MANUAL" ? manualCurrency : "HTG";

  const lines = await buildLines(input.userId, input.items, currency, settings.htgPerUsd, input.country);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const totalHtg = lines.reduce((s, l) => s + priceIn(l.unitUsd, "HTG", settings.htgPerUsd) * l.quantity, 0);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (user.status !== "ACTIVE") throw new OrderError("account_restricted");

  const order = await prisma.$transaction(async (tx) => {
    await assertWithinNewAccountLimit(tx, user, totalHtg, settings);
    const created = await tx.order.create({
      data: {
        userId: input.userId,
        currency,
        subtotal,
        total: subtotal,
        rateUsed: new Prisma.Decimal(settings.htgPerUsd),
        paymentMethod: input.method,
        manualMethodId: input.method === "MANUAL" ? input.manualMethodId : null,
        recipientNote: input.recipientNote?.slice(0, 300) || null,
        accessToken: randomToken(),
        source: input.source ?? "WEB",
        items: {
          create: lines.map(({ unitUsd: _u, ...l }) => ({ ...l, fieldValues: l.fieldValues as Prisma.InputJsonValue })),
        },
      },
    });
    await addEvent(tx, created.id, "AWAITING_PAYMENT", `Payment method: ${input.method}`);

    if (totalHtg >= settings.reviewOrderThresholdHtg) {
      await flag(tx, "High-value order: review before release", { userId: input.userId, orderId: created.id });
    }

    if (input.method === "WALLET") {
      await chargeOrder(tx, created);
      await tx.order.update({ where: { id: created.id }, data: { status: "PAID", paidAt: new Date() } });
      await addEvent(tx, created.id, "PAID", "Paid from wallet");
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

  if (input.method === "WALLET") {
    if (order.source === "WEB") await notify(order.userId, "order_paid", { number: order.number }, `/account/orders/${order.id}`);
    await fulfillOrder(order.id);
  }
  return order;
}

/**
 * Close the order once every line is final: all delivered → FULFILLED, all refunded → REFUNDED,
 * a mix → FULFILLED (the refunded lines are already back in the wallet). Returns the new status, or null.
 */
export async function settleOrder(tx: Tx, orderId: string, actorId?: string | null): Promise<OrderStatus | null> {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { status: true } });
  if (items.some((i) => i.status === "PENDING")) return null;
  const delivered = items.some((i) => i.status === "DELIVERED");
  const status: OrderStatus = delivered ? "FULFILLED" : "REFUNDED";
  const r = await tx.order.updateMany({
    where: { id: orderId, status: { in: ["PAID", "PROCESSING", "FAILED"] } },
    data: { status, ...(delivered ? { fulfilledAt: new Date() } : {}) },
  });
  if (r.count === 0) return null;
  await addEvent(tx, orderId, status, undefined, actorId);
  return status;
}

async function afterSettle(orderId: string, status: OrderStatus | null) {
  if (!status) return;
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (o.source === "API") return; // resellers poll the API; no notifications per order
  if (status === "FULFILLED") {
    await notify(o.userId, "order_fulfilled", { number: o.number }, `/account/orders/${o.id}`);
    await maybeRewardReferral(o.userId).catch((e) => console.error("referral reward failed", e));
  } else {
    await notify(o.userId, "order_refunded", { number: o.number }, `/account/orders/${o.id}`);
  }
}

/**
 * Deliver what can be delivered automatically. Code-inventory lines get codes assigned; supplier lines are
 * sent to their supplier; manual lines wait in the staff queue. Orders with an open risk flag wait for review.
 */
export async function fulfillOrder(orderId: string, actorId?: string | null) {
  const openFlags = await prisma.riskFlag.count({ where: { orderId, status: "OPEN" } });

  const result = await prisma.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{ id: string; status: OrderStatus }[]>`
      SELECT id, status FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (!order || !["PAID", "PROCESSING"].includes(order.status)) return null;

    if (openFlags > 0) {
      if (order.status === "PAID") {
        await tx.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } });
        await addEvent(tx, orderId, "PROCESSING", "Held for review");
      }
      return { status: null, held: true };
    }

    const items = await tx.orderItem.findMany({ where: { orderId, status: "PENDING" }, include: { variant: { include: { product: true } } } });
    for (const item of items) {
      if (item.variant.product.fulfillmentType !== "CODE_INVENTORY") continue;
      const codes = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "CodeItem" WHERE "variantId" = ${item.variantId} AND status = 'AVAILABLE'
        ORDER BY "createdAt" LIMIT ${item.quantity} FOR UPDATE SKIP LOCKED`;
      if (codes.length < item.quantity) continue; // stays pending; staff restocks or fulfills manually
      // Each code row holds a single orderItemId and is locked above, so it can never go to two orders.
      for (const c of codes) {
        await tx.codeItem.update({
          where: { id: c.id },
          data: { status: "ASSIGNED", assignedAt: new Date(), orderItemId: item.id },
        });
      }
      await tx.orderItem.update({ where: { id: item.id }, data: { status: "DELIVERED", finishedAt: new Date() } });
    }

    const status = await settleOrder(tx, orderId, actorId);
    if (!status && order.status === "PAID") {
      await tx.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } });
      await addEvent(tx, orderId, "PROCESSING", "In progress");
    }
    return { status, held: false };
  });

  if (result && !result.held) {
    await afterSettle(orderId, result.status);
    if (!result.status) {
      const { dispatchOrder } = await import("./suppliers/dispatch");
      await dispatchOrder(orderId);
    }
  }
  return result ? { fulfilled: result.status === "FULFILLED" } : null;
}

/** Staff marks a line delivered with the result shown to the customer (unlock code, report…). */
export async function deliverItemManually(itemId: string, note: string, actorId: string | null) {
  const status = await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId } });
    if (item.status !== "PENDING") throw new OrderError("not_pending");
    await tx.orderItem.update({ where: { id: itemId }, data: { status: "DELIVERED", finishedAt: new Date(), deliveryNote: note.slice(0, 5000) } });
    return { orderId: item.orderId, status: await settleOrder(tx, item.orderId, actorId) };
  });
  await afterSettle(status.orderId, status.status);
  return status;
}

/**
 * Reject one line and refund it to the wallet (staff or a supplier rejection). Idempotent: a line that is
 * already refunded or delivered is left alone and false is returned.
 */
export async function rejectItem(itemId: string, actorId: string | null, reason: string) {
  const out = await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string; status: string }[]>`SELECT id, status FROM "OrderItem" WHERE id = ${itemId} FOR UPDATE`;
    if (!row || row.status !== "PENDING") return null;
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId }, include: { order: true } });
    if (["PAID", "PROCESSING", "FAILED"].includes(item.order.status)) {
      await refundItemToWallet(tx, item.order, item, actorId, reason);
    }
    await tx.orderItem.update({ where: { id: itemId }, data: { status: "FAILED", refundedAt: new Date(), finishedAt: new Date(), deliveryNote: reason.slice(0, 5000) } });
    return { orderId: item.orderId, status: await settleOrder(tx, item.orderId, actorId) };
  });
  if (out) await afterSettle(out.orderId, out.status);
  return !!out;
}

/** Cancel/refund: an unpaid order is canceled; a paid one has every line not yet delivered refunded to the wallet. */
export async function refundOrCancel(orderId: string, actorId: string | null, reason: string) {
  const unpaid = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (["AWAITING_PAYMENT", "PAYMENT_REVIEW"].includes(order.status)) {
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELED" } });
      await addEvent(tx, orderId, "CANCELED", reason, actorId);
      return true;
    }
    if (!["PAID", "PROCESSING", "FAILED"].includes(order.status)) throw new OrderError("not_refundable");
    // A line already with a supplier must be canceled there first, or we would refund work we still pay for.
    const live = await tx.supplierOrder.count({ where: { orderItem: { orderId, status: "PENDING" }, status: { in: ["SUBMITTING", "WAITING", "IN_PROCESS", "UNKNOWN"] } } });
    if (live > 0 && actorId === null) throw new OrderError("with_supplier");
    return false;
  });
  if (unpaid) return "canceled" as const;
  const pending = await prisma.orderItem.findMany({ where: { orderId, status: "PENDING" }, select: { id: true } });
  if (pending.length === 0) throw new OrderError("partially_delivered");
  for (const p of pending) await rejectItem(p.id, actorId, reason);
  return "refunded" as const;
}

/** Codes are only decrypted for the order owner (or staff with codes.reveal) and every reveal is audited by the caller. */
export function revealCode(encrypted: string) {
  return decrypt(encrypted);
}

export function itemTitle(item: { productName: unknown; variantName: unknown }, locale: string) {
  const p = t(item.productName, locale);
  const v = t(item.variantName, locale);
  return v && v !== p ? `${p} — ${v}` : p;
}

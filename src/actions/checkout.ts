"use server";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { cartSchema, createOrder, OrderError, type FieldDef } from "@/lib/orders";
import { InsufficientFundsError } from "@/lib/ledger";
import { LimitExceededError } from "@/lib/risk";
import { createMoncashPayment } from "@/lib/payments/moncash";
import { z } from "zod";
import { mustVerifyEmail } from "@/lib/verify-email";
import { shopperCountry } from "@/lib/prefs";
import { startCardPayment } from "@/lib/payments/start";
import { KycRequiredError } from "@/lib/kyc";

const input = z.object({
  items: cartSchema,
  currency: z.enum(["HTG", "USD"]),
  method: z.enum(["WALLET", "MONCASH", "NATCASH", "MANUAL", "CARD"]),
  manualMethodId: z.string().max(64).optional(),
  note: z.string().max(300).optional(),
});

export type PlaceOrderResult = { ok: true; orderId: string; redirect?: string } | { ok: false; error: string; kyc?: { level: string | null; message: string } };

export async function placeOrder(raw: unknown): Promise<PlaceOrderResult> {
  let user;
  try {
    user = await assertUser();
  } catch {
    return { ok: false, error: "signin" };
  }
  if (await mustVerifyEmail(user.id)) return { ok: false, error: "verify_email" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_field" };
  const { items, currency, method, note, manualMethodId } = parsed.data;

  try {
    const order = await createOrder({ userId: user.id, items, currency, method, manualMethodId, recipientNote: note, country: await shopperCountry(user) });
    await rememberPlayerIds(user.id, items);

    if (method === "MONCASH") {
      const intent = await prisma.paymentIntent.create({
        data: { userId: user.id, orderId: order.id, provider: "MONCASH", amount: order.total, currency: "HTG" },
      });
      const url = await createMoncashPayment(intent.id, intent.amount);
      return { ok: true, orderId: order.id, redirect: url };
    }
    if (method === "CARD") {
      return { ok: true, orderId: order.id, redirect: await startCardPayment(user, order.total, { orderId: order.id, number: order.number }) };
    }
    return { ok: true, orderId: order.id };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code };
    if (e instanceof KycRequiredError) return { ok: false, error: e.decision.blocked ? "kyc_blocked" : "kyc_required", kyc: { level: e.decision.level?.key ?? null, message: e.decision.message } };
    if (e instanceof InsufficientFundsError) return { ok: false, error: "insufficient" };
    if (e instanceof LimitExceededError) return { ok: false, error: "new_account_limit" };
    console.error("placeOrder failed", e);
    return { ok: false, error: "generic" };
  }
}

/** Save the details typed for a service (username, model…) so repeat orders take one tap. IMEIs are not saved here. */
async function rememberPlayerIds(userId: string, items: z.infer<typeof cartSchema>) {
  const variants = await prisma.productVariant.findMany({ where: { id: { in: items.map((i) => i.variantId) } }, include: { product: true } });
  for (const item of items) {
    const v = variants.find((x) => x.id === item.variantId);
    const defs = (v?.product.fields ?? []) as FieldDef[];
    if (!v || defs.length === 0 || Object.keys(item.fields).length === 0) continue;
    const existing = await prisma.savedPlayerId.findMany({ where: { userId, productId: v.productId } });
    if (existing.some((s) => JSON.stringify(s.values) === JSON.stringify(item.fields))) continue;
    await prisma.savedPlayerId.create({ data: { userId, productId: v.productId, values: item.fields, label: Object.values(item.fields)[0] } });
  }
}

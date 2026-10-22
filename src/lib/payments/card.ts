import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Card payments through Stripe Checkout (hosted page: Visa, Mastercard, Apple Pay, Google Pay).
 * Keys live only in the hosting env: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
 * Without a key it runs in mock mode outside production, so the whole flow can be tested.
 */
export function cardMode(): "mock" | "live" {
  if (process.env.STRIPE_SECRET_KEY) return "live";
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "1") throw new Error("Stripe is not configured");
  return "mock";
}

/** Offered only when switched on in settings and usable here (key set, or mock mode outside production). */
export function cardAvailable(enabledInSettings: boolean) {
  if (!enabledInSettings) return false;
  try {
    cardMode();
    return true;
  } catch {
    return false;
  }
}

async function stripe<T>(path: string, body?: URLSearchParams): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe: ${json.error?.message ?? res.status}`);
  return json;
}

/**
 * Open a Checkout page for one PaymentIntent (our id in client_reference_id and metadata).
 * Returns the Checkout Session id (saved as providerRef) and the URL to send the customer to.
 */
export async function createCardCheckout(opts: { intentId: string; amountUsdCents: number; description: string; email?: string; returnUrl: string; cancelUrl: string }) {
  if (cardMode() === "mock") {
    return { sessionId: `mock_${opts.intentId}`, url: `/api/payments/card/mock?ref=${encodeURIComponent(opts.intentId)}` };
  }
  const p = new URLSearchParams({
    mode: "payment",
    client_reference_id: opts.intentId,
    "metadata[intent]": opts.intentId,
    "payment_intent_data[metadata][intent]": opts.intentId,
    success_url: `${opts.returnUrl}${opts.returnUrl.includes("?") ? "&" : "?"}session={CHECKOUT_SESSION_ID}`,
    cancel_url: opts.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(opts.amountUsdCents),
    "line_items[0][price_data][product_data][name]": opts.description.slice(0, 120),
  });
  if (opts.email) p.set("customer_email", opts.email);
  const s = await stripe<{ id: string; url: string }>("checkout/sessions", p);
  return { sessionId: s.id, url: s.url };
}

export type CardSession = { id: string; intentId: string | null; paid: boolean; amount: number; currency: string; paymentIntent: string | null };

export async function retrieveCardSession(sessionId: string): Promise<CardSession> {
  const s = await stripe<{ id: string; client_reference_id: string | null; payment_status: string; amount_total: number; currency: string; payment_intent: string | null }>(
    `checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
  return { id: s.id, intentId: s.client_reference_id, paid: s.payment_status === "paid", amount: s.amount_total, currency: s.currency, paymentIntent: s.payment_intent };
}

/** Checks the Stripe-Signature header (t=…,v1=…) against the raw body; rejects events older than 5 minutes. */
export function verifyStripeSignature(raw: string, header: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .some((kv) => {
      const sig = Buffer.from(kv.slice(3), "hex");
      const exp = Buffer.from(expected, "hex");
      return sig.length === exp.length && timingSafeEqual(sig, exp);
    });
}

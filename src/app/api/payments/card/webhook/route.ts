import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/payments/card";
import { verifyCardIntent } from "@/lib/payments/verify";

/**
 * Stripe webhook (events: checkout.session.completed, checkout.session.async_payment_succeeded).
 * Point it at https://<site>/api/payments/card/webhook and put its signing secret in STRIPE_WEBHOOK_SECRET.
 * The event only tells us which payment to re-check; the amount is always read back from Stripe.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const event = JSON.parse(raw) as { type: string; data: { object: { id: string; client_reference_id?: string | null } } };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const ref = event.data.object.client_reference_id;
    const intent = ref ? await prisma.paymentIntent.findUnique({ where: { id: ref } }) : null;
    if (intent && intent.providerRef === event.data.object.id) {
      try {
        await verifyCardIntent(intent.id);
      } catch (e) {
        console.error("card webhook settle failed", intent.id, e);
        return NextResponse.json({ error: "retry" }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: true });
}

import "server-only";
import { prisma } from "../db";
import { siteUrl } from "../site-url";
import { createCardCheckout } from "./card";

/** Create a card PaymentIntent (USD cents) for an order or a top-up and return the Stripe page URL. */
export async function startCardPayment(user: { id: string; email: string }, amountUsdCents: number, order?: { orderId: string; number: number }) {
  const intent = await prisma.paymentIntent.create({ data: { userId: user.id, orderId: order?.orderId, provider: "CARD", amount: amountUsdCents, currency: "USD" } });
  const back = `${siteUrl()}/api/payments/card/return?ref=${intent.id}`;
  const { sessionId, url } = await createCardCheckout({
    intentId: intent.id,
    amountUsdCents,
    description: order ? `GSMLite order #${order.number}` : "GSMLite wallet top-up",
    email: user.email,
    returnUrl: back,
    cancelUrl: back,
  });
  await prisma.paymentIntent.update({ where: { id: intent.id }, data: { providerRef: sessionId } });
  return url;
}

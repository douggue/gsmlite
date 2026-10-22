import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCardIntent } from "@/lib/payments/verify";
import { routing } from "@/i18n/routing";

/** Customer lands here after the Stripe page. We verify with Stripe, then send them to their order or wallet. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const saved = req.cookies.get("NEXT_LOCALE")?.value;
  let locale: string = saved && (routing.locales as readonly string[]).includes(saved) ? saved : routing.defaultLocale;
  const ref = url.searchParams.get("ref");
  if (!ref) return NextResponse.redirect(new URL(`/${locale}/account`, url));
  try {
    await verifyCardIntent(ref);
  } catch (e) {
    console.error("card verification failed", e);
  }
  const intent = await prisma.paymentIntent.findUnique({ where: { id: ref }, include: { user: { select: { locale: true } } } });
  if (!saved && intent?.user?.locale) locale = intent.user.locale;
  const dest = intent?.orderId ? `/${locale}/account/orders/${intent.orderId}` : `/${locale}/account/wallet`;
  return NextResponse.redirect(new URL(dest, url));
}

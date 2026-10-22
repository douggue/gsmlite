import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cardMode } from "@/lib/payments/card";
import { getUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";

/** Development stand-in for the Stripe card page. Disabled as soon as STRIPE_SECRET_KEY is set. */
export async function GET(req: NextRequest) {
  if (cardMode() !== "mock") return new NextResponse("Not found", { status: 404 });
  const intent = await prisma.paymentIntent.findUnique({ where: { id: req.nextUrl.searchParams.get("ref") ?? "" } });
  if (!intent) return new NextResponse("Unknown payment", { status: 404 });
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card (test)</title>
<style>body{font-family:system-ui;background:#f4f5f2;margin:0;display:grid;place-items:center;min-height:100vh}main{background:#fff;padding:28px;border-radius:16px;max-width:360px;width:90%;box-shadow:0 8px 30px #0002}h1{margin:0 0 4px}button{width:100%;padding:14px;border:0;border-radius:10px;font-size:16px;font-weight:700;margin-top:10px;cursor:pointer}.ok{background:#1f7a4d;color:#fff}.no{background:#eee}</style></head>
<body><main><h1>Card payment</h1><p><b>Test mode.</b> No real money moves.</p><p>Amount: <b>${formatMoney(intent.amount, "USD")}</b></p>
<form method="post"><input type="hidden" name="ref" value="${intent.id}"><button class="ok" name="action" value="approve">Pay</button><button class="no" name="action" value="cancel">Cancel</button></form></main></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  if (cardMode() !== "mock") return new NextResponse("Not found", { status: 404 });
  const form = await req.formData();
  const intent = await prisma.paymentIntent.findUnique({ where: { id: String(form.get("ref")) } });
  const user = await getUser();
  if (!intent || !user || user.id !== intent.userId) return new NextResponse("Forbidden", { status: 403 });
  if (form.get("action") === "approve") {
    await prisma.auditEvent.create({ data: { action: "card.mock.approved", targetType: "PaymentIntent", targetId: intent.id, actorId: user.id } });
  }
  return NextResponse.redirect(new URL(`/api/payments/card/return?ref=${intent.id}`, req.nextUrl), 303);
}

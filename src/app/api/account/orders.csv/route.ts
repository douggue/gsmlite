import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { csv } from "@/lib/csv";
import { t } from "@/lib/text";

/** The signed-in customer's orders as CSV, one row per IMEI/line, with the same search and filter as the orders page. */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });
  if (!(await rateLimit(`orders-csv:${user.id}`, 10, 600))) return new NextResponse("Too many downloads, try again in a few minutes", { status: 429 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  const f = req.nextUrl.searchParams.get("f");
  const digits = q.replace(/\D/g, "");
  const and: Prisma.OrderWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        ...(digits && digits.length <= 9 ? [{ number: Number(digits) }] : []),
        ...(digits.length >= 4 ? [{ items: { some: { identifier: { contains: digits } } } }] : []),
        { recipientNote: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  if (f === "working") and.push({ items: { some: { status: "PENDING" } } });
  if (f === "done") and.push({ items: { some: { status: "DELIVERED" } } });
  if (f === "refunded") and.push({ items: { some: { status: "FAILED" } } });
  const orders = await prisma.order.findMany({
    where: { userId: user.id, AND: and },
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: { items: { select: { productName: true, variantName: true, identifier: true, quantity: true, unitPrice: true, status: true, deliveryNote: true, finishedAt: true } } },
  });
  const loc = user.locale || "en";
  const rows: (string | number | null)[][] = [["order", "date", "order status", "service", "option", "imei", "quantity", "price", "currency", "line status", "result", "finished", "note"]];
  for (const o of orders) {
    for (const i of o.items) {
      rows.push([o.number, o.createdAt.toISOString(), o.status, t(i.productName, loc), t(i.variantName, loc), i.identifier, i.quantity, (i.unitPrice / 100).toFixed(2), o.currency, i.status, i.deliveryNote, i.finishedAt?.toISOString() ?? null, o.recipientNote]);
    }
  }
  return new NextResponse(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gsmlite-orders.csv"`, "cache-control": "no-store" } });
}

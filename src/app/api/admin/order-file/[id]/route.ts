import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { readEncryptedDocument } from "@/lib/storage";

/** Staff open a file a customer attached to an order. Every download is in the audit log. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let staff;
  try {
    staff = await assertStaff("orders.view");
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const f = await prisma.orderFile.findUnique({ where: { id } });
  if (!f || f.deletedAt) return new NextResponse("Not found", { status: 404 });
  await audit(staff.id, "order.file.view", "OrderFile", f.id, { orderItemId: f.orderItemId, userId: f.userId });
  const body = await readEncryptedDocument(f.path);
  const inline = f.mime.startsWith("image/") || f.mime === "application/pdf";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": f.mime,
      "cache-control": "private, no-store",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${f.name.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
    },
  });
}

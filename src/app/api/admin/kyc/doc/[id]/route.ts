import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { readEncryptedDocument } from "@/lib/storage";

/** Staff with the KYC permission open a document; every opening is written to KycView and the audit log. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let staff;
  try {
    staff = await assertStaff("kyc.review");
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const doc = await prisma.kycDocument.findUnique({ where: { id }, include: { submission: { select: { userId: true } } } });
  if (!doc || doc.deletedAt) return new NextResponse("Not found", { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await prisma.kycView.create({ data: { documentId: doc.id, staffId: staff.id, ip } });
  await audit(staff.id, "kyc.document.view", "KycDocument", doc.id, { userId: doc.submission.userId, kind: doc.kind });
  const body = await readEncryptedDocument(doc.path);
  return new NextResponse(new Uint8Array(body), {
    headers: { "content-type": doc.mime, "cache-control": "private, no-store", "content-disposition": "inline", "x-content-type-options": "nosniff" },
  });
}

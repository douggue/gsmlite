"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { saveEncryptedDocument, UploadError } from "@/lib/storage";
import type { Requirement } from "@/lib/kyc";

type R = { ok: true } | { ok: false; error: string; field?: number };
const FILE_TYPES = new Set(["id_doc", "selfie", "video_selfie", "address_proof", "business_doc", "shop_photo", "receipt", "upload"]);

/** Customer sends the documents and answers for one level. An earlier waiting request for that level is replaced. */
export async function submitKyc(form: FormData): Promise<R> {
  const user = await assertUser();
  if (!(await rateLimit(`kyc:${user.id}`, 5, 3600))) return { ok: false, error: "busy" };
  const level = await prisma.kycLevel.findFirst({ where: { id: String(form.get("levelId") ?? ""), isActive: true } });
  if (!level) return { ok: false, error: "level" };
  const reqs = (level.requirements as Requirement[]) ?? [];
  const docs: { kind: string; file: File }[] = [];
  const answers: Record<string, string> = {};
  for (const [i, r] of reqs.entries()) {
    if (r.type === "email" || r.type === "phone") continue;
    if (FILE_TYPES.has(r.type)) {
      const files = form.getAll(`doc_${i}`).filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
      if (r.required && files.length === 0) return { ok: false, error: "missing", field: i };
      for (const f of files) docs.push({ kind: r.type, file: f });
    } else {
      const v = String(form.get(`answer_${i}`) ?? "").trim().slice(0, 1000);
      if (r.required && !v) return { ok: false, error: "missing", field: i };
      if (v) answers[String(i)] = v;
    }
  }
  const saved: { kind: string; path: string; mime: string; size: number }[] = [];
  try {
    for (const d of docs) saved.push({ kind: d.kind, ...(await saveEncryptedDocument(d.file, `kyc/${user.id}`)) });
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message === "size" ? "size" : "type" };
    throw e;
  }
  await prisma.$transaction(async (tx) => {
    await tx.kycSubmission.updateMany({ where: { userId: user.id, levelId: level.id, status: { in: ["PENDING", "NEEDS_MORE"] } }, data: { status: "REJECTED", note: "Replaced by a newer request" } });
    await tx.kycSubmission.create({ data: { userId: user.id, levelId: level.id, answers, documents: { create: saved } } });
  });
  const { staffAlert } = await import("@/lib/marketing");
  await staffAlert(`🪪 KYC request: ${user.name} asks for ${(level.name as Record<string, string>).en ?? level.key}`, "/admin/kyc").catch(() => {});
  revalidatePath("/[locale]/account/verification", "page");
  return { ok: true };
}

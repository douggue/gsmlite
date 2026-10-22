import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_DOC_BYTES, MAX_ORDER_FILE_BYTES, saveEncryptedDocument, saveEncryptedFile, UploadError } from "@/lib/storage";

/**
 * Order form upload (photo, PDF, or any file for "file" fields that accept anything). Signed-in customers only;
 * the file is encrypted and stays private. Returns an id the order form sends back as the field's value.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "signin" }, { status: 401 });
  if (!(await rateLimit(`orderfile:${user.id}`, 20, 3600))) return NextResponse.json({ error: "busy" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "missing" }, { status: 400 });
  const any = form?.get("accept") === "any";
  if (file.size > (any ? MAX_ORDER_FILE_BYTES : MAX_DOC_BYTES)) return NextResponse.json({ error: "size" }, { status: 413 });
  try {
    const saved = any ? { ...(await saveEncryptedFile(file, `orders/${user.id}`)), mime: "application/octet-stream" } : await saveEncryptedDocument(file, `orders/${user.id}`);
    const row = await prisma.orderFile.create({ data: { userId: user.id, path: saved.path, mime: saved.mime, size: saved.size, name: file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120) || "file" } });
    return NextResponse.json({ id: row.id, name: row.name });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message === "storage" ? "storage" : e.message === "size" ? "size" : "type" }, { status: 400 });
    throw e;
  }
}

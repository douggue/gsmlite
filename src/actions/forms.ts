"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { sanitizeFields } from "@/lib/order-form";

type R = { ok: true; message?: string } | { ok: false; error: string };

/** Save the order form of one service (form builder). */
export async function saveProductForm(productId: string, fields: unknown): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const clean = sanitizeFields(fields);
    const p = await prisma.product.update({ where: { id: productId }, data: { fields: clean as unknown as Prisma.InputJsonValue }, select: { slug: true } });
    await audit(staff.id, "product.form", "Product", productId, { fields: clean.map((f) => `${f.key}:${f.type}`) });
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/[locale]/products/${p.slug}`, "page");
    return { ok: true, message: `Saved · ${clean.length} field${clean.length === 1 ? "" : "s"}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { parseAmount } from "@/lib/money";

type R = { ok: true; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });

export async function savePriceGroup(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const id = String(form.get("id") ?? "") || null;
    const name = String(form.get("name") ?? "").trim().slice(0, 40);
    if (name.length < 2) return { ok: false, error: "Give the group a name" };
    const pct = Number(String(form.get("discount") ?? "0").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) return { ok: false, error: "Discount must be between 0 and 90 %" };
    const rule = String(form.get("autoRule") ?? "manual");
    const spend = parseAmount(String(form.get("minSpend") ?? "0") || "0") ?? 0;
    const floor = parseAmount(String(form.get("floor") ?? "0") || "0") ?? 0;
    if (rule === "spend" && spend <= 0) return { ok: false, error: "Set the monthly spending that joins this group" };
    const data = {
      name,
      description: String(form.get("description") ?? "").trim().slice(0, 120) || null,
      discountBps: Math.round(pct * 100),
      autoRule: ["manual", "kyc", "spend"].includes(rule) ? rule : "manual",
      minMonthlySpendUsd: spend,
      floorProfitUsd: floor,
      sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
    };
    const g = id ? await prisma.priceGroup.update({ where: { id }, data }) : await prisma.priceGroup.create({ data });
    await audit(staff.id, id ? "priceGroup.update" : "priceGroup.create", "PriceGroup", g.id, data);
    revalidatePath("/admin/price-groups");
    return { ok: true, message: "Group saved" };
  } catch (e) {
    return fail(e);
  }
}

/** Fixed price for one option in a group (wins over the %). Empty = remove it. */
export async function setGroupPrice(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const priceGroupId = String(form.get("groupId"));
    const variantId = String(form.get("variantId"));
    const raw = String(form.get("price") ?? "").trim();
    if (!raw) {
      await prisma.groupPrice.deleteMany({ where: { priceGroupId, variantId } });
      await audit(staff.id, "priceGroup.price.remove", "PriceGroup", priceGroupId, { variantId });
      revalidatePath("/admin/price-groups");
      return { ok: true, message: "Fixed price removed" };
    }
    const priceUsd = parseAmount(raw);
    if (!priceUsd) return { ok: false, error: "Price like 12.50" };
    await prisma.groupPrice.upsert({ where: { priceGroupId_variantId: { priceGroupId, variantId } }, create: { priceGroupId, variantId, priceUsd }, update: { priceUsd } });
    await audit(staff.id, "priceGroup.price.set", "PriceGroup", priceGroupId, { variantId, priceUsd });
    revalidatePath("/admin/price-groups");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

/** Put a customer in a group (or none) by hand. */
export async function setCustomerGroup(userId: string, groupId: string): Promise<R> {
  try {
    const staff = await assertStaff("customers.manage");
    await prisma.user.update({ where: { id: userId }, data: { priceGroupId: groupId || null } });
    await audit(staff.id, "customer.priceGroup", "User", userId, { groupId: groupId || null });
    revalidatePath(`/admin/customers/${userId}`);
    return { ok: true, message: "Price group changed" };
  } catch (e) {
    return fail(e);
  }
}

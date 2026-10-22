"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertStaff, assertStepUp } from "@/lib/session";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { t } from "@/lib/text";
import { evaluateKyc } from "@/lib/kyc";

type R = { ok: true; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });

/** Approve: the level counts from now (until it expires) and, if the level says so, the customer joins its price group. */
export async function approveKyc(id: string): Promise<R> {
  try {
    const staff = await assertStaff("kyc.review");
    const s = await prisma.kycSubmission.findUnique({ where: { id }, include: { level: true, user: { select: { locale: true } } } });
    if (!s || s.status !== "PENDING") return { ok: false, error: "Already decided" };
    const expiresAt = s.level.validMonths > 0 ? new Date(Date.now() + s.level.validMonths * 30 * 86_400_000) : null;
    await prisma.$transaction(async (tx) => {
      await tx.kycSubmission.update({ where: { id }, data: { status: "APPROVED", reviewedById: staff.id, reviewedAt: new Date(), expiresAt, note: null } });
      if (s.level.joinsGroupId) {
        const [current, target] = await Promise.all([
          tx.user.findUnique({ where: { id: s.userId }, select: { priceGroup: { select: { discountBps: true } } } }),
          tx.priceGroup.findUnique({ where: { id: s.level.joinsGroupId } }),
        ]);
        // Never move someone to a group with a smaller discount than they already have.
        if (target && (current?.priceGroup?.discountBps ?? 0) < target.discountBps) await tx.user.update({ where: { id: s.userId }, data: { priceGroupId: target.id } });
      }
    });
    await audit(staff.id, "kyc.approve", "KycSubmission", id, { userId: s.userId, level: s.level.key });
    await notify(s.userId, "kyc_approved", { level: t(s.level.name, s.user.locale) }, "/account/verification");
    revalidatePath("/admin/kyc");
    return { ok: true, message: "Approved" };
  } catch (e) {
    return fail(e);
  }
}

/** Ask for a new photo (the customer can send again) or reject with a reason. The reason is shown to the customer. */
export async function decideKyc(id: string, decision: "NEEDS_MORE" | "REJECTED", reason: string): Promise<R> {
  try {
    const staff = await assertStaff("kyc.review");
    const why = reason.trim().slice(0, 500);
    if (!why) return { ok: false, error: "Write the reason the customer will read" };
    const r = await prisma.kycSubmission.updateMany({ where: { id, status: "PENDING" }, data: { status: decision, note: why, reviewedById: staff.id, reviewedAt: new Date() } });
    if (!r.count) return { ok: false, error: "Already decided" };
    const s = await prisma.kycSubmission.findUniqueOrThrow({ where: { id } });
    await audit(staff.id, decision === "REJECTED" ? "kyc.reject" : "kyc.needs_more", "KycSubmission", id, { userId: s.userId, reason: why });
    await notify(s.userId, decision === "REJECTED" ? "kyc_rejected" : "kyc_needs_more", { reason: why }, "/account/verification");
    revalidatePath("/admin/kyc");
    return { ok: true, message: decision === "REJECTED" ? "Rejected" : "Asked for a new photo" };
  } catch (e) {
    return fail(e);
  }
}

const L = z.record(z.string(), z.string().max(400));
const levelSchema = z.object({
  id: z.string().optional(),
  key: z.string().regex(/^[a-z0-9_-]{2,30}$/),
  name: L,
  description: L,
  rank: z.number().int().min(1).max(20),
  validMonths: z.number().int().min(0).max(120),
  joinsGroupId: z.string().nullable(),
  isActive: z.boolean(),
  requirements: z.array(z.object({ type: z.string().max(30), label: L, required: z.boolean() })).max(15),
});

export async function saveKycLevel(raw: unknown): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    await assertStepUp();
    const p = levelSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Check the level fields" };
    const { id, ...data } = p.data;
    const row = id
      ? await prisma.kycLevel.update({ where: { id }, data: { ...data, requirements: data.requirements as Prisma.InputJsonValue } })
      : await prisma.kycLevel.create({ data: { ...data, requirements: data.requirements as Prisma.InputJsonValue } });
    await audit(staff.id, id ? "kyc.level.update" : "kyc.level.create", "KycLevel", row.id, { key: row.key });
    revalidatePath("/admin/kyc/settings");
    return { ok: true, message: "Level saved" };
  } catch (e) {
    return fail(e);
  }
}

const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  sortOrder: z.number().int(),
  isEnabled: z.boolean(),
  conditions: z.array(z.object({ field: z.string().max(40), op: z.enum(["gt", "gte", "lt", "lte", "eq", "in", "not_in", "true"]), value: z.union([z.string().max(300), z.number()]).optional() })).min(1).max(8),
  action: z.enum(["require_level", "review", "block", "no_bonus"]),
  levelId: z.string().nullable(),
  message: L,
});

export async function saveKycRule(raw: unknown): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    await assertStepUp();
    const p = ruleSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: "Each rule needs a name and at least one condition" };
    const { id, ...data } = p.data;
    if (data.action === "require_level" && !data.levelId) return { ok: false, error: "Pick the level this rule asks for" };
    const row = id
      ? await prisma.kycRule.update({ where: { id }, data: { ...data, conditions: data.conditions as Prisma.InputJsonValue } })
      : await prisma.kycRule.create({ data: { ...data, conditions: data.conditions as Prisma.InputJsonValue } });
    await audit(staff.id, id ? "kyc.rule.update" : "kyc.rule.create", "KycRule", row.id, { name: row.name, action: row.action, isEnabled: row.isEnabled });
    revalidatePath("/admin/kyc/settings");
    return { ok: true, message: "Rule saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteKycRule(id: string): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    await assertStepUp();
    await prisma.kycRule.delete({ where: { id } });
    await audit(staff.id, "kyc.rule.delete", "KycRule", id);
    revalidatePath("/admin/kyc/settings");
    return { ok: true, message: "Rule deleted" };
  } catch (e) {
    return fail(e);
  }
}

/** "Test a rule": what would happen if this customer did this now. Nothing is changed. */
export async function testKyc(form: FormData): Promise<R> {
  try {
    await assertStaff("settings.manage");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: false, error: "No customer with that email" };
    const amount = Math.round(Number(String(form.get("amount") ?? "0").replace(",", ".")) * 100) || 0;
    const d = await evaluateKyc(user.id, {
      action: (String(form.get("action")) as "topup" | "order" | "technician") || "order",
      amountUsd: amount,
      method: String(form.get("method") ?? "") || undefined,
      country: user.country,
    }, "en");
    if (d.ok) return { ok: true, message: `Allowed${d.review ? " · goes to review" : ""}${d.noBonus ? " · no bonus" : ""}${d.rule ? ` (rule: ${d.rule})` : ""}` };
    return { ok: false, error: `${d.blocked ? "Blocked" : `Needs level “${d.level?.name}”`} by rule “${d.rule}”${d.message ? `: ${d.message}` : ""}` };
  } catch (e) {
    return fail(e);
  }
}

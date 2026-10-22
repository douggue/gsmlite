import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { evaluateKyc, test as testCondition, userKycRank } from "@/lib/kyc";

afterAll(() => prisma.$disconnect());
const rand = () => Math.random().toString(36).slice(2, 10);

describe("KYC rules", () => {
  it("tests single conditions", () => {
    expect(testCondition({ field: "amount", op: "gt", value: 10000 }, 15000)).toBe(true);
    expect(testCondition({ field: "method", op: "eq", value: "card" }, "CARD")).toBe(true);
    expect(testCondition({ field: "country", op: "in", value: "HT, DO" }, "do")).toBe(true);
    expect(testCondition({ field: "category", op: "in", value: "c1,c2" }, ["x", "c2"])).toBe(true);
    expect(testCondition({ field: "country", op: "not_in", value: "US" }, "HT")).toBe(true);
    expect(testCondition({ field: "same_device", op: "true" }, false)).toBe(false);
  });

  it("asks for a level until an approved request meets it, and sends to review", async () => {
    const level = await prisma.kycLevel.create({ data: { key: `v-${rand()}`, name: { en: "Verified" }, rank: 50, requirements: [{ type: "id_doc", label: { en: "ID" }, required: true }] } });
    const user = await prisma.user.create({ data: { id: `u_${rand()}`, name: "K", email: `${rand()}@t.test` } });
    const rules = [
      { id: "r1", sortOrder: 1, isEnabled: true, name: "big top-ups", action: "require_level", levelId: level.id, level, message: { en: "Verify first" }, conditions: [{ field: "action", op: "eq", value: "topup" }, { field: "amount", op: "gt", value: 10000 }], createdAt: new Date(), updatedAt: new Date() },
      { id: "r2", sortOrder: 2, isEnabled: true, name: "card review", action: "review", levelId: null, level: null, message: {}, conditions: [{ field: "method", op: "eq", value: "CARD" }], createdAt: new Date(), updatedAt: new Date() },
    ];
    expect(await evaluateKyc(user.id, { action: "topup", amountUsd: 5000 }, "en", rules)).toEqual({ ok: true, review: false, noBonus: false });
    expect(await evaluateKyc(user.id, { action: "topup", amountUsd: 20000 }, "en", rules)).toMatchObject({ ok: false, blocked: false, message: "Verify first", level: { key: level.key } });
    await prisma.kycSubmission.create({ data: { userId: user.id, levelId: level.id, status: "APPROVED" } });
    expect((await userKycRank(user.id)).rank).toBeGreaterThanOrEqual(50);
    expect(await evaluateKyc(user.id, { action: "topup", amountUsd: 20000, method: "CARD" }, "en", rules)).toMatchObject({ ok: true, review: true, rule: "card review" });
  });
});

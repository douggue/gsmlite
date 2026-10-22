import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { importTacCsv, parseModel, runFreeCheck } from "@/lib/free-check";
import { setSetting } from "@/lib/settings";
import { creditChecksForOrder } from "@/lib/check-credit";
import { getBalances } from "@/lib/ledger";

afterAll(() => prisma.$disconnect());
const rand = () => Math.random().toString(36).slice(2, 10);

describe("free IMEI check", () => {
  it("reads model and brand from supplier results", () => {
    expect(parseModel("IMEI: 35...\nModel: iPhone 13 Pro\nCarrier: AT&T")).toEqual({ brand: "Apple", model: "iPhone 13 Pro" });
    expect(parseModel("Manufacturer: Samsung\nModel Name: Galaxy A54")).toEqual({ brand: "Samsung", model: "Galaxy A54" });
    expect(parseModel("Blacklist: clean")).toEqual({ brand: null, model: null });
  });

  it("imports a TAC list and answers from it, within the daily limit", async () => {
    expect(await importTacCsv('tac,brand,model\n"49015420","Apple","iPhone Test"\nbad,row,x\n')).toBe(1);
    await setSetting("freeChecksPerDay", 2);
    await setSetting("freeCheckVariantId", "");
    const user = await prisma.user.create({ data: { id: `u_${rand()}`, name: "Check", email: `${rand()}@t.test` } });
    const r = await runFreeCheck(user.id, null, "49 015420 323751 8");
    expect(r).toMatchObject({ ok: true, valid: true, brand: "Apple", model: "iPhone Test", left: 1 });
    expect(await runFreeCheck(user.id, null, "490154203237519")).toMatchObject({ ok: true, valid: false, left: 0 });
    expect(await runFreeCheck(user.id, null, "490154203237518")).toEqual({ ok: false, error: "limit" });
  });
});

describe("check price comes off the unlock", () => {
  it("credits a recent check of the same IMEI once", async () => {
    await setSetting("checkCreditDays", 7);
    const user = await prisma.user.create({ data: { id: `u_${rand()}`, name: "Credit", email: `${rand()}@t.test` } });
    const checks = await prisma.category.upsert({ where: { slug: "imei-checks-t" }, create: { slug: "imei-checks-t", name: { en: "IMEI checks" } }, update: {} });
    const unlocks = await prisma.category.upsert({ where: { slug: "carrier-unlock-t" }, create: { slug: "carrier-unlock-t", name: { en: "Unlock" } }, update: {} });
    const mk = (categoryId: string) => prisma.product.create({ data: { slug: `p-${rand()}`, categoryId, name: { en: "P" }, description: {}, isPublished: true, variants: { create: { name: { en: "V" }, priceUsd: 150 } } }, include: { variants: true } });
    const [check, unlock] = [await mk(checks.id), await mk(unlocks.id)];
    const imei = "356938035643809";
    const line = (variantId: string, status: "DELIVERED" | "PENDING", unitPrice: number) => ({ variantId, productName: { en: "P" }, variantName: { en: "V" }, quantity: 1, unitPrice, identifier: imei, status, ...(status === "DELIVERED" ? { finishedAt: new Date() } : {}) });
    await prisma.order.create({ data: { userId: user.id, currency: "USD", subtotal: 150, total: 150, paymentMethod: "WALLET", accessToken: rand(), status: "FULFILLED", paidAt: new Date(), items: { create: [line(check.variants[0].id, "DELIVERED", 150)] } } });
    const o = await prisma.order.create({ data: { userId: user.id, currency: "USD", subtotal: 2500, total: 2500, paymentMethod: "WALLET", accessToken: rand(), status: "PAID", paidAt: new Date(), items: { create: [line(unlock.variants[0].id, "PENDING", 2500)] } } });
    expect(await creditChecksForOrder(o.id)).toBe(1);
    expect(await creditChecksForOrder(o.id)).toBe(0);
    expect((await getBalances(prisma, user.id)).USD.available).toBe(150);
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getBalances } from "@/lib/ledger";
import { completePayment } from "@/lib/payments/complete";
import { setSetting } from "@/lib/settings";

afterAll(() => prisma.$disconnect());

describe("top-up bonus", () => {
  it("pays the first-top-up bonus once, then the regular bonus only above the minimum", async () => {
    await setSetting("topupBonus", { firstPct: 10, pct: 3, minUsd: 5000 });
    await setSetting("holdThresholdUsd", 10_000_000);
    const user = await prisma.user.create({ data: { id: `u_${Math.random().toString(36).slice(2)}`, name: "Bonus", email: `${Math.random()}@t.test` } });
    const pay = async (amount: number) => {
      const i = await prisma.paymentIntent.create({ data: { userId: user.id, provider: "MANUAL", amount, currency: "USD", status: "REVIEW", providerRef: `r${Math.random()}` } });
      await completePayment(i.id, {});
      await completePayment(i.id, {}); // twice: no second bonus
    };
    await pay(20_00); // first: +10 %
    expect((await getBalances(prisma, user.id)).USD.available).toBe(22_00);
    await pay(20_00); // under $50: no bonus
    expect((await getBalances(prisma, user.id)).USD.available).toBe(42_00);
    await pay(100_00); // ≥ $50: +3 %
    expect((await getBalances(prisma, user.id)).USD.available).toBe(145_00);
  });
});

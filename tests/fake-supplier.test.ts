import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getBalances, post, systemAccount, walletAccount } from "@/lib/ledger";
import { chargeOrder } from "@/lib/wallet";
import { checkSupplierOrder, dispatchOrder } from "@/lib/suppliers/dispatch";
// @ts-expect-error plain JS helper shared with the command line
import { startFakeSupplier } from "../scripts/fake-supplier.mjs";

const rand = () => Math.random().toString(36).slice(2, 10);
let fake: { url: string; close: () => Promise<void>; log: { action: string }[] };
beforeAll(async () => {
  fake = await startFakeSupplier({ port: 0 });
});
afterAll(async () => {
  await fake.close();
  await prisma.$disconnect();
});

/** A paid wallet order with one line per [serviceId, IMEI], each priced $25. */
async function paidOrder(lines: [string, string][]) {
  const user = await prisma.user.create({ data: { id: `u_${rand()}`, name: "Fake API", email: `${rand()}@t.test` } });
  await prisma.$transaction(async (tx) => {
    const w = await walletAccount(tx, user.id, "USD");
    const c = await systemAccount(tx, "clearing", "USD", "test");
    await post(tx, { type: "DEPOSIT", idempotencyKey: `f:${user.id}`, description: "t", entries: [{ accountId: c.id, currency: "USD", amount: -500_00 }, { accountId: w.id, currency: "USD", amount: 500_00 }] });
  });
  const supplier = await prisma.supplier.create({ data: { name: `Fake ${rand()}`, baseUrl: fake.url, username: "demo", apiKeyEncrypted: encrypt("demo-key") } });
  const category = await prisma.category.upsert({ where: { slug: "test-cat" }, create: { slug: "test-cat", name: { en: "Test" } }, update: {} });
  const services = [...new Set(lines.map(([s]) => s))];
  const product = await prisma.product.create({
    data: {
      slug: `p-${rand()}`, categoryId: category.id, name: { en: "Unlock" }, description: {}, isPublished: true, fulfillmentType: "SUPPLIER_API", serviceType: "IMEI",
      variants: { create: services.map((s) => ({ name: { en: `S${s}` }, priceUsd: 25_00, supplierId: supplier.id, supplierServiceId: s })) },
    },
    include: { variants: true },
  });
  const byService = new Map(product.variants.map((v) => [v.supplierServiceId!, v.id]));
  const order = await prisma.order.create({
    data: {
      userId: user.id, currency: "USD", subtotal: lines.length * 25_00, total: lines.length * 25_00, paymentMethod: "WALLET", accessToken: `t${rand()}`, status: "PROCESSING", paidAt: new Date(),
      items: { create: lines.map(([s, imei]) => ({ variantId: byService.get(s)!, productName: { en: "Unlock" }, variantName: { en: `S${s}` }, quantity: 1, unitPrice: 25_00, identifier: imei })) },
    },
    include: { items: true },
  });
  await prisma.$transaction((tx) => chargeOrder(tx, order));
  return { order, userId: user.id, supplier };
}

const lineFor = async (orderId: string, imei: string) =>
  prisma.orderItem.findFirstOrThrow({ where: { orderId, identifier: imei }, include: { supplierOrders: { orderBy: { createdAt: "desc" }, take: 1 } } });

async function checkAll(orderId: string) {
  const live = await prisma.supplierOrder.findMany({ where: { orderItem: { orderId }, status: { in: ["WAITING", "IN_PROCESS"] } } });
  for (const so of live) await checkSupplierOrder(so);
}

describe("orders against a fake Dhru supplier", () => {
  it("sends each IMEI, delivers the good one, refunds the blacklisted one, and settles the order", async () => {
    const { order, userId } = await paidOrder([["101", "356938035643809"], ["101", "490154203237510"]]);
    expect((await getBalances(prisma, userId)).USD.available).toBe(450_00);

    await dispatchOrder(order.id);
    expect((await lineFor(order.id, "356938035643809")).supplierOrders[0].status).toBe("WAITING");

    await checkAll(order.id); // first check: good one in process, bad one refused
    const bad = await lineFor(order.id, "490154203237510");
    expect(bad.status).toBe("FAILED");
    expect((await getBalances(prisma, userId)).USD.available).toBe(475_00); // $25 back for the refused IMEI

    await checkAll(order.id); // second check: result
    const good = await lineFor(order.id, "356938035643809");
    expect(good.status).toBe("DELIVERED");
    expect(good.deliveryNote).toContain("Unlocked successfully");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("FULFILLED");
  });

  it("keeps the line waiting (no refund) when our supplier account has no credit, and tells staff", async () => {
    const { order, userId, supplier } = await paidOrder([["104", "356938035643809"]]);
    await dispatchOrder(order.id);
    const line = await lineFor(order.id, "356938035643809");
    expect(line.status).toBe("PENDING");
    expect((await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } })).lastError).toMatch(/credit/i);
    expect((await getBalances(prisma, userId)).USD.available).toBe(475_00);
  });

  it("never re-sends blindly after a broken reply: the line becomes UNKNOWN for staff", async () => {
    const { order } = await paidOrder([["105", "356938035643809"]]);
    await dispatchOrder(order.id);
    await dispatchOrder(order.id); // a second run must not send it again
    const line = await lineFor(order.id, "356938035643809");
    expect(line.status).toBe("PENDING");
    expect(line.supplierOrders[0].status).toBe("UNKNOWN");
    expect(fake.log.filter((l) => l.action === "placeimeiorder").length).toBeGreaterThan(0);
    expect(await prisma.supplierOrder.count({ where: { orderItemId: line.id } })).toBe(1);
  });

  it("refuses a wrong API key", async () => {
    const { callSupplier } = await import("@/lib/dhru/client");
    const supplier = await prisma.supplier.create({ data: { name: `Bad ${rand()}`, baseUrl: fake.url, username: "demo", apiKeyEncrypted: encrypt("wrong") } });
    const r = await callSupplier(supplier, "accountinfo");
    expect(JSON.stringify(r.reply)).toContain("Authentication Failed");
  });
});

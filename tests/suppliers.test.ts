import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { importPrice } from "@/lib/import-price";
import { importService, syncCatalog } from "@/lib/suppliers/sync";
import { getBalances, post, systemAccount, walletAccount } from "@/lib/ledger";
import { chargeOrder } from "@/lib/wallet";

process.env.CRON_SECRET = "test-secret";
afterAll(() => prisma.$disconnect());
afterEach(() => vi.unstubAllGlobals());

const rand = () => Math.random().toString(36).slice(2, 10);

/** A fake Dhru site: answers accountinfo and imeiservicelist with the given services. */
function fakeSupplier(services: Record<string, { name: string; credit: string }>) {
  vi.stubGlobal("fetch", async (_url: string, init: { body: URLSearchParams }) => {
    const action = new URLSearchParams(init.body).get("action");
    const body =
      action === "accountinfo"
        ? { SUCCESS: [{ AccoutInfo: { credit: "$100.00", currency: "USD" } }] }
        : {
            SUCCESS: [{
              LIST: {
                Apple: {
                  GROUPNAME: "Apple USA", GROUPTYPE: "IMEI",
                  SERVICES: Object.fromEntries(Object.entries(services).map(([id, s]) => [id, { SERVICEID: id, SERVICETYPE: "IMEI", SERVICENAME: s.name, CREDIT: s.credit, TIME: "1-3 Days" }])),
                },
              },
            }],
          };
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

describe("import prices", () => {
  it("adds markup, keeps the minimum profit, and rounds up to .99 or .49", () => {
    expect(importPrice(1000, 3500, 50)).toBe(1350);
    expect(importPrice(100, 1000, 50)).toBe(150); // min profit wins over 10 %
    expect(importPrice(1000, 3500, 50, "99")).toBe(1399);
    expect(importPrice(1000, 3500, 50, "49")).toBe(1399);
    expect(importPrice(1000, 2000, 0, "49")).toBe(1249);
    expect(importPrice(1199, 0, 0, "99")).toBe(1199);
    expect(importPrice(1200, 0, 0, "99")).toBe(1299);
  });
});

describe("supplier catalog sync", () => {
  it("tracks price changes, pauses services the supplier drops, and brings them back", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "Fake", baseUrl: `https://${rand()}.example.com`, username: "u", apiKeyEncrypted: encrypt("k") } });
    fakeSupplier({ "10": { name: "iPhone AT&T", credit: "10.00" }, "11": { name: "iPhone Verizon", credit: "5.00" } });
    expect(await syncCatalog(supplier.id)).toEqual({ ok: true, services: 2, gone: 0 });

    const att = await prisma.supplierService.findUniqueOrThrow({ where: { supplierId_remoteId: { supplierId: supplier.id, remoteId: "10" } } });
    const productId = await importService(att.id, { categoryId: "group", markupBps: 3500, minProfitUsd: 50, round: "99", publish: true });
    expect(productId).toBeTruthy();
    expect(await importService(att.id, { categoryId: "group", markupBps: 0, minProfitUsd: 0 })).toBeNull(); // already on the site
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId! }, include: { variants: true, category: true } });
    expect(product.isPublished).toBe(true);
    expect(product.category.slug).toBe("apple-usa");
    expect(product.variants[0]).toMatchObject({ priceUsd: 1399, costUsd: 1000, supplierServiceId: "10" });

    // AT&T gets dearer and Verizon disappears
    fakeSupplier({ "10": { name: "iPhone AT&T", credit: "12.00" } });
    expect(await syncCatalog(supplier.id)).toEqual({ ok: true, services: 1, gone: 1 });
    const changed = await prisma.supplierService.findUniqueOrThrow({ where: { id: att.id } });
    expect(changed).toMatchObject({ credit: 1200, previousCredit: 1000 });
    expect(changed.priceChangedAt).not.toBeNull();
    expect((await prisma.productVariant.findFirstOrThrow({ where: { productId: productId! } })).costUsd).toBe(1200);

    // AT&T dropped: the option is paused; listed again: it comes back
    fakeSupplier({ "11": { name: "iPhone Verizon", credit: "5.00" } });
    await syncCatalog(supplier.id);
    expect(await prisma.productVariant.findFirstOrThrow({ where: { productId: productId! } })).toMatchObject({ soldOut: true, pausedBySupplier: true });
    fakeSupplier({ "10": { name: "iPhone AT&T", credit: "12.00" }, "11": { name: "iPhone Verizon", credit: "5.00" } });
    await syncCatalog(supplier.id);
    expect(await prisma.productVariant.findFirstOrThrow({ where: { productId: productId! } })).toMatchObject({ soldOut: false, pausedBySupplier: false });
  });
});

describe("auto-refund and supplier orders", () => {
  it("does not refund by time while a line is with a supplier", async () => {
    const user = await prisma.user.create({ data: { id: `u_${rand()}`, name: "S", email: `${rand()}@t.test` } });
    await prisma.$transaction(async (tx) => {
      const w = await walletAccount(tx, user.id, "HTG");
      const c = await systemAccount(tx, "clearing", "HTG", "test");
      await post(tx, { type: "DEPOSIT", idempotencyKey: `f:${user.id}`, description: "t", entries: [{ accountId: c.id, currency: "HTG", amount: -500_00 }, { accountId: w.id, currency: "HTG", amount: 500_00 }] });
    });
    const supplier = await prisma.supplier.create({ data: { name: "S", baseUrl: `https://${rand()}.example.com`, username: "u", apiKeyEncrypted: encrypt("k") } });
    const category = await prisma.category.upsert({ where: { slug: "test-cat" }, create: { slug: "test-cat", name: { en: "Test" } }, update: {} });
    const product = await prisma.product.create({
      data: { slug: `p-${rand()}`, categoryId: category.id, name: { en: "P" }, description: {}, isPublished: true, fulfillmentType: "SUPPLIER_API", variants: { create: { name: { en: "V" }, priceUsd: 300_00, supplierId: supplier.id, supplierServiceId: "1" } } },
      include: { variants: true },
    });
    const order = await prisma.order.create({
      data: {
        userId: user.id, currency: "HTG", subtotal: 300_00, total: 300_00, paymentMethod: "WALLET", accessToken: `t${rand()}`, status: "PROCESSING",
        paidAt: new Date(Date.now() - 96 * 3_600_000),
        items: { create: { variantId: product.variants[0].id, productName: { en: "P" }, variantName: { en: "V" }, quantity: 1, unitPrice: 300_00, identifier: "490154203237518" } },
      },
      include: { items: true },
    });
    await prisma.$transaction((tx) => chargeOrder(tx, order));
    await prisma.supplierOrder.create({ data: { orderItemId: order.items[0].id, supplierId: supplier.id, serviceId: "1", status: "WAITING", remoteRef: "77", nextCheckAt: new Date(Date.now() + 3_600_000) } });

    const { GET } = await import("@/app/api/cron/maintenance/route");
    await GET(new Request("http://x/api/cron/maintenance", { headers: { authorization: "Bearer test-secret" } }) as never);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PROCESSING");
    expect((await getBalances(prisma, user.id)).HTG.available).toBe(200_00);
  });
});

"use server";
import { locales } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { revalidatePath } from "next/cache";
import { Prisma, type FulfillmentType, type Role, type ServiceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertStaff, assertStepUp } from "@/lib/session";
import { audit } from "@/lib/audit";
import { recordChange, recordVariantChange } from "@/lib/service-changes";
import { parseCountryRule } from "@/lib/countries";
import { decrypt, encrypt, hmac, randomToken } from "@/lib/crypto";
import { sanitizeFields } from "@/lib/order-form";
import { packCostCents } from "@/lib/packs";
import { COUNTRY_CODES } from "@/lib/countries";
import { completePayment, rejectPayment } from "@/lib/payments/complete";
import { deliverItemManually, fulfillOrder, refundOrCancel, revealCode } from "@/lib/orders";
import { adjustWallet } from "@/lib/wallet";
import { parseAmount } from "@/lib/money";
import { DEFAULT_SETTINGS, getSettings, setSetting, type Settings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { InsufficientFundsError } from "@/lib/ledger";
import { isOwnImageUrl, savePublicImage, UploadError } from "@/lib/storage";

type R = { ok: true; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });

// ───────────── Payments ─────────────

export async function approvePayment(intentId: string, note: string): Promise<R> {
  try {
    const staff = await assertStaff("payments.review");
    const r = await completePayment(intentId, { actorId: staff.id, note: note.slice(0, 500) || undefined });
    await audit(staff.id, "payment.approve", "PaymentIntent", intentId, { held: r.held, already: r.already });
    revalidatePath("/admin/payments");
    return { ok: true, message: r.already ? "Already approved" : r.held ? "Approved (held)" : "Approved" };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectPaymentAction(intentId: string, note: string): Promise<R> {
  try {
    const staff = await assertStaff("payments.review");
    if (note.trim().length < 3) return { ok: false, error: "A reason is required" };
    await rejectPayment(intentId, staff.id, note.trim());
    await audit(staff.id, "payment.reject", "PaymentIntent", intentId, { note });
    revalidatePath("/admin/payments");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Orders ─────────────

export async function runFulfillment(orderId: string): Promise<R> {
  try {
    const staff = await assertStaff("orders.manage");
    const r = await fulfillOrder(orderId, staff.id);
    await audit(staff.id, "order.fulfill.run", "Order", orderId, { result: r });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: r?.fulfilled ? "Order fulfilled" : "Some items still need manual delivery or restock" };
  } catch (e) {
    return fail(e);
  }
}

export async function deliverItem(itemId: string, note: string): Promise<R> {
  try {
    const staff = await assertStaff("orders.manage");
    if (note.trim().length < 2) return { ok: false, error: "Write a delivery note for the customer" };
    const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemId }, include: { order: true } });
    if (!["PAID", "PROCESSING"].includes(item.order.status)) return { ok: false, error: `Order is ${item.order.status}` };
    const open = await prisma.riskFlag.count({ where: { orderId: item.orderId, status: "OPEN" } });
    if (open) return { ok: false, error: "Resolve the open risk flag first" };
    await deliverItemManually(itemId, note.trim(), staff.id);
    await audit(staff.id, "order.item.deliver", "OrderItem", itemId, { orderId: item.orderId });
    revalidatePath(`/admin/orders/${item.orderId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function refundOrder(orderId: string, reason: string): Promise<R> {
  try {
    const staff = await assertStaff("orders.manage");
    if (reason.trim().length < 3) return { ok: false, error: "A reason is required" };
    const outcome = await refundOrCancel(orderId, staff.id, reason.trim());
    await audit(staff.id, `order.${outcome}`, "Order", orderId, { reason });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: outcome === "refunded" ? "Refunded to wallet" : "Order canceled" };
  } catch (e) {
    return fail(e);
  }
}

export async function revealOrderCodes(orderId: string, reason: string): Promise<{ ok: true; codes: { item: string; code: string }[] } | { ok: false; error: string }> {
  try {
    const staff = await assertStaff("codes.reveal");
    if (reason.trim().length < 3) return { ok: false, error: "A reason is required" };
    const items = await prisma.orderItem.findMany({ where: { orderId }, include: { codes: true } });
    await audit(staff.id, "code.view.staff", "Order", orderId, { reason });
    return { ok: true, codes: items.flatMap((i) => i.codes.map((c) => ({ item: i.id, code: revealCode(c.codeEncrypted) }))) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ───────────── Risk ─────────────

export async function resolveRisk(flagId: string, decision: "APPROVED" | "REJECTED"): Promise<R> {
  try {
    const staff = await assertStaff("risk.manage");
    const f = await prisma.riskFlag.update({
      where: { id: flagId },
      data: { status: decision, resolvedById: staff.id, resolvedAt: new Date() },
    });
    await audit(staff.id, `risk.${decision.toLowerCase()}`, "RiskFlag", flagId, { orderId: f.orderId });
    if (f.orderId) {
      if (decision === "APPROVED") await fulfillOrder(f.orderId, staff.id);
      else await refundOrCancel(f.orderId, staff.id, "Rejected by risk review");
    }
    revalidatePath("/admin/risk");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Catalog ─────────────

const localized = (form: FormData, prefix: string) => ({
  ht: String(form.get(`${prefix}_ht`) ?? "").trim(),
  fr: String(form.get(`${prefix}_fr`) ?? "").trim(),
  en: String(form.get(`${prefix}_en`) ?? "").trim(),
  es: String(form.get(`${prefix}_es`) ?? "").trim(),
});


export async function saveProduct(form: FormData): Promise<R & { id?: string }> {
  try {
    const staff = await assertStaff("catalog.manage");
    const id = String(form.get("id") ?? "") || null;
    const slug = String(form.get("slug") ?? "").trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { ok: false, error: "Slug must be lowercase letters, numbers and dashes" };
    const name = localized(form, "name");
    if (!name.ht && !name.fr && !name.en) return { ok: false, error: "A name is required" };
    let fields: unknown;
    try {
      fields = sanitizeFields(JSON.parse(String(form.get("fields") || "[]")));
    } catch (e) {
      return { ok: false, error: `Order form fields: ${e instanceof Error ? e.message : "invalid JSON"}` };
    }
    const image = String(form.get("image") ?? "").trim();
    if (image && !isOwnImageUrl(image)) return { ok: false, error: "Invalid main image" };
    const gallery = form.getAll("gallery").map(String).filter(Boolean).slice(0, 8);
    if (gallery.some((u) => !isOwnImageUrl(u))) return { ok: false, error: "Invalid gallery image" };
    const tags = [...new Set(String(form.get("tags") ?? "").split(",").map((x) => x.trim().slice(0, 30)).filter(Boolean))].slice(0, 12);
    const data = {
      slug,
      tags,
      image: image || null,
      gallery,
      categoryId: String(form.get("categoryId")),
      name,
      description: localized(form, "description"),
      deliveryEstimate: localized(form, "delivery"),
      instructions: localized(form, "instructions"),
      seoTitle: localized(form, "seoTitle"),
      seoDescription: localized(form, "seoDescription"),
      accent: /^#[0-9a-fA-F]{6}$/.test(String(form.get("accent"))) ? String(form.get("accent")) : null,
      fulfillmentType: String(form.get("fulfillmentType")) as FulfillmentType,
      isPublished: form.get("isPublished") === "on",
      isFeatured: form.get("isFeatured") === "on",
      sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
      fields: fields as Prisma.InputJsonValue,
      serviceType: (["IMEI", "SERVER", "REMOTE", "FILE"].includes(String(form.get("serviceType"))) ? String(form.get("serviceType")) : "IMEI") as ServiceType,
      identifierLabel: localized(form, "idLabel"),
      identifierFormat: ["imei", "serial", "any"].includes(String(form.get("identifierFormat"))) ? String(form.get("identifierFormat")) : "imei",
      allowBulk: form.get("allowBulk") === "on",
      ...parseCountryRule(form),
      hideFromGoogle: form.get("hideFromGoogle") === "on",
      offerCheck: form.get("offerCheck") === "on",
      seoPage: form.get("seoPage") === "on",
      kycLevelKey: String(form.get("kycLevelKey") ?? "") || null,
      cardTitle: localized(form, "cardTitle"),
      cardTag: localized(form, "cardTag"),
      cardStyle: ["ink", "green", "mint", "slate"].includes(String(form.get("cardStyle"))) ? String(form.get("cardStyle")) : "ink",
    };
    const wasPublished = id ? (await prisma.product.findUnique({ where: { id }, select: { isPublished: true } }))?.isPublished : false;
    const product = id ? await prisma.product.update({ where: { id }, data }) : await prisma.product.create({ data });
    if (product.isPublished && !wasPublished) await recordChange("NEW", product.id);
    await audit(staff.id, id ? "product.update" : "product.create", "Product", product.id, { slug });
    revalidatePath("/admin/products");
    revalidatePath("/", "layout");
    return { ok: true, id: product.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "That slug is already used" };
    return fail(e);
  }
}

/** Every option of a product out of stock (or back in stock) in one tap. */
export async function setProductSoldOut(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const productId = String(form.get("productId"));
    const soldOut = form.get("soldOut") === "1";
    const r = await prisma.productVariant.updateMany({ where: { productId }, data: { soldOut } });
    await recordChange(soldOut ? "REMOVED" : "BACK", productId);
    await audit(staff.id, soldOut ? "product.soldOut" : "product.backInStock", "Product", productId, { variants: r.count });
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/", "layout");
    return { ok: true, message: soldOut ? "All options out of stock" : "All options back in stock" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveVariant(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const id = String(form.get("id") ?? "") || null;
    const productId = String(form.get("productId"));
    const price = parseAmount(String(form.get("price") ?? ""));
    const saleRaw = String(form.get("salePrice") ?? "").trim();
    const sale = saleRaw ? parseAmount(saleRaw) : null;
    if (!price) return { ok: false, error: "Price is required (USD)" };
    const minQty = Math.max(1, Math.round(Number(form.get("minQty") ?? 1)) || 1);
    const maxQty = Math.max(minQty, Math.round(Number(form.get("maxQty") ?? 1)) || 1);
    const packSize = Math.max(1, Math.min(100_000, Math.round(Number(form.get("packSize") ?? 1)) || 1));
    const supplierId = String(form.get("supplierId") ?? "") || null;
    const supplierServiceId = String(form.get("supplierServiceId") ?? "").trim().slice(0, 64) || null;
    if (supplierId && !supplierServiceId) return { ok: false, error: "Pick the supplier's service, or no supplier" };
    if (supplierId && !(await prisma.supplier.findUnique({ where: { id: supplierId } }))) return { ok: false, error: "Unknown supplier" };
    const linked = supplierId ? await prisma.supplierService.findUnique({ where: { supplierId_remoteId: { supplierId, remoteId: supplierServiceId! } } }) : null;
    const costRaw = String(form.get("cost") ?? "").trim();
    if (saleRaw && (!sale || sale >= price)) return { ok: false, error: "Sale price must be lower than the price" };
    const data = {
      name: localized(form, "vname"),
      priceUsd: price,
      salePriceUsd: sale,
      minQty,
      maxQty,
      supplierId,
      supplierServiceId: supplierId ? supplierServiceId : null,
      packSize,
      costUsd: linked ? (packSize > 1 ? packCostCents(linked.creditMicros, packSize) : linked.credit) : costRaw ? parseAmount(costRaw) : null,
      sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
      isActive: form.get("isActive") === "on",
      soldOut: form.get("soldOut") === "on",
    };
    const before = id ? await prisma.productVariant.findUnique({ where: { id }, select: { priceUsd: true, salePriceUsd: true, soldOut: true } }) : null;
    const v = id ? await prisma.productVariant.update({ where: { id }, data }) : await prisma.productVariant.create({ data: { ...data, productId } });
    await recordVariantChange(productId, v.id, before, v);
    await audit(staff.id, id ? "variant.update" : "variant.create", "ProductVariant", v.id, { productId, price, sale });
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveCategory(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const id = String(form.get("id") ?? "") || null;
    const slug = String(form.get("slug") ?? "").trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { ok: false, error: "Invalid slug" };
    const image = String(form.get("image") ?? "").trim();
    if (image && !isOwnImageUrl(image)) return { ok: false, error: "Invalid image" };
    const cover = String(form.get("cover") ?? "").trim();
    if (cover && !isOwnImageUrl(cover)) return { ok: false, error: "Invalid background image" };
    const parentRaw = String(form.get("parentId") ?? "") || null;
    if (parentRaw) {
      const parent = await prisma.category.findUnique({ where: { id: parentRaw } });
      if (!parent || parent.parentId || parent.id === id) return { ok: false, error: "A subcategory's parent must be a top-level category" };
      if (id && (await prisma.category.count({ where: { parentId: id } })) > 0) return { ok: false, error: "This category has subcategories, so it can't become one" };
    }
    const data = { slug, parentId: parentRaw, image: image || null, cover: cover || null, name: localized(form, "name"), icon: String(form.get("icon") ?? "").slice(0, 4) || null, sortOrder: Number(form.get("sortOrder") ?? 0) || 0, isVisible: form.get("isVisible") === "on" };
    const c = id ? await prisma.category.update({ where: { id }, data }) : await prisma.category.create({ data });
    await audit(staff.id, id ? "category.update" : "category.create", "Category", c.id, { slug });
    revalidatePath("/admin/products");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Import codes, one per line. Duplicates (already in stock anywhere) are skipped. */
export async function importCodes(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("codes.manage");
    const variantId = String(form.get("variantId"));
    const batchLabel = String(form.get("batchLabel") ?? "").slice(0, 60) || null;
    const cost = String(form.get("cost") ?? "").trim();
    const costHtg = cost ? parseAmount(cost) : null;
    const lines = String(form.get("codes") ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return { ok: false, error: "Paste at least one code" };
    if (lines.length > 2000) return { ok: false, error: "Import at most 2000 codes at a time" };
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const unique = [...new Set(lines)];
    const res = await prisma.codeItem.createMany({
      data: unique.map((c) => ({ variantId: variant.id, codeEncrypted: encrypt(c), codeHash: hmac(c), batchLabel, costHtg })),
      skipDuplicates: true,
    });
    await audit(staff.id, "codes.import", "ProductVariant", variant.id, { imported: res.count, submitted: lines.length, batchLabel });
    revalidatePath("/admin/codes");
    // Orders waiting for this variant can now be fulfilled.
    const waiting = await prisma.order.findMany({ where: { status: "PROCESSING", items: { some: { variantId, status: "PENDING" } } }, select: { id: true } });
    for (const o of waiting) await fulfillOrder(o.id, staff.id);
    return { ok: true, message: `Imported ${res.count} codes (${lines.length - res.count} duplicates skipped). ${waiting.length} waiting orders retried.` };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Customers & wallet ─────────────

export async function adjustCustomerWallet(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("wallet.adjust");
    const userId = String(form.get("userId"));
    const currency = form.get("currency") === "USD" ? "USD" : "HTG";
    const direction = form.get("direction") === "debit" ? -1 : 1;
    const amount = parseAmount(String(form.get("amount") ?? ""));
    const reason = String(form.get("reason") ?? "").trim();
    const key = String(form.get("idempotencyKey") ?? "");
    if (!amount) return { ok: false, error: "Enter an amount" };
    if (reason.length < 5) return { ok: false, error: "A reason (5+ characters) is required" };
    if (key.length < 10) return { ok: false, error: "Reload the page and try again" };
    await assertStepUp();
    const settings = await (await import("@/lib/settings")).getSettings();
    const htgEquivalent = currency === "HTG" ? amount : Math.round(amount * settings.htgPerUsd);
    if (htgEquivalent >= settings.approvalThresholdHtg) {
      await prisma.pendingApproval.create({
        data: {
          kind: "wallet.adjust",
          payload: { userId, currency, amount: amount * direction, reason, idempotencyKey: key },
          summary: `${direction > 0 ? "Credit" : "Debit"} ${(amount / 100).toFixed(2)} ${currency}: ${reason}`,
          requestedBy: staff.id,
        },
      });
      await audit(staff.id, "wallet.adjust.requested", "User", userId, { currency, amount: amount * direction, reason });
      return { ok: true, message: "Above the approval limit: sent to a second staff member (Admin → Approvals)." };
    }
    await prisma.$transaction(async (tx) => {
      await adjustWallet(tx, { userId, currency, amount: amount * direction, reason, actorId: staff.id, idempotencyKey: key });
      await audit(staff.id, "wallet.adjust", "User", userId, { currency, amount: amount * direction, reason }, tx);
    });
    await notify(userId, "wallet_adjusted", {}, "/account/wallet");
    revalidatePath(`/admin/customers/${userId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof InsufficientFundsError) return { ok: false, error: "Customer balance is too low for this debit" };
    return fail(e);
  }
}

export async function setCustomerStatus(userId: string, status: "ACTIVE" | "RESTRICTED" | "SUSPENDED"): Promise<R> {
  try {
    const staff = await assertStaff("customers.manage");
    if (userId === staff.id) return { ok: false, error: "You cannot change your own status" };
    await prisma.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") await prisma.session.deleteMany({ where: { userId } });
    await audit(staff.id, "customer.status", "User", userId, { status });
    revalidatePath(`/admin/customers/${userId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setStaffRole(email: string, roleInput: string): Promise<R> {
  try {
    const staff = await assertStaff("staff.manage");
    await assertStepUp();
    let role = roleInput as Role;
    let customRoleId: string | null = null;
    if (roleInput.startsWith("CUSTOM:")) {
      role = "CUSTOM";
      customRoleId = roleInput.slice(7);
      await prisma.customRole.findUniqueOrThrow({ where: { id: customRoleId } });
    }
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) return { ok: false, error: "No account with that email. Ask them to register first." };
    if (user.id === staff.id) return { ok: false, error: "You cannot change your own role" };
    await prisma.user.update({ where: { id: user.id }, data: { role, customRoleId } });
    await prisma.session.deleteMany({ where: { userId: user.id } }); // re-login picks up the new role and 2FA requirement
    await audit(staff.id, "staff.role", "User", user.id, { role, customRoleId });
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Settings ─────────────

export async function saveSettings(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    await assertStepUp();
    const num = (k: string) => Number(String(form.get(k) ?? "").replace(",", "."));
    const money = (k: string) => parseAmount(String(form.get(k) ?? "")) ?? 0;
    const str = (k: string) => String(form.get(k) ?? "").trim().slice(0, 300);
    const rate = num("htgPerUsd");
    if (!(rate > 1 && rate < 10_000)) return { ok: false, error: "Exchange rate looks wrong" };

    const next: Partial<Settings> = {
      htgPerUsd: rate,
      exchangeSpreadBps: Math.max(0, Math.min(2000, Math.round(num("exchangeSpreadBps")))),
      exchangeFeeBps: Math.max(0, Math.min(2000, Math.round(num("exchangeFeeBps")))),
      exchangeQuoteSeconds: Math.max(30, Math.min(900, Math.round(num("exchangeQuoteSeconds")))),
      minDepositHtg: money("minDepositHtg"),
      maxDepositHtg: money("maxDepositHtg"),
      holdThresholdHtg: money("holdThresholdHtg"),
      holdHours: Math.max(0, Math.min(168, Math.round(num("holdHours")))),
      newAccountDays: Math.max(0, Math.min(90, Math.round(num("newAccountDays")))),
      newAccountDailyLimitHtg: money("newAccountDailyLimitHtg"),
      reviewOrderThresholdHtg: money("reviewOrderThresholdHtg"),
      approvalThresholdHtg: money("approvalThresholdHtg"),
      autoRefundHours: Math.max(0, Math.min(720, Math.round(num("autoRefundHours")))),
      referralEnabled: form.get("referralEnabled") === "on",
      newsletterEnabled: form.get("newsletterEnabled") === "on",
      requireEmailVerification: form.get("requireEmailVerification") === "on",
      maxAccountsPerDevice: Math.max(1, Math.min(50, Math.round(num("maxAccountsPerDevice")) || 3)),
      referralRewardHtg: money("referralRewardHtg"),
      referralMinOrderHtg: money("referralMinOrderHtg"),
      natcashRecipientName: str("natcashRecipientName"),
      natcashRecipientPhone: str("natcashRecipientPhone"),
      moncashEnabled: form.get("moncashEnabled") === "on",
      natcashEnabled: form.get("natcashEnabled") === "on",
      whatsappNumber: str("whatsappNumber").replace(/\D/g, ""),
      supportHours: str("supportHours"),
      businessName: str("businessName") || DEFAULT_SETTINGS.businessName,
      businessAddress: str("businessAddress"),
      socialFacebook: str("socialFacebook"),
      socialInstagram: str("socialInstagram"),
      socialTiktok: str("socialTiktok"),
      announcement: {
        startsAt: String(form.get("announcementStartsAt") ?? "") || undefined,
        endsAt: String(form.get("announcementEndsAt") ?? "") || undefined,
        enabled: form.get("announcementEnabled") === "on",
        text: { ht: str("announcement_ht"), fr: str("announcement_fr"), en: str("announcement_en"), es: str("announcement_es") },
        link: str("announcementLink"),
      },
    };
    const img = (k: string) => {
      const v = str(k);
      return v && isOwnImageUrl(v) ? v : "";
    };
    next.logoUrl = img("logoUrl");
    next.logoDarkUrl = img("logoDarkUrl");
    next.heroImageUrl = img("heroImageUrl");
    next.ogImageUrl = img("ogImageUrl");
    next.natcashQrUrl = img("natcashQrUrl");
    const before = await getSettings();
    next.appIconUrl = img("appIconUrl");
    if (next.appIconUrl !== before.appIconUrl) next.appIconVersion = Date.now();
    const pct = (k: string, max = 100) => Math.max(0, Math.min(max, num(k) || 0));
    const code = str("defaultCountry").toUpperCase();
    if (code && !COUNTRY_CODES.includes(code)) return { ok: false, error: "Default country must be a 2-letter code such as HT" };
    next.defaultCountry = code || "HT";
    const langs = [...locales].filter((l) => form.get(`lang_${l}`) === "on");
    if (!langs.length) return { ok: false, error: "Keep at least one language on" };
    next.languages = langs;
    next.telegramUrl = str("telegramUrl");
    next.telegramChannel = str("telegramChannel");
    next.telegramStaffChat = str("telegramStaffChat");
    if (next.telegramChannel && !/^(@[\w]{4,}|-?\d{5,})$/.test(next.telegramChannel)) return { ok: false, error: "Telegram channel: @name or the numeric chat id" };
    if (next.telegramStaffChat && !/^-?\d{5,}$/.test(next.telegramStaffChat)) return { ok: false, error: "Staff chat: the numeric chat id (e.g. -1001234567890)" };
    next.kycRetentionMonths = Math.max(1, Math.min(120, Math.round(num("kycRetentionMonths")) || 12));
    next.supplierDefaults = { markupPct: pct("markupPct", 1000), minProfitUsd: money("minProfitUsd"), round: (["99", "49"].includes(str("round")) ? str("round") : "none") as "99" | "49" | "none" };
    next.successRate = { minOrders: Math.max(1, Math.round(num("srMinOrders")) || 20), alertBelowPct: pct("srAlert"), pauseBelowPct: pct("srPause") };
    next.legal = { entity: str("legalEntity"), registration: str("legalRegistration"), taxId: str("legalTaxId"), email: str("legalEmail"), refundDays: Math.max(0, Math.min(90, Math.round(num("legalRefundDays")))) };
    if (next.legal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.legal.email)) return { ok: false, error: "Legal email looks wrong" };
    next.maintenance = {
      on: form.get("maintenanceOn") === "on",
      message: { ht: str("maintenance_ht"), fr: str("maintenance_fr"), en: str("maintenance_en"), es: str("maintenance_es") },
      until: String(form.get("maintenanceUntil") ?? "") || undefined,
    };
    for (const url of [next.socialFacebook, next.socialInstagram, next.socialTiktok, next.announcement?.link]) {
      if (url && !/^https:\/\//.test(url) && !url.startsWith("/")) return { ok: false, error: "Links must start with https:// or /" };
    }
    for (const [k, v] of Object.entries(next)) await setSetting(k as keyof Settings, v as never);
    await audit(staff.id, "settings.update", "SiteSetting", null, { keys: Object.keys(next), htgPerUsd: rate });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function newIdempotencyKey() {
  return randomToken(16);
}

// ───────────── Images ─────────────

export async function uploadImage(form: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const folder = String(form.get("folder"));
  if (folder !== "products" && folder !== "categories" && folder !== "brand") return { ok: false, error: "Invalid folder" };
  try {
    const staff = await assertStaff(folder === "brand" ? "settings.manage" : "catalog.manage");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image" };
    const url = await savePublicImage(file, folder);
    const asset = await prisma.mediaAsset.create({ data: { url, folder, uploadedBy: staff.id } });
    await audit(staff.id, "image.upload", "MediaAsset", asset.id, { folder, url });
    return { ok: true, url };
  } catch (e) {
    if (e instanceof UploadError) {
      const msg: Record<string, string> = {
        type: "Use a JPG, PNG or WebP image",
        size: "Image must be 5 MB or smaller",
        storage: "Image storage is not configured (connect a Vercel Blob store)",
      };
      return { ok: false, error: msg[e.message] ?? "Upload failed" };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

// ───────────── Account recovery ─────────────

/**
 * One-time password reset link for a customer who contacted support (used while email is not configured).
 * Uses Better Auth's own reset token format, valid 1 hour and single-use. Staff must verify identity first.
 */
export async function createPasswordResetLink(userId: string): Promise<{ ok: true; url: string; phone: string | null } | { ok: false; error: string }> {
  try {
    const staff = await assertStaff("customers.manage");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role !== "CUSTOMER" && staff.role !== "SUPER_ADMIN") return { ok: false, error: "Only a Super Admin can reset a staff password" };
    const token = randomToken(24);
    await prisma.verification.deleteMany({ where: { identifier: { startsWith: "reset-password:" }, value: user.id } });
    await prisma.verification.create({
      data: { id: randomToken(16), identifier: `reset-password:${token}`, value: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await audit(staff.id, "password.reset_link", "User", user.id);
    const site = siteUrl();
    return { ok: true, url: `${site}/${user.locale}/auth/reset?token=${token}`, phone: user.phone };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Super Admin resets a staff member's lost authenticator; they set it up again at next sign-in. */
export async function resetStaffTwoFactor(userId: string): Promise<R> {
  try {
    const staff = await assertStaff("staff.manage");
    if (userId === staff.id) return { ok: false, error: "You cannot reset your own two-factor authentication" };
    await assertStepUp();
    await prisma.$transaction([
      prisma.twoFactor.deleteMany({ where: { userId } }),
      prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
    await audit(staff.id, "staff.2fa_reset", "User", userId);
    revalidatePath("/admin/staff");
    return { ok: true, message: "Two-factor reset. They will set it up again at next sign-in." };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Step-up (re-confirm 2FA) ─────────────

/** Confirms the staff member's authenticator code; high-risk actions are then allowed for 10 minutes. */
export async function verifyStepUp(code: string): Promise<R> {
  try {
    const { headers } = await import("next/headers");
    const { auth } = await import("@/lib/auth");
    const { getSession } = await import("@/lib/session");
    const s = await getSession();
    if (!s) return { ok: false, error: "Not signed in" };
    const clean = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(clean)) return { ok: false, error: "Enter the 6-digit code" };
    await auth.api.verifyTOTP({ body: { code: clean }, headers: await headers() });
    await prisma.stepUp.upsert({
      where: { sessionToken: s.session.token },
      create: { sessionToken: s.session.token, userId: s.user.id, until: new Date(Date.now() + 10 * 60_000) },
      update: { until: new Date(Date.now() + 10 * 60_000) },
    });
    await audit(s.user.id, "staff.step_up", "User", s.user.id);
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid code" };
  }
}

// ───────────── Two-person approvals ─────────────

export async function decideApproval(id: string, decision: "APPROVED" | "REJECTED"): Promise<R> {
  try {
    const staff = await assertStaff("approvals.decide");
    await assertStepUp();
    const a = await prisma.pendingApproval.findUniqueOrThrow({ where: { id } });
    if (a.status !== "PENDING") return { ok: false, error: "Already decided" };
    if (a.requestedBy === staff.id) return { ok: false, error: "A different staff member must approve this" };
    if (decision === "APPROVED" && a.kind === "wallet.adjust") {
      const p = a.payload as { userId: string; currency: "HTG" | "USD"; amount: number; reason: string; idempotencyKey: string };
      await prisma.$transaction(async (tx) => {
        await adjustWallet(tx, { ...p, actorId: staff.id, reason: `${p.reason} (approved by ${staff.name})` });
        await audit(staff.id, "wallet.adjust", "User", p.userId, { ...p, requestedBy: a.requestedBy, approvalId: a.id }, tx);
      });
      await notify(p.userId, "wallet_adjusted", {}, "/account/wallet");
    }
    await prisma.pendingApproval.update({ where: { id }, data: { status: decision, decidedBy: staff.id, decidedAt: new Date() } });
    await audit(staff.id, `approval.${decision.toLowerCase()}`, "PendingApproval", id, { kind: a.kind });
    revalidatePath("/admin/approvals");
    return { ok: true, message: decision === "APPROVED" ? "Approved and applied" : "Rejected" };
  } catch (e) {
    if (e instanceof InsufficientFundsError) return { ok: false, error: "Customer balance is too low for this debit" };
    return fail(e);
  }
}

// ───────────── Custom roles ─────────────

export async function saveCustomRole(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("staff.manage");
    await assertStepUp();
    const { PERMISSIONS } = await import("@/lib/permissions");
    const id = String(form.get("id") ?? "") || null;
    const name = String(form.get("name") ?? "").trim().slice(0, 40);
    if (name.length < 2) return { ok: false, error: "Give the role a name" };
    const permissions = form.getAll("permissions").map(String).filter((p) => (PERMISSIONS as readonly string[]).includes(p) && p !== "staff.manage");
    const role = id
      ? await prisma.customRole.update({ where: { id }, data: { name, permissions } })
      : await prisma.customRole.create({ data: { name, permissions } });
    await audit(staff.id, id ? "role.update" : "role.create", "CustomRole", role.id, { name, permissions });
    revalidatePath("/admin/staff");
    return { ok: true, message: "Role saved" };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "A role with that name exists" };
    return fail(e);
  }
}

export async function deleteCustomRole(id: string): Promise<R> {
  try {
    const staff = await assertStaff("staff.manage");
    await assertStepUp();
    const users = await prisma.user.count({ where: { customRoleId: id } });
    if (users > 0) return { ok: false, error: "Move the staff using this role first" };
    await prisma.customRole.delete({ where: { id } });
    await audit(staff.id, "role.delete", "CustomRole", id);
    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Support ─────────────

export async function staffReply(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("support.manage");
    const ticketId = String(form.get("ticketId"));
    const body = String(form.get("message") ?? "").trim().slice(0, 5000);
    const status = form.get("close") === "on" ? "CLOSED" : "WAITING_CUSTOMER";
    if (!body) return { ok: false, error: "Write a reply" };
    await prisma.$transaction([
      prisma.supportMessage.create({ data: { ticketId, authorId: staff.id, body, fromStaff: true } }),
      prisma.supportTicket.update({ where: { id: ticketId }, data: { status, assignedTo: staff.id } }),
    ]);
    await audit(staff.id, "support.reply", "SupportTicket", ticketId, { status });
    revalidatePath(`/admin/support/${ticketId}`);
    return { ok: true, message: "Reply sent" };
  } catch (e) {
    return fail(e);
  }
}

export async function setTicketStatus(ticketId: string, status: "OPEN" | "CLOSED"): Promise<R> {
  try {
    const staff = await assertStaff("support.manage");
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
    await audit(staff.id, "support.status", "SupportTicket", ticketId, { status });
    revalidatePath(`/admin/support/${ticketId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Referrals ─────────────

export async function decideReferral(id: string, decision: "PAY" | "REJECT"): Promise<R> {
  try {
    const staff = await assertStaff("referrals.manage");
    const r = await prisma.referral.findUniqueOrThrow({ where: { id } });
    if (r.status === "REWARDED") return { ok: false, error: "Already rewarded" };
    if (decision === "PAY") {
      const { payReferral } = await import("@/lib/referrals");
      await payReferral(id, staff.id);
    } else {
      await prisma.referral.update({ where: { id }, data: { status: "REJECTED", note: `Rejected by ${staff.name}` } });
    }
    await audit(staff.id, `referral.${decision.toLowerCase()}`, "Referral", id);
    revalidatePath("/admin/referrals");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ───────────── Reconciliation ─────────────

export type ReconcileResult = {
  matched: { reference: string; amount: number }[];
  toApprove: { id: string; reference: string; amount: number; customer: string }[];
  mismatched: { id: string; reference: string; statement: number; system: number; status: string }[];
  unknown: { reference: string; amount: number; date?: string }[];
  missing: { id: string; reference: string; amount: number; customer: string; at: string }[];
};

/** Compare a provider statement with our payments. Read-only: approvals still go through the normal review. */
export async function reconcileStatement(text: string, provider: string, days: number): Promise<{ ok: true; result: ReconcileResult; rows: number } | { ok: false; error: string }> {
  try {
    const staff = await assertStaff("payments.review");
    const { parseStatement } = await import("@/lib/reconcile");
    const { rows, error } = parseStatement(text.slice(0, 2_000_000));
    if (error) return { ok: false, error };
    const isManual = provider.startsWith("MANUAL:");
    const since = new Date(Date.now() - Math.max(1, Math.min(366, days)) * 86_400_000);
    const intents = await prisma.paymentIntent.findMany({
      where: { provider: isManual ? "MANUAL" : (provider as "MONCASH" | "NATCASH"), ...(isManual ? { manualMethodId: provider.slice(7) } : {}), createdAt: { gte: since } },
      include: { user: { select: { name: true } } },
    });
    const byRef = new Map(intents.filter((i) => i.providerRef).map((i) => [i.providerRef!.toUpperCase(), i]));
    const seen = new Set<string>();
    const result: ReconcileResult = { matched: [], toApprove: [], mismatched: [], unknown: [], missing: [] };
    for (const r of rows) {
      const i = byRef.get(r.reference);
      if (!i) { result.unknown.push(r); continue; }
      seen.add(r.reference);
      if (i.amount !== r.amount) result.mismatched.push({ id: i.id, reference: r.reference, statement: r.amount, system: i.amount, status: i.status });
      else if (i.status === "SUCCEEDED") result.matched.push({ reference: r.reference, amount: r.amount });
      else if (i.status === "REVIEW" || i.status === "PENDING") result.toApprove.push({ id: i.id, reference: r.reference, amount: r.amount, customer: i.user.name });
      else result.mismatched.push({ id: i.id, reference: r.reference, statement: r.amount, system: i.amount, status: i.status });
    }
    for (const i of intents) {
      if (i.status === "SUCCEEDED" && i.providerRef && !seen.has(i.providerRef.toUpperCase())) {
        result.missing.push({ id: i.id, reference: i.providerRef, amount: i.amount, customer: i.user.name, at: i.updatedAt.toISOString() });
      }
    }
    await audit(staff.id, "reconcile.run", "PaymentIntent", null, { provider, rows: rows.length, missing: result.missing.length, unknown: result.unknown.length });
    return { ok: true, result, rows: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Staff read a password the customer typed in the order form (remote job). Logged. */
export async function revealFieldSecret(itemId: string, key: string): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  try {
    const staff = await assertStaff("orders.manage");
    const item = await prisma.orderItem.findUnique({ where: { id: itemId }, select: { fieldValues: true, orderId: true } });
    const v = ((item?.fieldValues ?? {}) as Record<string, string>)[key];
    if (!item || !v?.startsWith("enc:")) return { ok: false, error: "Nothing to show (already removed?)" };
    await audit(staff.id, "order.secret.view", "OrderItem", itemId, { key, orderId: item.orderId });
    return { ok: true, value: decrypt(v.slice(4)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

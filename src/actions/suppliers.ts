"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertStaff, assertStepUp } from "@/lib/session";
import { audit } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { parseAmount } from "@/lib/money";
import { endpointUrl } from "@/lib/dhru/protocol";
import { importService, refreshBalance, syncCatalog } from "@/lib/suppliers/sync";
import { checkSupplierOrder, submitItem } from "@/lib/suppliers/dispatch";
import { stalledWhere } from "@/lib/suppliers/attention";
import { rejectItem } from "@/lib/orders";
import type { PriceRounding } from "@/lib/import-price";

type R = { ok: true; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
const money = (c: number | null) => (c == null ? "?" : `${(c / 100).toFixed(2)}`);

/** Supplier sites must be public https addresses (no local or private network targets). */
function checkAddress(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(endpointUrl(raw));
  } catch {
    return "That address is not valid";
  }
  if (u.protocol !== "https:") return "Use the https:// address of the supplier's site";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(\d+\.){3}\d+$/.test(h) || h.includes(":")) {
    return "Use the supplier's domain name, not an IP or local address";
  }
  return null;
}

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  baseUrl: z.string().trim().min(4).max(300),
  username: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().max(500).optional(),
  paramFormat: z.enum(["xml", "json"]),
  lowBalanceAlert: z.string().trim().max(20).optional(),
});

/** Add or edit a supplier. The API key is stored encrypted and never shown again; leave it empty to keep it. */
export async function saveSupplier(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    await assertStepUp();
    const p = supplierSchema.safeParse(Object.fromEntries(form));
    if (!p.success) return { ok: false, error: "Check the name, site address and username" };
    const d = p.data;
    const bad = checkAddress(d.baseUrl);
    if (bad) return { ok: false, error: bad };
    if (!d.id && !d.apiKey) return { ok: false, error: "Paste the API access key from your account on the supplier's site" };
    const alert = d.lowBalanceAlert ? parseAmount(d.lowBalanceAlert) : 0;
    if (alert == null) return { ok: false, error: "Low balance alert must be an amount like 50 or 50.00" };
    const data = {
      name: d.name,
      baseUrl: new URL(endpointUrl(d.baseUrl)).origin,
      username: d.username,
      paramFormat: d.paramFormat,
      isEnabled: form.get("isEnabled") === "on",
      lowBalanceAlert: alert,
      ...(d.apiKey ? { apiKeyEncrypted: encrypt(d.apiKey) } : {}),
    };
    const s = d.id
      ? await prisma.supplier.update({ where: { id: d.id }, data })
      : await prisma.supplier.create({ data: { ...data, apiKeyEncrypted: encrypt(d.apiKey!) } });
    await audit(staff.id, d.id ? "supplier.update" : "supplier.create", "Supplier", s.id, { name: s.name, baseUrl: s.baseUrl, keyChanged: !!d.apiKey, isEnabled: s.isEnabled });
    revalidatePath("/admin/suppliers");
    if (d.id) return { ok: true, message: "Saved" };
    const err = await refreshBalance(s.id);
    return { ok: true, message: err ? `Saved, but the connection test failed: ${err}` : "Saved and connected" };
  } catch (e) {
    return fail(e);
  }
}

export async function testSupplier(id: string): Promise<R> {
  try {
    const staff = await assertStaff("suppliers.manage");
    const err = await refreshBalance(id);
    await audit(staff.id, "supplier.test", "Supplier", id, { ok: !err });
    revalidatePath("/admin/suppliers");
    if (err) return { ok: false, error: err };
    const s = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    return { ok: true, message: `Connected · balance ${money(s.balance)} ${s.currency ?? ""}` };
  } catch (e) {
    return fail(e);
  }
}

export async function syncSupplier(id: string): Promise<R> {
  try {
    const staff = await assertStaff("suppliers.manage");
    const r = await syncCatalog(id);
    await audit(staff.id, "supplier.sync", "Supplier", id, r);
    revalidatePath(`/admin/suppliers/${id}`);
    return r.ok ? { ok: true, message: `${r.services} services synced${r.gone ? `, ${r.gone} no longer offered` : ""}` } : { ok: false, error: r.error };
  } catch (e) {
    return fail(e);
  }
}

/** Import the ticked services as products priced at cost + markup. */
export async function importSupplierServices(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const ids = form.getAll("ids").map(String).slice(0, 300);
    if (!ids.length) return { ok: false, error: "Tick at least one service" };
    const categoryId = String(form.get("categoryId") ?? "");
    if (!categoryId) return { ok: false, error: "Pick a category" };
    if (categoryId !== "group" && !(await prisma.category.findUnique({ where: { id: categoryId } }))) return { ok: false, error: "Unknown category" };
    const markup = Number(String(form.get("markup") ?? "").replace(",", "."));
    if (!Number.isFinite(markup) || markup < 0 || markup > 1000) return { ok: false, error: "Markup must be a percentage between 0 and 1000" };
    const minProfit = parseAmount(String(form.get("minProfit") ?? "0") || "0");
    if (minProfit == null) return { ok: false, error: "Minimum profit must be an amount like 1.50" };
    const publish = form.get("publish") === "on";
    const r = String(form.get("round") ?? "none");
    const round: PriceRounding = r === "99" || r === "49" ? r : "none";
    let created = 0;
    let skipped = 0;
    for (const id of ids) {
      const productId = await importService(id, { categoryId, markupBps: Math.round(markup * 100), minProfitUsd: minProfit, round, publish });
      if (productId) created++;
      else skipped++;
    }
    await audit(staff.id, "supplier.import", "SupplierService", ids[0], { created, skipped, categoryId, markup, minProfit, round, publish });
    revalidatePath("/admin/suppliers");
    revalidatePath("/admin/products");
    const tail = skipped ? ` (${skipped} already on the site)` : "";
    return { ok: true, message: `${created} service${created === 1 ? "" : "s"} imported${publish ? " and published" : " as hidden drafts: review them in Products"}${tail}` };
  } catch (e) {
    return fail(e);
  }
}

/** Unknown send: staff found the order on the supplier's site and type its reference, so we track it from here. */
export async function confirmSupplierOrder(soId: string, ref: string): Promise<R> {
  try {
    const staff = await assertStaff("suppliers.manage");
    const remoteRef = ref.trim().slice(0, 64);
    if (!/^[\w-]+$/.test(remoteRef)) return { ok: false, error: "Type the order ID shown on the supplier's site" };
    const r = await prisma.supplierOrder.updateMany({ where: { id: soId, status: "UNKNOWN" }, data: { status: "WAITING", remoteRef, nextCheckAt: new Date(), error: null } });
    if (!r.count) return { ok: false, error: "This order was already handled" };
    await audit(staff.id, "supplier.order.confirm", "SupplierOrder", soId, { remoteRef });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Linked: the status will be checked automatically" };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Send a line again. For an unknown send, staff confirm first that the order is NOT on the supplier's site
 * (otherwise the supplier would be paid twice).
 */
export async function resendSupplierItem(itemId: string): Promise<R> {
  try {
    const staff = await assertStaff("suppliers.manage");
    await prisma.supplierOrder.updateMany({
      where: { orderItemId: itemId, status: "UNKNOWN" },
      data: { status: "REJECTED", error: "Staff checked: not on the supplier's site, sent again" },
    });
    const so = await submitItem(itemId);
    await audit(staff.id, "supplier.order.resend", "OrderItem", itemId, { status: so?.status ?? null });
    revalidatePath("/admin/suppliers");
    if (!so) return { ok: false, error: "Not sent: the supplier is switched off, or the line is no longer waiting" };
    if (so.status === "WAITING") return { ok: true, message: `Sent · supplier order ${so.remoteRef}` };
    return { ok: false, error: so.error ?? `Supplier answered: ${so.status}` };
  } catch (e) {
    return fail(e);
  }
}

/** After a top-up or a key fix: send every line waiting on this supplier (stops at the first account problem). */
export async function resendWaiting(supplierId: string): Promise<R> {
  try {
    const staff = await assertStaff("suppliers.manage");
    const items = await prisma.orderItem.findMany({
      where: { ...stalledWhere(new Date()), variant: { supplierId, product: { fulfillmentType: "SUPPLIER_API" } } },
      select: { id: true },
      orderBy: { order: { paidAt: "asc" } },
      take: 100,
    });
    let sent = 0;
    let error: string | null = null;
    for (const i of items) {
      const so = await submitItem(i.id);
      if (so?.status === "WAITING") sent++;
      else if (so?.status === "REJECTED" || !so) {
        error = so?.error ?? "Supplier switched off";
        break;
      }
    }
    await audit(staff.id, "supplier.resendWaiting", "Supplier", supplierId, { waiting: items.length, sent, error });
    revalidatePath("/admin/suppliers");
    if (!items.length) return { ok: true, message: "Nothing is waiting" };
    return error && !sent ? { ok: false, error } : { ok: true, message: `${sent} of ${items.length} sent${error ? ` · stopped: ${error}` : ""}` };
  } catch (e) {
    return fail(e);
  }
}

/** Give up on a line: refund the customer to their wallet. */
export async function refundSupplierItem(itemId: string, reason: string): Promise<R> {
  try {
    const staff = await assertStaff("orders.manage");
    const why = reason.trim() || "Could not be processed by the supplier";
    await prisma.supplierOrder.updateMany({ where: { orderItemId: itemId, status: { in: ["UNKNOWN", "WAITING", "IN_PROCESS"] } }, data: { status: "REJECTED", error: `Refunded by staff: ${why}`.slice(0, 1000) } });
    await rejectItem(itemId, staff.id, why);
    await audit(staff.id, "supplier.order.refund", "OrderItem", itemId, { reason: why });
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Refunded to the customer's wallet" };
  } catch (e) {
    return fail(e);
  }
}

/** "Check now" on one line: ask the supplier at once, whatever the check schedule says. */
export async function checkSupplierItemNow(itemId: string): Promise<R> {
  try {
    const staff = await assertStaff("orders.manage");
    const so = await prisma.supplierOrder.findFirst({ where: { orderItemId: itemId, status: { in: ["WAITING", "IN_PROCESS"] } }, orderBy: { createdAt: "desc" } });
    if (!so) return { ok: false, error: "Nothing to check: this line is not waiting on a supplier" };
    const status = await checkSupplierOrder(so);
    await audit(staff.id, "supplier.order.check", "SupplierOrder", so.id, { status });
    revalidatePath("/admin/orders");
    return { ok: true, message: `Supplier says: ${String(status).replace("_", " ").toLowerCase()}` };
  } catch (e) {
    return fail(e);
  }
}

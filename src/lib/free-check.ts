import "server-only";
import { prisma } from "./db";
import { isValidIdentifier } from "./imei";
import { getSettings } from "./settings";
import { callSupplier } from "./dhru/client";
import { encodeCustomFields, parseOrderStatus, parsePlaceOrder, resultText } from "./dhru/protocol";

/** "Model: iPhone 13 Pro" / "Brand: Apple" lines from a supplier result (any common spelling). */
export function parseModel(text: string): { brand: string | null; model: string | null } {
  const line = (re: RegExp) => text.match(re)?.[1]?.trim().replace(/\s+/g, " ").slice(0, 80) || null;
  const model = line(/(?:^|\n)\s*(?:model(?:\s*name)?|device(?:\s*name)?|model\s*description)\s*[:\-=]\s*([^\n]+)/i);
  let brand = line(/(?:^|\n)\s*(?:brand|manufacturer|make)\s*[:\-=]\s*([^\n]+)/i);
  if (!brand && model && /^iphone|^ipad|^apple/i.test(model)) brand = "Apple";
  if (!brand && model && /^galaxy|^sm-/i.test(model)) brand = "Samsung";
  return { brand, model };
}

/** Remember a TAC → model mapping. Imported rows (the owner's list) are never overwritten by guesses. */
export async function rememberTac(imei: string, brand: string | null, model: string | null, source: "supplier" | "learned") {
  if (!/^\d{15}$/.test(imei) || !model) return;
  const tac = imei.slice(0, 8);
  const existing = await prisma.tacModel.findUnique({ where: { tac } });
  if (existing?.source === "import") return;
  await prisma.tacModel.upsert({
    where: { tac },
    create: { tac, brand: brand ?? "", model, source },
    update: { brand: brand ?? existing?.brand ?? "", model, source },
  });
}

/** Ask the supplier service chosen for free checks, waiting up to ~20 s for an instant answer. */
async function askSupplier(imei: string, variantId: string) {
  const v = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { supplier: true } });
  if (!v?.supplier || !v.supplierServiceId || !v.supplier.isEnabled) return null;
  const placed = await callSupplier(v.supplier, "placeimeiorder", { ID: v.supplierServiceId, IMEI: imei, CUSTOMFIELD: encodeCustomFields({}) });
  const ref = placed.reply ? parsePlaceOrder(placed.reply) : null;
  if (!ref || !("ref" in ref)) return null;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const got = await callSupplier(v.supplier, "getimeiorder", { ID: ref.ref });
    const st = got.reply ? parseOrderStatus(got.reply) : null;
    if (st && "status" in st && st.status === "SUCCESS") return parseModel(resultText(st.code || st.comments));
    if (st && "status" in st && st.status === "REJECTED") return null;
  }
  return null;
}

export type FreeCheckResult =
  | { ok: true; imei: string; valid: true; brand: string | null; model: string | null; left: number }
  | { ok: true; imei: string; valid: false; left: number }
  | { ok: false; error: "limit" | "signin" };

/** How many free checks this account (and this browser) has left today. */
export async function checksLeft(userId: string, deviceId: string | null) {
  const settings = await getSettings();
  const since = new Date(Date.now() - 86_400_000);
  const used = await prisma.freeCheck.count({ where: { createdAt: { gte: since }, OR: [{ userId }, ...(deviceId ? [{ deviceId }] : [])] } });
  return Math.max(0, settings.freeChecksPerDay - used);
}

/**
 * Free check: valid IMEI (check digit), then brand and model from the TAC list, the supplier service if one is set,
 * or nothing. Every check counts toward the daily limit, so the free service can't be scraped.
 */
export async function runFreeCheck(userId: string, deviceId: string | null, raw: string): Promise<FreeCheckResult> {
  const imei = raw.replace(/[\s\-/.]/g, "");
  const left = await checksLeft(userId, deviceId);
  if (left <= 0) return { ok: false, error: "limit" };
  if (!isValidIdentifier(imei, "imei")) {
    await prisma.freeCheck.create({ data: { userId, deviceId, imei: imei.slice(0, 20) } });
    return { ok: true, imei, valid: false, left: left - 1 };
  }
  let tac = await prisma.tacModel.findUnique({ where: { tac: imei.slice(0, 8) } });
  if (!tac) {
    const settings = await getSettings();
    if (settings.freeCheckVariantId) {
      const found = await askSupplier(imei, settings.freeCheckVariantId).catch(() => null);
      if (found?.model) {
        await rememberTac(imei, found.brand, found.model, "supplier");
        tac = await prisma.tacModel.findUnique({ where: { tac: imei.slice(0, 8) } });
      }
    }
  }
  await prisma.freeCheck.create({ data: { userId, deviceId, imei, brand: tac?.brand || null, model: tac?.model || null } });
  return { ok: true, imei, valid: true, brand: tac?.brand || null, model: tac?.model || null, left: left - 1 };
}

/**
 * Import a TAC list (CSV with a header: tac,brand,model — the Osmocom export "tac,name,…,brand…" works too).
 * Returns how many rows were saved.
 */
export async function importTacCsv(csv: string): Promise<number> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return 0;
  const split = (l: string) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const iTac = head.findIndex((h) => h === "tac");
  const iBrand = head.findIndex((h) => h === "brand" || h === "manufacturer");
  const iModel = head.findIndex((h) => h === "model" || h === "name" || h === "marketing name");
  if (iTac < 0 || iModel < 0) throw new Error("The CSV needs columns tac and model (or name)");
  let n = 0;
  const rows: { tac: string; brand: string; model: string }[] = [];
  for (const l of lines.slice(1)) {
    const c = split(l);
    const tac = (c[iTac] ?? "").replace(/\D/g, "");
    const model = (c[iModel] ?? "").slice(0, 80);
    if (tac.length !== 8 || !model) continue;
    rows.push({ tac, brand: (iBrand >= 0 ? c[iBrand] : "").slice(0, 60), model });
  }
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await prisma.$transaction(chunk.map((r) => prisma.tacModel.upsert({ where: { tac: r.tac }, create: { ...r, source: "import" }, update: { ...r, source: "import" } })));
    n += chunk.length;
  }
  return n;
}

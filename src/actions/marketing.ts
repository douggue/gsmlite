"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { parseAmount } from "@/lib/money";
import { getSettings, setSetting } from "@/lib/settings";
import { parseCountryRule } from "@/lib/countries";
import { endDeal, startDeal } from "@/lib/deals";
import { channelPost } from "@/lib/marketing";
import { t } from "@/lib/text";

type R = { ok: true; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
const LANGS = ["ht", "fr", "en", "es"];
const loc = (form: FormData, p: string) => Object.fromEntries(LANGS.map((l) => [l, String(form.get(`${p}_${l}`) ?? "").trim().slice(0, 300)]).filter(([, v]) => v));
const date = (v: FormDataEntryValue | null) => (v && String(v) ? new Date(String(v)) : null);

export async function saveSlide(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    const id = String(form.get("id") ?? "") || null;
    const title = loc(form, "title");
    if (!Object.keys(title).length) return { ok: false, error: "Give the slide a title" };
    const href = (v: FormDataEntryValue | null) => {
      const h = String(v ?? "").trim();
      return h.startsWith("/") || h.startsWith("https://") ? h : "";
    };
    const data = {
      tag: loc(form, "tag"), label: loc(form, "label"), title, bullets: loc(form, "bullets"),
      buttonText: loc(form, "btn"), buttonHref: href(form.get("buttonHref")) || "/",
      button2Text: loc(form, "btn2"), button2Href: href(form.get("button2Href")) || null,
      image: String(form.get("image") ?? "") || null,
      isActive: form.get("isActive") === "on",
      startsAt: date(form.get("startsAt")), endsAt: date(form.get("endsAt")),
      sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
      ...parseCountryRule(form),
    };
    const s = id ? await prisma.homeSlide.update({ where: { id }, data }) : await prisma.homeSlide.create({ data });
    await audit(staff.id, id ? "slide.update" : "slide.create", "HomeSlide", s.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Slide saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSlide(id: string): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    await prisma.homeSlide.delete({ where: { id } });
    await audit(staff.id, "slide.delete", "HomeSlide", id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Deleted" };
  } catch (e) {
    return fail(e);
  }
}

export async function startWeeklyDeal(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    const variantId = String(form.get("variantId") ?? "");
    const price = parseAmount(String(form.get("price") ?? ""));
    const endsAt = date(form.get("endsAt"));
    if (!variantId || !price) return { ok: false, error: "Pick the service and the deal price" };
    if (!endsAt || endsAt <= new Date()) return { ok: false, error: "Pick when the deal ends" };
    const deal = await startDeal(variantId, price, endsAt, staff.id);
    await audit(staff.id, "deal.start", "Deal", deal.id, { variantId, price, endsAt });
    if (form.get("announce") === "on") {
      const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId }, include: { product: true } });
      if (await channelPost(`🔥 Deal of the week: ${t(v.product.name, "en")} at $${(price / 100).toFixed(2)} until ${endsAt.toDateString()}`, `/products/${v.product.slug}`, "Order")) {
        await prisma.deal.update({ where: { id: deal.id }, data: { announcedAt: new Date() } });
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Deal started" };
  } catch (e) {
    return fail(e);
  }
}

export async function stopDeal(id: string): Promise<R> {
  try {
    const staff = await assertStaff("catalog.manage");
    await endDeal(id);
    await audit(staff.id, "deal.end", "Deal", id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Deal ended" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveOffers(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    const n = (k: string, max: number) => Math.max(0, Math.min(max, Number(String(form.get(k) ?? "0").replace(",", ".")) || 0));
    const s = await getSettings();
    await setSetting("topupBonus", { firstPct: n("firstPct", 50), pct: n("pct", 50), minUsd: parseAmount(String(form.get("minUsd") ?? "0") || "0") ?? 0 });
    await setSetting("freeChecksPerDay", Math.round(n("freeChecks", 50)));
    await setSetting("welcomeCreditUsd", parseAmount(String(form.get("welcome") ?? "0") || "0") ?? 0);
    await setSetting("referralRewardHtg", parseAmount(String(form.get("refReward") ?? "0") || "0") ?? 0);
    await setSetting("referralFriendRewardHtg", parseAmount(String(form.get("refFriend") ?? "0") || "0") ?? 0);
    await setSetting("referralEnabled", form.get("referralEnabled") === "on");
    await setSetting("autoMessages", {
      ...s.autoMessages,
      inactiveOn: form.get("inactiveOn") === "on",
      inactiveDays: Math.round(n("inactiveDays", 365)) || 14,
      afterUnlockOn: form.get("afterUnlockOn") === "on",
      backOnlineTelegram: form.get("backOnlineTelegram") === "on",
      toolUpdateTelegram: form.get("toolUpdateTelegram") === "on",
      dealTelegram: form.get("dealTelegram") === "on",
    });
    await audit(staff.id, "settings.marketing", "Settings", null, Object.fromEntries(form));
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

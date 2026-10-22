"use server";
import { locales } from "@/i18n/routing";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CURRENCY_COOKIE } from "@/lib/prefs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { isCity } from "@/lib/cities";
import { normalizePhone } from "@/lib/phone";

const profile = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional(),
  locale: z.enum(locales),
  displayCurrency: z.enum(["HTG", "USD"]),
});

export async function updateProfile(form: FormData) {
  const user = await assertUser();
  const data = profile.safeParse(Object.fromEntries(form));
  if (!data.success) return { ok: false as const };
  const city = form.get("city");
  await prisma.user.update({
    where: { id: user.id },
    data: { ...data.data, phone: normalizePhone(data.data.phone) ?? (data.data.phone || null), city: isCity(city) ? city : null },
  });
  // The display currency follows this browser's cookie (see getDisplayCurrency), so saving the profile updates it too.
  (await cookies()).set(CURRENCY_COOKIE, data.data.displayCurrency, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function markNotificationsRead() {
  const user = await assertUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

/** Account → Notifications: a one-time t.me link that links this account to the customer's Telegram. */
export async function telegramLink(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await assertUser();
  const { botUsername, telegramReady } = await import("@/lib/telegram");
  if (!telegramReady()) return { ok: false, error: "off" };
  const name = await botUsername();
  if (!name) return { ok: false, error: "off" };
  const { randomToken } = await import("@/lib/crypto");
  const code = randomToken(16).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
  await prisma.user.update({ where: { id: user.id }, data: { telegramLinkCode: code } });
  return { ok: true, url: `https://t.me/${name}?start=${code}` };
}

export async function telegramUnlink(): Promise<{ ok: true }> {
  const user = await assertUser();
  await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null, telegramLinkCode: null } });
  revalidatePath("/[locale]/account/notifications", "page");
  return { ok: true };
}

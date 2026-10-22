import "server-only";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { sendTelegram } from "./telegram";
import { siteUrl } from "./site-url";
import { notify } from "./notify";
import { t } from "./text";

/** Staff alert on Telegram (new payment to check, KYC request, supplier problem). Silent when not configured. */
export async function staffAlert(text: string, path?: string) {
  const s = await getSettings();
  if (!s.telegramStaffChat) return;
  await sendTelegram(s.telegramStaffChat, text, path ? { url: `${siteUrl()}${path}`, label: "Open" } : undefined);
}

/** Public channel post. Never about hidden or country-limited services. */
export async function channelPost(text: string, path?: string, label = "Open") {
  const s = await getSettings();
  if (!s.telegramChannel) return false;
  return sendTelegram(s.telegramChannel, text, path ? { url: `${siteUrl()}/en${path}`, label } : undefined);
}

/** New service, price drop or back online → channel (when switched on in Marketing). */
export async function announceChange(kind: "NEW" | "PRICE_DOWN" | "BACK", productId: string, newPrice?: number | null) {
  const s = await getSettings();
  if (!s.autoMessages.backOnlineTelegram || !s.telegramChannel) return;
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p || !p.isPublished || p.hideFromGoogle || p.countryMode !== "all") return;
  const name = t(p.name, "en");
  const price = newPrice != null ? ` · $${(newPrice / 100).toFixed(2)}` : "";
  const text = kind === "NEW" ? `🆕 New service: ${name}${price}` : kind === "PRICE_DOWN" ? `⬇️ Price down: ${name}${price}` : `✅ Back online: ${name}`;
  await channelPost(text, `/products/${p.slug}`, "Order");
}

/** A tool update was published → channel (when "tool updates to Telegram" is on). */
export async function announceToolUpdate(articleId: string) {
  const s = await getSettings();
  if (!s.autoMessages.toolUpdateTelegram || !s.telegramChannel) return;
  const a = await prisma.newsArticle.findUnique({ where: { id: articleId } });
  if (!a || !a.isPublished || a.kind !== "tool") return;
  const summary = t(a.excerpt, "en");
  const text = `🛠 ${a.toolName ?? t(a.title, "en")}${a.version ? ` ${a.version}` : ""} is out${summary ? `\n${summary}` : ""}`;
  await channelPost(text, `/news/${a.slug}`, "Read more");
}

/** Customers who already got this message since `since` (the cron runs every few minutes). */
async function sentSince(type: string, userIds: string[], since: Date) {
  if (!userIds.length) return new Set<string>();
  const rows = await prisma.notification.findMany({ where: { type, userId: { in: userIds }, createdAt: { gte: since } }, select: { userId: true } });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Daily customer messages (Marketing → Automatic messages):
 * - customers in a price group (technicians) with no order for N days get one "new services are waiting" message
 * - three days after an unlock is delivered: "check or unlock your next phone"
 * Each message is sent once (checked against earlier notifications).
 */
export async function dailyMessages() {
  const s = await getSettings();
  let sent = 0;
  if (s.autoMessages.inactiveOn && s.autoMessages.inactiveDays > 0) {
    const day = 86_400_000;
    const from = new Date(Date.now() - (s.autoMessages.inactiveDays + 1) * day);
    const to = new Date(Date.now() - s.autoMessages.inactiveDays * day);
    const users = await prisma.user.findMany({
      where: { priceGroupId: { not: null }, status: "ACTIVE", orders: { some: { paidAt: { gte: from, lt: to } }, none: { paidAt: { gte: to } } } },
      select: { id: true },
      take: 500,
    });
    const told = await sentSince("marketing_inactive", users.map((u) => u.id), from);
    for (const u of users) {
      if (told.has(u.id)) continue;
      await notify(u.id, "marketing_inactive", {}, "/news?tab=changes");
      sent++;
    }
  }
  if (s.autoMessages.afterUnlockOn) {
    const d3 = new Date(Date.now() - 3 * 86_400_000);
    const d4 = new Date(Date.now() - 4 * 86_400_000);
    const orders = await prisma.order.findMany({
      where: { status: "FULFILLED", fulfilledAt: { gte: d4, lt: d3 }, items: { some: { status: "DELIVERED", variant: { product: { category: { slug: { contains: "unlock" } } } } } } },
      select: { userId: true },
      distinct: ["userId"],
      take: 500,
    });
    const told = await sentSince("marketing_next_phone", orders.map((o) => o.userId), d4);
    for (const o of orders) {
      if (told.has(o.userId)) continue;
      await notify(o.userId, "marketing_next_phone", {}, "/check");
      sent++;
    }
  }
  return sent;
}

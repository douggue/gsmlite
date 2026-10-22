import { siteUrl } from "./site-url";
import ht from "@/messages/ht.json";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { prisma, type Tx } from "./db";
import { emailEnabled, sendEmail } from "./email";
import { formatMoney } from "./money";
import { sendPush } from "./push";

export type NotificationType =
  | "deposit_approved"
  | "deposit_rejected"
  | "deposit_held"
  | "order_paid"
  | "order_fulfilled"
  | "order_refunded"
  | "exchange_done"
  | "wallet_adjusted"
  | "referral_rewarded"
  | "kyc_approved"
  | "kyc_rejected"
  | "kyc_needs_more"
  | "marketing_inactive"
  | "marketing_next_phone"
  | "new_device";

const CATALOGS: Record<string, { notifications: Record<string, string> }> = { ht, fr, en, es };

function render(type: string, params: Record<string, string | number>, locale: string) {
  const template = (CATALOGS[locale] ?? ht).notifications[type] ?? ht.notifications[type as keyof typeof ht.notifications] ?? type;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    if (k === "amount" && typeof v === "number") return formatMoney(v, (params.currency as "HTG" | "USD") ?? "HTG", locale);
    return v === undefined ? "" : String(v);
  });
}

/**
 * In-app notification, plus a push notification on the devices where the customer turned them on,
 * plus an email when email is configured and the customer keeps email notifications on.
 * WhatsApp delivery plugs in here once a WhatsApp Business account is connected.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  params: Record<string, string | number> = {},
  link?: string,
  db: Tx = prisma,
) {
  await db.notification.create({ data: { userId, type, params, link } });
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, locale: true, status: true, notifyPrefs: true, telegramChatId: true } });
    if (!user || user.status === "CLOSED") return;
    const text = render(type, params, user.locale);
    const path = `/${user.locale}${link ?? "/account/notifications"}`;
    await sendPush(userId, { title: "GSMLite", body: text, url: path, tag: type });
    const prefs = (user.notifyPrefs ?? {}) as { email?: boolean; telegram?: boolean };
    if (user.telegramChatId && prefs.telegram !== false) {
      const { sendTelegram } = await import("./telegram");
      await sendTelegram(user.telegramChatId, text, { url: `${siteUrl()}${path}`, label: "GSMLite" });
    }
    if (!emailEnabled() || prefs.email === false) return;
    const url = `${siteUrl()}${path}`;
    await sendEmail({
      to: user.email,
      subject: `GSMLite: ${text.slice(0, 80)}`,
      text: `${text}\n\n${url}`,
      html: `<p style="font-family:Arial,sans-serif;font-size:15px">${text.replace(/[<>&]/g, "")}</p><p><a href="${url}" style="font-family:Arial,sans-serif;color:#1F7A4D">${url}</a></p>`,
    });
  } catch (e) {
    console.error("notification delivery failed", e);
  }
}

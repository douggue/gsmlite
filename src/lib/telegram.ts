import "server-only";

/**
 * Telegram bot (channel posts and staff alerts). TELEGRAM_BOT_TOKEN lives only in the hosting env; the channel
 * (e.g. @gsmlite or -100…) and the staff chat id are set in Settings → Notifications.
 */
export function telegramReady() {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) console.error("telegram", method, json.description);
    return json.ok ? (json.result ?? null) : null;
  } catch (e) {
    console.error("telegram", method, e);
    return null;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Post to a channel or chat. `text` is plain text; an optional link becomes a button. Returns true when sent. */
export async function sendTelegram(chat: string, text: string, link?: { url: string; label: string }) {
  if (!chat) return false;
  const r = await call("sendMessage", {
    chat_id: chat,
    text: esc(text),
    parse_mode: "HTML",
    disable_web_page_preview: !link,
    ...(link ? { reply_markup: { inline_keyboard: [[{ text: link.label, url: link.url }]] } } : {}),
  });
  return !!r;
}

export async function channelMembers(chat: string): Promise<number | null> {
  if (!chat) return null;
  return call<number>("getChatMemberCount", { chat_id: chat });
}

/** The bot's @username (asked once per server start), for t.me links. */
let botName: string | null = null;
export async function botUsername(): Promise<string | null> {
  if (botName) return botName;
  const me = await call<{ username?: string }>("getMe", {});
  botName = me?.username ?? null;
  return botName;
}

/** Secret Telegram sends back on every webhook call, derived from the bot token (nothing extra to configure). */
export async function webhookSecret(): Promise<string> {
  const { hmac } = await import("./crypto");
  return hmac(`telegram-webhook:${process.env.TELEGRAM_BOT_TOKEN ?? ""}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}

/** Point the bot at this site (Settings → Telegram → Connect the bot). */
export async function connectWebhook(siteUrl: string): Promise<boolean> {
  const r = await call<boolean>("setWebhook", { url: `${siteUrl}/api/telegram/webhook`, secret_token: await webhookSecret(), allowed_updates: ["message"] });
  return !!r;
}

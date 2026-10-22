import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTelegram, webhookSecret } from "@/lib/telegram";

const REPLIES = {
  linked: { ht: "✅ Kont GSMLite ou konekte. W ap resevwa nouvèl kòmand ou yo isit la. Ekri /stop pou kanpe.", fr: "✅ Votre compte GSMLite est relié. Vos commandes s'afficheront ici. Écrivez /stop pour arrêter.", en: "✅ Your GSMLite account is linked. Order updates will arrive here. Send /stop to turn them off.", es: "✅ Tu cuenta GSMLite está vinculada. Aquí recibirás tus pedidos. Envía /stop para desactivarlo." },
  stopped: { ht: "Ou p ap resevwa mesaj ankò.", fr: "Vous ne recevrez plus de messages.", en: "You will not receive messages any more.", es: "Ya no recibirás mensajes." },
  unknown: { ht: "Kòd sa a pa bon. Louvri GSMLite → Notifikasyon → Telegram.", fr: "Ce code n'est pas valable. Ouvrez GSMLite → Notifications → Telegram.", en: "This code is not valid. Open GSMLite → Notifications → Telegram.", es: "Este código no es válido. Abre GSMLite → Notificaciones → Telegram." },
} as const;
const say = (k: keyof typeof REPLIES, locale?: string | null) => (REPLIES[k] as Record<string, string>)[locale ?? "ht"] ?? REPLIES[k].ht;

/** Telegram bot updates: "/start CODE" links a customer's account, "/stop" unlinks it. */
export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== (await webhookSecret())) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const update = (await req.json().catch(() => null)) as { message?: { chat?: { id?: number; type?: string }; text?: string } } | null;
  const chat = update?.message?.chat;
  const text = update?.message?.text?.trim() ?? "";
  if (!chat?.id || chat.type !== "private") return NextResponse.json({ ok: true });
  const chatId = String(chat.id);
  if (text === "/stop") {
    const u = await prisma.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true, locale: true } });
    if (u) await prisma.user.update({ where: { id: u.id }, data: { telegramChatId: null } });
    await sendTelegram(chatId, say("stopped", u?.locale));
    return NextResponse.json({ ok: true });
  }
  const code = /^\/start\s+([A-Za-z0-9_-]{10,64})$/.exec(text)?.[1];
  if (code) {
    const u = await prisma.user.findUnique({ where: { telegramLinkCode: code }, select: { id: true, locale: true } });
    if (!u) {
      await sendTelegram(chatId, say("unknown"));
      return NextResponse.json({ ok: true });
    }
    // One Telegram chat per account: unlink it from any other account first.
    await prisma.user.updateMany({ where: { telegramChatId: chatId, NOT: { id: u.id } }, data: { telegramChatId: null } });
    await prisma.user.update({ where: { id: u.id }, data: { telegramChatId: chatId, telegramLinkCode: null } });
    await sendTelegram(chatId, say("linked", u.locale));
  }
  return NextResponse.json({ ok: true });
}

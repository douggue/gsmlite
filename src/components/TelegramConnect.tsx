"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { telegramLink, telegramUnlink } from "@/actions/account";

/** Account → Notifications: get order updates in Telegram (one tap opens the bot, which links the account). */
export function TelegramConnect({ linked }: { linked: boolean }) {
  const t = useTranslations("notifications");
  const [on, setOn] = useState(linked);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <b className="block text-sm">Telegram</b>
        <span className="text-xs text-muted">{on ? t("telegramOn") : waiting ? t("telegramWaiting") : t("telegramHint")}</span>
        {error && <span role="alert" className="block text-xs text-danger">{t("telegramOff")}</span>}
      </div>
      {on ? (
        <button type="button" className="btn-secondary min-h-10" disabled={pending} onClick={() => start(async () => { await telegramUnlink(); setOn(false); })}>{t("telegramDisconnect")}</button>
      ) : (
        <button type="button" className="btn-primary min-h-10" disabled={pending}
          onClick={() => start(async () => {
            const r = await telegramLink();
            if (!r.ok) return setError(true);
            setWaiting(true);
            window.location.href = r.url;
          })}>
          {t("telegramConnect")}
        </button>
      )}
    </div>
  );
}

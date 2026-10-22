"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { freeCheck, type CheckResponse } from "@/actions/check";
import { isValidIdentifier } from "@/lib/imei";
import { Price } from "../Money";

type Props = { initial: string; signedIn: boolean; left: number; perDay: number; full: { slug: string; price: number } | null; creditDays: number };

export function CheckForm({ initial, signedIn, left: startLeft, perDay, full, creditDays }: Props) {
  const g = useTranslations("gl.check");
  const [imei, setImei] = useState(initial);
  const [left, setLeft] = useState(startLeft);
  const [res, setRes] = useState<CheckResponse | null>(null);
  const [localValid, setLocalValid] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  const clean = imei.replace(/[\s\-/.]/g, "");

  function run() {
    setRes(null);
    setLocalValid(isValidIdentifier(clean, "imei"));
    if (!signedIn) return; // the check digit is tested right here; model and brand need an account
    start(async () => {
      const r = await freeCheck(clean);
      setRes(r);
      if (r.ok) setLeft(r.left);
    });
  }
  const ok = res?.ok ? res : null;
  const valid = ok ? ok.valid : localValid;
  const model = ok?.model;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {signedIn && <span className="rounded-full bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary">{g("left", { left, total: perDay })}</span>}
      </div>
      <section className="rounded-[20px] bg-[#111418] px-4 py-5 text-white">
        <h1 className="display text-[30px] leading-[1.1] tracking-tight">{g("title1")}<br /><span className="text-[#7ce0a8]">{g("title2")}</span></h1>
        <p className="mb-4 mt-2.5 text-sm text-[#c9cfc6]">{g("sub")}</p>
        <form onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label htmlFor="ci" className="mb-1.5 block text-[13px] font-semibold">IMEI</label>
          <input id="ci" inputMode="numeric" autoComplete="off" value={imei} onChange={(e) => setImei(e.target.value.slice(0, 24))} placeholder="35 678901 234567 8"
            className="h-[52px] w-full rounded-xl border-0 bg-white px-3.5 font-mono text-lg text-[#111418] focus:outline-none focus:ring-2 focus:ring-[#7ce0a8]" />
          <button type="submit" disabled={pending || clean.length < 14} className="mt-2.5 min-h-[52px] w-full rounded-xl bg-[#7ce0a8] text-base font-semibold text-[#0b2a1a] disabled:opacity-60">
            {pending ? g("checking") : g("checkNow")}
          </button>
        </form>
      </section>

      {res && !res.ok && (
        <p role="alert" className="rounded-xl bg-[#fcebdd] px-4 py-3 text-sm text-[#8a3607]">{g(`err.${res.error}`)}</p>
      )}

      {valid !== null && (
        <section aria-label={g("result")} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <b className="text-base">{g("result")}</b>
          <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 text-sm">
            {signedIn && valid && (
              <>
                <dt className="text-muted">{g("model")}</dt><dd className="font-semibold">{model || g("unknownModel")}</dd>
                <dt className="text-muted">{g("brand")}</dt><dd className="font-semibold">{ok?.brand || "—"}</dd>
              </>
            )}
            <dt className="text-muted">IMEI</dt>
            <dd className={`font-semibold ${valid ? "text-primary" : "text-[#8a3607]"}`}>{valid ? g("valid") : g("invalid")}</dd>
            {valid && full && (
              <>
                <dt className="text-muted">{g("carrier")}</dt>
                <dd><Link href={`/products/${full.slug}#order`} className="font-semibold text-primary">{g("fullCheck")} <Price usd={full.price} /></Link></dd>
                <dt className="text-muted">{g("blacklist")}</dt>
                <dd><Link href={`/products/${full.slug}#order`} className="font-semibold text-primary">{g("fullCheck")} <Price usd={full.price} /></Link></dd>
              </>
            )}
          </dl>
          {!signedIn && valid && (
            <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13px]">
              {g("signInForModel")} <Link href={`/auth/login?next=${encodeURIComponent(`/check?imei=${clean}`)}`} className="font-semibold text-primary">{g("signIn")}</Link>
            </p>
          )}
          {valid && full && creditDays > 0 && <p className="rounded-[10px] bg-primary-soft px-3 py-2.5 text-[13px] text-primary">{g("credit")}</p>}
          {!valid && <p className="text-[13px] text-muted">{g("invalidHelp")}</p>}
        </section>
      )}

      {ok?.valid && ok.unlock && (
        <section className="flex flex-col gap-2.5 rounded-2xl border-2 border-primary bg-surface p-4">
          <b className="text-base">{model ? g("unlockThis", { model }) : g("unlockPhone")}</b>
          <span className="text-sm text-muted">{g("unlockText")}</span>
          <Link href={ok.unlock.href} className="flex min-h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white">
            {g("unlockFrom")} <Price usd={ok.unlock.from} className="ml-1" />
          </Link>
        </section>
      )}

      <p className="text-xs text-muted">{g.rich("foot", { mono: (c) => <span className="font-mono">{c}</span> })}</p>
    </div>
  );
}

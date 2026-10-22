import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { moncashMode } from "@/lib/payments/moncash";
import { telegramReady } from "@/lib/telegram";
import { describeRule } from "@/lib/countries";
import { saveSettings } from "@/actions/admin";
import { connectTelegramBot, testTelegram } from "@/actions/marketing";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { PageTitle } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";

export const metadata = { title: "Settings" };

const m = (n: number) => (n / 100).toFixed(2);
const LANGS = [["ht", "Kreyòl"], ["fr", "Français"], ["en", "English"], ["es", "Español"]] as const;

const SECTIONS = [
  ["brand", "Brand & icons"],
  ["money", "Money"],
  ["fraud", "Fraud & holds"],
  ["kyc", "KYC"],
  ["site", "Site & languages"],
  ["payments", "Payment methods"],
  ["suppliers", "Suppliers"],
  ["offers", "Offers & free check"],
  ["telegram", "Telegram"],
  ["accounts", "Accounts & referrals"],
  ["business", "Business & support"],
  ["legal", "Legal"],
  ["announcement", "Announcement bar"],
  ["maintenance", "Maintenance"],
] as const;

function Field({ name, label, value, hint, type = "text" }: { name: string; label: string; value: string | number; hint?: string; type?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} defaultValue={value} type={type} className="input" inputMode={type === "number" ? "decimal" : undefined} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Section({ id, title, children, sub }: { id: string; title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-6 space-y-4 p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

const grid = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/** Settings & staff (mockup): every store setting in 14 sections, one save (asks for the authenticator code again). */
export default async function SettingsPage() {
  await requireStaff("settings.manage");
  const s = await getSettings();
  let mode = "mock";
  try {
    mode = moncashMode();
  } catch {
    mode = "not configured";
  }
  const env = (ok: boolean, name: string) => <span className={ok ? "text-success" : "text-warning"}>{name} {ok ? "✓ set" : "missing"}</span>;

  return (
    <>
      <PageTitle title="Settings & staff" sub="Changing settings asks for your authenticator code again. Keys and passwords are never stored here: they go in the hosting environment." />
      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-6 lg:h-fit">
          <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {SECTIONS.map(([id, label]) => <li key={id} className="shrink-0"><a href={`#${id}`} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface-2">{label}</a></li>)}
            <li className="shrink-0"><Link href="/admin/staff" className="block rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-2">Staff →</Link></li>
          </ul>
        </nav>

        <ActionForm action={saveSettings} className="min-w-0 space-y-5">
          <Section id="brand" title="Brand & icons" sub="Square icon: the browser tab icon, the iPhone home-screen icon and the install icon are all made from it.">
            <div className="grid gap-6 lg:grid-cols-2">
              <ImageField name="logoUrl" label="Logo (light background)" value={s.logoUrl} folder="brand" aspect="aspect-[3/1]" hint="Wide PNG or WebP with transparent background, about 600×200 px. Empty = built-in logo." />
              <ImageField name="logoDarkUrl" label="Logo for dark mode (optional)" value={s.logoDarkUrl} folder="brand" aspect="aspect-[3/1]" hint="A light version of the logo. Empty = same as above." />
              <ImageField name="appIconUrl" label="App icon & favicon" value={s.appIconUrl} folder="brand" aspect="aspect-square" hint="Square PNG, at least 512×512 px, no transparency needed. Empty = built-in icon." />
              <ImageField name="ogImageUrl" label="Social share image" value={s.ogImageUrl} folder="brand" aspect="aspect-[1200/630]" hint="1200×630 px. Shown when the site is shared on WhatsApp, Telegram or Facebook." />
              <ImageField name="heroImageUrl" label="Homepage picture (optional)" value={s.heroImageUrl} folder="brand" hint="About 1200×900 px." />
            </div>
          </Section>

          <Section id="money" title="Money">
            <div className={grid}>
              <Field name="htgPerUsd" label="HTG per 1 USD" value={s.htgPerUsd} type="number" hint="Prices are in USD; gourdes use this rate." />
              <Field name="exchangeSpreadBps" label="Exchange spread (basis points)" value={s.exchangeSpreadBps} type="number" hint="150 = 1.5% against the customer." />
              <Field name="exchangeFeeBps" label="Exchange fee (basis points)" value={s.exchangeFeeBps} type="number" />
              <Field name="exchangeQuoteSeconds" label="Quote valid for (seconds)" value={s.exchangeQuoteSeconds} type="number" />
              <Field name="minDepositHtg" label="Smallest top-up (HTG)" value={m(s.minDepositHtg)} />
              <Field name="maxDepositHtg" label="Largest top-up (HTG)" value={m(s.maxDepositHtg)} />
            </div>
          </Section>

          <Section id="fraud" title="Fraud & holds">
            <div className={grid}>
              <Field name="holdThresholdHtg" label="Hold deposits above (HTG)" value={m(s.holdThresholdHtg)} />
              <Field name="holdHours" label="for (hours)" value={s.holdHours} type="number" />
              <Field name="reviewOrderThresholdHtg" label="Review orders above (HTG)" value={m(s.reviewOrderThresholdHtg)} hint="Staff check before anything is delivered." />
              <Field name="approvalThresholdHtg" label="Second approval for wallet changes above (HTG)" value={m(s.approvalThresholdHtg)} />
              <Field name="newAccountDays" label="New account period (days)" value={s.newAccountDays} type="number" />
              <Field name="newAccountDailyLimitHtg" label="New account daily limit (HTG)" value={m(s.newAccountDailyLimitHtg)} />
              <Field name="maxAccountsPerDevice" label="Flag a browser used by more accounts than" value={s.maxAccountsPerDevice} type="number" />
              <Field name="autoRefundHours" label="Refund undelivered orders after (hours)" value={s.autoRefundHours} type="number" hint="0 = off." />
            </div>
          </Section>

          <Section id="kyc" title="KYC" sub={<>Levels, documents and rules (top-ups above, card payments, technician prices, orders above) are in <Link href="/admin/kyc/settings" className="font-semibold text-primary">KYC review → Rules</Link>.</>}>
            <div className={grid}>
              <Field name="kycRetentionMonths" label="Delete documents after closing (months)" value={s.kycRetentionMonths} type="number" />
            </div>
          </Section>

          <Section id="site" title="Site & languages">
            <fieldset>
              <legend className="label">Languages on</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {LANGS.map(([code, name]) => <label key={code} className="flex items-center gap-2"><input type="checkbox" name={`lang_${code}`} defaultChecked={s.languages.includes(code)} /> {name}</label>)}
              </div>
              <p className="mt-1 text-xs text-muted">A language that is off disappears from the switcher. Its pages stay reachable for links already shared.</p>
            </fieldset>
            <div className={grid}>
              <Field name="defaultCountry" label="Country when unknown" value={s.defaultCountry} hint="2 letters (HT). Used when neither the location nor the account says." />
            </div>
          </Section>

          <Section id="payments" title="Payment methods" sub={<>Who sees each method (by country), card payments and your own methods (USDT, bank…) are on <Link href="/admin/payment-methods" className="font-semibold text-primary">Payment methods</Link>.</>}>
            <ul className="space-y-1 text-sm">
              <li>MonCash: <b>{s.moncashEnabled ? "on" : "off"}</b> · {describeRule(s.payCountries.moncash)} · mode <b>{mode}</b> · {env(!!process.env.MONCASH_CLIENT_ID, "MONCASH_CLIENT_ID")}</li>
              <li>NatCash: <b>{s.natcashEnabled ? "on" : "off"}</b> · {describeRule(s.payCountries.natcash)}</li>
              <li>Card (Stripe): <b>{s.cardEnabled ? "on" : "off"}</b> · {describeRule(s.payCountries.card)} · {env(!!process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY")}</li>
            </ul>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="moncashEnabled" defaultChecked={s.moncashEnabled} /> MonCash on</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="natcashEnabled" defaultChecked={s.natcashEnabled} /> NatCash on</label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="natcashRecipientName" label="NatCash recipient name" value={s.natcashRecipientName} />
              <Field name="natcashRecipientPhone" label="NatCash recipient number" value={s.natcashRecipientPhone} />
            </div>
            <div className="max-w-xs">
              <ImageField name="natcashQrUrl" label="NatCash QR code (optional)" value={s.natcashQrUrl} folder="brand" aspect="aspect-square" />
            </div>
          </Section>

          <Section id="suppliers" title="Suppliers" sub="Defaults on the import screen, and the success-rate watch (checked every few minutes on the last 14 days).">
            <div className={grid}>
              <Field name="markupPct" label="Default markup (%)" value={s.supplierDefaults.markupPct} type="number" />
              <Field name="minProfitUsd" label="Minimum profit (USD)" value={m(s.supplierDefaults.minProfitUsd)} />
              <label className="block"><span className="label">Round prices</span>
                <select name="round" defaultValue={s.supplierDefaults.round} className="input">
                  <option value="none">No rounding</option><option value="99">Up to .99</option><option value="49">Up to .49 / .99</option>
                </select>
              </label>
            </div>
            <div className={grid}>
              <Field name="srMinOrders" label="Show success rate after (orders)" value={s.successRate.minOrders} type="number" />
              <Field name="srAlert" label="Alert staff under (%)" value={s.successRate.alertBelowPct} type="number" hint="0 = off." />
              <Field name="srPause" label="Pause the service under (%)" value={s.successRate.pauseBelowPct} type="number" hint="0 = off. Staff switch it back on." />
            </div>
          </Section>

          <Section id="offers" title="Offers & free check" sub={<>Top-up bonus, welcome credit, free IMEI checks, referral rewards and automatic messages are on <Link href="/admin/marketing" className="font-semibold text-primary">Marketing</Link>.</>}>
            <p className="text-sm">Free checks per day: <b>{s.freeChecksPerDay}</b> · Top-up bonus: <b>{s.topupBonus.firstPct}% first, {s.topupBonus.pct}% above ${m(s.topupBonus.minUsd)}</b></p>
          </Section>

          <Section id="telegram" title="Telegram" sub={<>The bot token goes in the hosting environment ({env(telegramReady(), "TELEGRAM_BOT_TOKEN")}). Add the bot as an admin of your channel, and to the staff group.</>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field name="telegramUrl" label="Public link shown to customers" value={s.telegramUrl} hint="https://t.me/yourchannel" />
              <Field name="telegramChannel" label="Channel for announcements" value={s.telegramChannel} hint="@yourchannel" />
              <Field name="telegramStaffChat" label="Staff chat id for alerts" value={s.telegramStaffChat} hint="-100… (send /id to @userinfobot in the group)" />
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton label="Send a test message" action={testTelegram} />
              <ActionButton label="Connect the bot (customer notifications)" action={connectTelegramBot} />
            </div>
          </Section>

          <Section id="accounts" title="Accounts & referrals">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="referralEnabled" defaultChecked={s.referralEnabled} /> Referral program on</label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="requireEmailVerification" defaultChecked={s.requireEmailVerification} className="mt-1" /> <span>Confirm email before buying or topping up <span className="text-muted">(turns itself off while email sending is off)</span></span></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="newsletterEnabled" defaultChecked={s.newsletterEnabled} /> Newsletter sign-up in the footer</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="referralRewardHtg" label="Reward to the person who invited (HTG)" value={m(s.referralRewardHtg)} />
              <Field name="referralMinOrderHtg" label="Friend's first order at least (HTG)" value={m(s.referralMinOrderHtg)} />
            </div>
          </Section>

          <Section id="business" title="Business & support">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="businessName" label="Business name" value={s.businessName} />
              <Field name="businessAddress" label="Address" value={s.businessAddress} />
              <Field name="whatsappNumber" label="Support WhatsApp (digits, with country code)" value={s.whatsappNumber} />
              <Field name="supportHours" label="Support hours" value={s.supportHours} />
              <Field name="socialFacebook" label="Facebook URL" value={s.socialFacebook} />
              <Field name="socialInstagram" label="Instagram URL" value={s.socialInstagram} />
              <Field name="socialTiktok" label="TikTok URL" value={s.socialTiktok} />
            </div>
          </Section>

          <Section id="legal" title="Legal" sub={<>The texts of the terms, privacy and refund pages are edited in <Link href="/admin/pages" className="font-semibold text-primary">Pages</Link>. These details appear in the footer and on receipts.</>}>
            <div className={grid}>
              <Field name="legalEntity" label="Legal entity" value={s.legal.entity} hint="e.g. GSMLite S.A." />
              <Field name="legalRegistration" label="Registration number" value={s.legal.registration} />
              <Field name="legalTaxId" label="Tax ID (NIF)" value={s.legal.taxId} />
              <Field name="legalEmail" label="Legal / privacy email" value={s.legal.email} />
              <Field name="legalRefundDays" label="Refund requests within (days)" value={s.legal.refundDays} type="number" />
            </div>
          </Section>

          <Section id="announcement" title="Announcement bar">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="announcementEnabled" defaultChecked={s.announcement.enabled} /> Show the bar</label>
            <div className="grid gap-4 sm:grid-cols-2">
              {LANGS.map(([l]) => <Field key={l} name={`announcement_${l}`} label={`Text (${l.toUpperCase()})`} value={s.announcement.text[l] ?? ""} />)}
              <Field name="announcementLink" label="Link (optional)" value={s.announcement.link} />
              <Field name="announcementStartsAt" label="Show from (optional)" value={s.announcement.startsAt ?? ""} type="datetime-local" />
              <Field name="announcementEndsAt" label="Hide after (optional)" value={s.announcement.endsAt ?? ""} type="datetime-local" />
            </div>
          </Section>

          <Section id="maintenance" title="Maintenance" sub="Customers see the message and cannot order or top up. Staff keep using the site normally to test.">
            <label className={`flex items-center gap-2 text-sm font-semibold ${s.maintenance.on ? "text-warning" : ""}`}><input type="checkbox" name="maintenanceOn" defaultChecked={s.maintenance.on} /> Maintenance mode {s.maintenance.on && "(ON now)"}</label>
            <div className="grid gap-4 sm:grid-cols-2">
              {LANGS.map(([l]) => <Field key={l} name={`maintenance_${l}`} label={`Message (${l.toUpperCase()})`} value={s.maintenance.message[l] ?? ""} hint={l === "ht" ? "Empty = standard message." : undefined} />)}
              <Field name="maintenanceUntil" label="Back at (optional)" value={s.maintenance.until ?? ""} type="datetime-local" />
            </div>
          </Section>

          <div className="sticky bottom-3 z-10 flex justify-end">
            <button className="btn-primary min-h-12 px-6 shadow-lg">Save settings</button>
          </div>
        </ActionForm>
      </div>
    </>
  );
}

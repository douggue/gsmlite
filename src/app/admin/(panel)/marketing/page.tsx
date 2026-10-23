import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/text";
import { formatMoney } from "@/lib/money";
import { describeRule } from "@/lib/countries";
import { channelMembers, telegramReady } from "@/lib/telegram";
import { deleteSlide, importTacList, saveCheckSettings, saveOffers, saveSlide, startWeeklyDeal, stopDeal } from "@/actions/marketing";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { LocalizedInputs } from "@/components/admin/LocalizedInputs";
import { ImageField } from "@/components/admin/ImageField";
import { CountryRuleField } from "@/components/admin/CountryRuleField";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Marketing" };
type Slide = Awaited<ReturnType<typeof prisma.homeSlide.findMany>>[number];
const dt = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

function SlideForm({ s }: { s?: Slide }) {
  const L = (v: unknown) => (v ?? {}) as Record<string, string>;
  return (
    <ActionForm action={saveSlide} className="space-y-3" resetOnSuccess={!s}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <LocalizedInputs prefix="title" label="Title" value={L(s?.title)} />
      <div className="grid gap-3 lg:grid-cols-2">
        <LocalizedInputs prefix="tag" label="Small tag (e.g. OFFER)" value={L(s?.tag)} />
        <LocalizedInputs prefix="label" label="Label (e.g. FIRST TOP-UP · OCT 1–31)" value={L(s?.label)} />
      </div>
      <LocalizedInputs prefix="bullets" label="Bullets (one per line)" value={L(s?.bullets)} textarea />
      <div className="grid gap-3 lg:grid-cols-2">
        <LocalizedInputs prefix="btn" label="Button" value={L(s?.buttonText)} />
        <LocalizedInputs prefix="btn2" label="Second button (optional)" value={L(s?.button2Text)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label><span className="label">Button link</span><input name="buttonHref" defaultValue={s?.buttonHref ?? "/account/wallet/deposit"} className="input" /></label>
        <label><span className="label">Second link</span><input name="button2Href" defaultValue={s?.button2Href ?? ""} className="input" placeholder="https://wa.me/…" /></label>
        <label><span className="label">Starts</span><input type="datetime-local" name="startsAt" defaultValue={dt(s?.startsAt ?? null)} className="input" /></label>
        <label><span className="label">Ends</span><input type="datetime-local" name="endsAt" defaultValue={dt(s?.endsAt ?? null)} className="input" /></label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ImageField name="image" label="Background picture (optional)" value={s?.image} folder="brand" aspect="aspect-[2/1]" />
        <CountryRuleField mode={s?.countryMode ?? "all"} countries={s?.countries ?? []} label="Shown to" />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} /> Active</label>
        <label className="flex items-center gap-2">Order <input name="sortOrder" type="number" defaultValue={s?.sortOrder ?? 0} className="input w-20" /></label>
        <button className="btn-primary min-h-10 px-4">{s ? "Save slide" : "Add slide"}</button>
      </div>
    </ActionForm>
  );
}

/** Marketing (mockup): home slider, deal of the week, bonuses and free offers, automatic messages, tool updates, this month. */
export default async function MarketingPage() {
  await requireStaff("content.manage");
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const now = new Date();
  const [s, slides, deal, variants, updates, checks, refs, refsOrdered, bonuses, tacs, checkVariants] = await Promise.all([
    getSettings(),
    prisma.homeSlide.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.deal.findFirst({ where: { endedAt: null }, orderBy: { startsAt: "desc" } }),
    prisma.productVariant.findMany({ where: { isActive: true, product: { isPublished: true } }, include: { product: { select: { name: true } } }, orderBy: [{ product: { sortOrder: "asc" } }, { sortOrder: "asc" }], take: 300 }),
    prisma.newsArticle.findMany({ where: { kind: "tool" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.freeCheck.findMany({ where: { createdAt: { gte: monthStart } }, select: { imei: true, userId: true } }),
    prisma.referral.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.referral.count({ where: { createdAt: { gte: monthStart }, status: "REWARDED" } }),
    prisma.ledgerEntry.groupBy({ by: ["currency"], where: { createdAt: { gte: monthStart }, transaction: { type: "BONUS" }, amount: { gt: 0 } }, _sum: { amount: true } }),
    prisma.tacModel.groupBy({ by: ["source"], _count: true }),
    prisma.productVariant.findMany({ where: { isActive: true, supplierId: { not: null }, product: { serviceType: "IMEI" } }, include: { product: { select: { name: true } } }, orderBy: { priceUsd: "asc" }, take: 200 }),
  ]);
  const unlocksAfter = checks.length
    ? await prisma.orderItem.count({ where: { identifier: { in: [...new Set(checks.map((c) => c.imei))] }, order: { paidAt: { gte: monthStart }, userId: { in: [...new Set(checks.map((c) => c.userId))] } }, variant: { product: { category: { slug: { contains: "unlock" } } } } } })
    : 0;
  const members = telegramReady() ? await channelMembers(s.telegramChannel) : null;
  const dealVariant = deal ? variants.find((v) => v.id === deal.variantId) : null;
  const state = (x: Slide) => (!x.isActive ? "Off" : x.startsAt && x.startsAt > now ? `Scheduled ${x.startsAt.toLocaleDateString("en-US")}` : x.endsAt && x.endsAt < now ? "Ended" : `Live${x.endsAt ? ` · until ${x.endsAt.toLocaleDateString("en-US")}` : ""}`);
  const box = "card space-y-3 p-5";

  return (
    <>
      <PageTitle title="Marketing" sub="Offers, deals, bonuses and automatic messages. Every number below is real." />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={box}>
          <h2 className="font-semibold">Home slider</h2>
          {slides.length === 0 && <p className="text-sm text-muted">No slides yet: the home page shows the first top-up bonus and the free IMEI check.</p>}
          {slides.map((x) => (
            <details key={x.id} className="rounded-xl border border-border p-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <b>{t(x.title, "en")}</b>
                <span className="text-muted">{state(x)} · {describeRule(x)}</span>
              </summary>
              <div className="mt-3"><SlideForm s={x} /></div>
              <div className="mt-2"><ActionButton label="Delete slide" confirm="Delete this slide?" className="btn-ghost min-h-9 px-2 text-xs text-danger" action={deleteSlide.bind(null, x.id)} /></div>
            </details>
          ))}
          <details className="rounded-xl border border-dashed border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold">+ New slide</summary>
            <div className="mt-3"><SlideForm /></div>
          </details>
        </section>

        <section id="deal" className={box}>
          <h2 className="font-semibold">Deal of the week</h2>
          {deal && dealVariant ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm">
              <span><b>{t(dealVariant.product.name, "en")} · {t(dealVariant.name, "en")}</b> at ${(deal.priceUsd / 100).toFixed(2)} until {deal.endsAt.toLocaleString("en-US", { weekday: "long", day: "numeric", month: "short" })}{deal.announcedAt ? " · announced" : ""}</span>
              <ActionButton label="End now" confirm="End the deal and put the normal price back?" action={stopDeal.bind(null, deal.id)} />
            </div>
          ) : (
            <ActionForm action={startWeeklyDeal} className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="label">Service</span>
                <select name="variantId" className="input" required>
                  {variants.map((v) => <option key={v.id} value={v.id}>{t(v.product.name, "en")} · {t(v.name, "en")} (${((v.salePriceUsd ?? v.priceUsd) / 100).toFixed(2)}{v.costUsd != null ? `, cost $${(v.costUsd / 100).toFixed(2)}` : ""})</option>)}
                </select>
              </label>
              <label><span className="label">Deal price USD</span><input name="price" inputMode="decimal" className="input" required /></label>
              <label><span className="label">Ends</span><input type="datetime-local" name="endsAt" className="input" required /></label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="announce" defaultChecked={s.autoMessages.dealTelegram} /> Announce on Telegram {!s.telegramChannel && <span className="text-muted">(set the channel in Settings first)</span>}</label>
              <button className="btn-primary min-h-11 justify-self-start px-5">Start deal</button>
            </ActionForm>
          )}
          <p className="text-xs text-muted">The deal price becomes the option&apos;s sale price everywhere (checkout included) and the old price comes back by itself when it ends.</p>
        </section>

        <section className={`${box} xl:col-span-2`}>
          <h2 className="font-semibold">Bonuses, free offers and automatic messages</h2>
          <ActionForm action={saveOffers} className="grid gap-5 lg:grid-cols-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">First top-up bonus %</span><input name="firstPct" defaultValue={s.topupBonus.firstPct} inputMode="decimal" className="input" /></label>
              <label><span className="label">Top-up bonus %</span><input name="pct" defaultValue={s.topupBonus.pct} inputMode="decimal" className="input" /></label>
              <label><span className="label">…for top-ups from (USD)</span><input name="minUsd" defaultValue={(s.topupBonus.minUsd / 100).toFixed(2)} inputMode="decimal" className="input" /></label>
              <label><span className="label">Free IMEI checks per day</span><input name="freeChecks" defaultValue={s.freeChecksPerDay} inputMode="numeric" className="input" /></label>
              <label><span className="label">Welcome credit after 1st top-up (USD)</span><input name="welcome" defaultValue={(s.welcomeCreditUsd / 100).toFixed(2)} inputMode="decimal" className="input" /></label>
              <span />
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="referralEnabled" defaultChecked={s.referralEnabled} /> Referral rewards on</label>
              <label><span className="label">Reward for the inviter (USD)</span><input name="refReward" defaultValue={(s.referralRewardUsd / 100).toFixed(2)} inputMode="decimal" className="input" /></label>
              <label><span className="label">Reward for the friend (USD, 0 = none)</span><input name="refFriend" defaultValue={(s.referralFriendRewardUsd / 100).toFixed(2)} inputMode="decimal" className="input" /></label>
            </div>
            <div className="space-y-2.5 text-sm">
              <b>Automatic messages</b>
              <label className="flex flex-wrap items-center gap-2"><input type="checkbox" name="inactiveOn" defaultChecked={s.autoMessages.inactiveOn} /> Technician inactive <input name="inactiveDays" defaultValue={s.autoMessages.inactiveDays} className="input w-16" inputMode="numeric" /> days → “new services are waiting” message</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="afterUnlockOn" defaultChecked={s.autoMessages.afterUnlockOn} /> 3 days after an unlock → “check or unlock your next phone”</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="backOnlineTelegram" defaultChecked={s.autoMessages.backOnlineTelegram} /> New service, price drop, back online → Telegram post</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="toolUpdateTelegram" defaultChecked={s.autoMessages.toolUpdateTelegram} /> New tool version → Telegram post</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="dealTelegram" defaultChecked={s.autoMessages.dealTelegram} /> Deal of the week → Telegram post (default)</label>
              {!telegramReady() && <p className="text-xs text-warning">Telegram is not connected: add TELEGRAM_BOT_TOKEN in the hosting settings and the channel in Settings.</p>}
            </div>
            <button className="btn-primary min-h-11 justify-self-start px-5 lg:col-span-2">Save</button>
          </ActionForm>
        </section>

        <section id="check" className={box}>
          <h2 className="font-semibold">Free IMEI check</h2>
          <p className="text-sm text-muted">Phone models known: <b>{tacs.reduce((a, x) => a + x._count, 0)}</b>{tacs.length > 0 && ` (${tacs.map((x) => `${x._count} ${x.source}`).join(", ")})`}. Unknown numbers are asked to the supplier service below, and every delivered check teaches the list.</p>
          <ActionForm action={saveCheckSettings} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
            <label><span className="label">Look up unknown models with</span>
              <select name="variantId" defaultValue={s.freeCheckVariantId} className="input">
                <option value="">Nobody (only the model list)</option>
                {checkVariants.map((v) => <option key={v.id} value={v.id}>{t(v.product.name, "en")} · {t(v.name, "en")} ({formatMoney(v.costUsd ?? 0, "USD", "en")} cost)</option>)}
              </select>
            </label>
            <label><span className="label">Paid check refunded on unlock within (days)</span><input name="creditDays" defaultValue={s.checkCreditDays} inputMode="numeric" className="input" /></label>
            <button className="btn-secondary min-h-11 px-4">Save</button>
          </ActionForm>
          <ActionForm action={importTacList} className="flex flex-wrap items-end gap-2" resetOnSuccess>
            <label className="flex-1"><span className="label">Import a model list (CSV: tac, brand, model)</span><input type="file" name="file" accept=".csv,text/csv" className="input py-2" required /></label>
            <button className="btn-secondary min-h-11 px-4">Import</button>
          </ActionForm>
        </section>

        <section className={box}>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Latest tool updates</h2><Link href="/admin/news/new?kind=tool" className="btn-secondary min-h-9 px-3 text-xs">+ Post an update</Link></div>
          {updates.length === 0 && <p className="text-sm text-muted">None yet.</p>}
          <ul className="divide-y divide-border text-sm">
            {updates.map((u) => <li key={u.id} className="flex justify-between py-2"><span>{u.toolName ?? t(u.title, "en")} {u.version && `v${u.version}`}</span><Link href={`/admin/news/${u.id}`} className="text-primary">Edit</Link></li>)}
          </ul>
        </section>

        <section className={box}>
          <h2 className="font-semibold">This month</h2>
          <ul className="space-y-1.5 text-sm">
            <li>Free checks used: <b>{checks.length}</b> → unlocks ordered after: <b>{unlocksAfter}</b></li>
            <li>Referrals: <b>{refs}</b> signed up, <b>{refsOrdered}</b> ordered</li>
            <li>Bonuses paid: <b>{bonuses.map((b) => formatMoney(b._sum.amount ?? 0, b.currency, "en")).join(" + ") || "0"}</b></li>
            <li>Telegram members: <b>{members ?? "—"}</b></li>
          </ul>
        </section>
      </div>
    </>
  );
}

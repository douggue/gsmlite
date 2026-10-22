import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/text";
import { writerReady, WRITER_MODELS } from "@/lib/content/ai";
import { keywordsReady } from "@/lib/content/dataforseo";
import { gscConnected, searchAnalytics } from "@/lib/content/gsc";
import { monthSpendMicros } from "@/lib/content/spend";
import { hubBrands } from "@/lib/content/facts";
import type { PageContent } from "@/lib/content/machine";
import { saveGscSite, saveMachine, writeNow } from "@/actions/content-machine";
import { ActionForm } from "@/components/admin/ActionButton";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Content machine" };

const KIND: Record<string, string> = { service: "Service page", hub: "Brand hub", guide: "Guide", tool: "Tool update" };
const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/** Content machine (mockup): SEO pages from real services, prices and results. Nothing goes live without approval. */
export default async function ContentMachine({ searchParams }: { searchParams: Promise<{ gsc?: string }> }) {
  await requireStaff("content.manage");
  const { gsc: gscMsg } = await searchParams;
  const since = new Date(Date.now() - 28 * 86_400_000);
  const [s, drafts, live, spent, ideas, hidden, products, googleOrders, brands, connected] = await Promise.all([
    getSettings(),
    prisma.contentPage.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.contentPage.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 100 }),
    monthSpendMicros(),
    prisma.keyword.findMany({ where: { status: "idea", volume: { gt: 0 } }, orderBy: { score: "desc" }, take: 8 }),
    prisma.product.findMany({ where: { hideFromGoogle: true }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { isPublished: true, hideFromGoogle: false }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" }, take: 300 }),
    prisma.order.count({ where: { trafficSource: "google", paidAt: { gte: since } } }),
    hubBrands(1),
    gscConnected(),
  ]);
  const rows = connected ? await searchAnalytics(["page"], 28, 5000) : null;
  const clicks = rows?.reduce((n, r) => n + r.clicks, 0) ?? null;
  const onGoogle = rows?.filter((r) => r.impressions > 0).length ?? null;
  const cm = s.contentMachine;
  const box = "card space-y-3 p-5";
  const env = (ok: boolean, label: string) => <li className={ok ? "text-success" : "text-warning"}>{ok ? "✓" : "○"} {label}</li>;
  const title = (c: unknown) => {
    const pc = c as PageContent;
    return pc.en?.title ?? Object.values(pc)[0]?.title ?? "—";
  };

  return (
    <>
      <PageTitle title="Content machine" sub="SEO pages written from your real services, prices and results. Nothing is published without your approval." actions={<Link href="/admin/content/keywords" className="btn-secondary">Keyword ideas</Link>} />
      {gscMsg && <p role="status" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${gscMsg === "connected" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{gscMsg === "connected" ? "Search Console connected." : gscMsg === "nokeys" ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the hosting environment first." : "Search Console could not be connected. Try again."}</p>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Pages on Google", onGoogle ?? live.length, onGoogle == null ? "published (connect Search Console for Google's count)" : "with impressions, 28 days"],
          ["Visits from Google · 28 days", clicks ?? "—", connected ? "Search Console clicks" : "connect Search Console"],
          ["Orders from those visits", googleOrders, "paid, 28 days"],
          ["Writing cost this month", dollars(spent), `of $${cm.budgetUsd}`],
        ].map(([label, value, sub]) => (
          <div key={String(label)} className="card p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className={box}>
            <h2 className="font-semibold">Drafts to review <span className="ml-1 rounded-md bg-warning-soft px-1.5 text-warning">{drafts.length}</span></h2>
            {drafts.length === 0 && <p className="text-sm text-muted">Nothing waiting. New services, brand hubs and the best keyword ideas are drafted every day.</p>}
            <ul className="divide-y divide-border">
              {drafts.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{d.reason?.startsWith("refresh:") ? "Refresh" : KIND[d.kind]} · {Object.keys(d.content as object).map((l) => l.toUpperCase()).join(" ")}</p>
                    <p className="truncate font-semibold">{title(d.content)}</p>
                    <p className="text-xs text-muted">Keyword: “{d.keyword}” · {d.reason} · {dollars(d.costMicros)}</p>
                  </div>
                  <Link href={`/admin/content/${d.id}`} className="btn-primary min-h-10 px-4">Review</Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={box}>
            <h2 className="font-semibold">+ Write a page</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <ActionForm action={writeNow} className="space-y-2">
                <input type="hidden" name="kind" value="service" />
                <label className="block"><span className="label">Service page</span>
                  <select name="productId" className="input">{products.map((p) => <option key={p.id} value={p.id}>{t(p.name, "en")}</option>)}</select>
                </label>
                <button className="btn-secondary min-h-10 px-4">Write</button>
              </ActionForm>
              <ActionForm action={writeNow} className="space-y-2">
                <input type="hidden" name="kind" value="hub" />
                <label className="block"><span className="label">Brand hub</span>
                  <input name="brand" list="brands" placeholder="Apple" className="input" required />
                  <datalist id="brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
                </label>
                <button className="btn-secondary min-h-10 px-4">Write</button>
              </ActionForm>
              <ActionForm action={writeNow} className="space-y-2">
                <input type="hidden" name="kind" value="guide" />
                <label className="block"><span className="label">Guide answering a search</span><input name="keyword" placeholder="how to check if an iphone is blacklisted" className="input" required /></label>
                <button className="btn-secondary min-h-10 px-4">Write</button>
              </ActionForm>
              <ActionForm action={writeNow} className="space-y-2">
                <input type="hidden" name="kind" value="tool" />
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="label">Tool update</span><input name="toolName" placeholder="UnlockTool" className="input" required /></label>
                  <label><span className="label">Version</span><input name="version" placeholder="2026.10.22" className="input" /></label>
                </div>
                <textarea name="notes" rows={2} placeholder="What changed (from the tool's changelog)" className="input py-2" required />
                <button className="btn-secondary min-h-10 px-4">Write</button>
              </ActionForm>
            </div>
          </section>

          <section className={box}>
            <h2 className="font-semibold">Live pages <span className="text-sm font-normal text-muted">({live.length})</span></h2>
            {live.length === 0 && <p className="text-sm text-muted">None yet.</p>}
            <ul className="divide-y divide-border text-sm">
              {live.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate"><span className="text-xs text-muted">{KIND[p.kind]} · </span>{title(p.content)}</span>
                  <Link href={`/admin/content/${p.id}`} className="text-primary">Open</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className={box}>
            <h2 className="font-semibold">Connections</h2>
            <ul className="space-y-1 text-sm">
              {env(writerReady(), "AI writer (ANTHROPIC_API_KEY)")}
              {env(keywordsReady(), "Keyword data (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)")}
              {env(connected, `Google Search Console${s.gsc.site ? ` · ${s.gsc.site}` : ""}`)}
            </ul>
            <div className="flex flex-wrap items-end gap-2">
              <a href="/api/admin/gsc/connect" className="btn-secondary min-h-10 px-4">{s.gsc.refreshToken ? "Reconnect Search Console" : "Connect Search Console"}</a>
              {s.gsc.refreshToken && (
                <ActionForm action={saveGscSite} className="flex gap-2">
                  <input name="site" defaultValue={s.gsc.site} placeholder="sc-domain:gsmlite.com" className="input min-h-10" aria-label="Search Console property" />
                  <button className="btn-secondary min-h-10 px-3">Save</button>
                </ActionForm>
              )}
            </div>
          </section>

          <ActionForm action={saveMachine} className={box}>
            <h2 className="font-semibold">Machine settings</h2>
            <div className="space-y-1.5 text-sm">
              {([["onNewService", "Write a page for each new published service", cm.onNewService], ["hubs", "Brand hubs (Apple, Samsung, Motorola…)", cm.hubs], ["toolPosts", "Tool update posts", cm.toolPosts], ["guides", "Guides from keyword ideas", cm.guides], ["refresh", "Refresh pages when price or time changes", cm.refresh]] as const).map(([name, label, on]) => (
                <label key={name} className="flex items-center gap-2"><input type="checkbox" name={name} defaultChecked={on} /> {label}</label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Publish at most (new pages a day)</span><input name="perDay" defaultValue={cm.perDay} inputMode="numeric" className="input" /></label>
              <label><span className="label">Monthly budget (USD)</span><input name="budgetUsd" defaultValue={cm.budgetUsd} inputMode="decimal" className="input" /></label>
            </div>
            <fieldset>
              <legend className="label">Languages</legend>
              <div className="flex flex-wrap gap-4 text-sm">{["en", "ht", "fr", "es"].map((l) => <label key={l} className="flex items-center gap-2"><input type="checkbox" name={`lang_${l}`} defaultChecked={cm.languages.includes(l)} /> {l.toUpperCase()}</label>)}</div>
            </fieldset>
            <label className="block"><span className="label">Model</span>
              <select name="model" defaultValue={cm.model} className="input">{WRITER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            </label>
            <label className="block"><span className="label">Brand voice</span><textarea name="tone" defaultValue={cm.tone} rows={2} className="input py-2" /></label>
            <button className="btn-primary min-h-10 px-4">Save</button>
          </ActionForm>

          <section className={box}>
            <div className="flex items-center justify-between"><h2 className="font-semibold">Best keyword ideas</h2><Link href="/admin/content/keywords" className="text-sm text-primary">All →</Link></div>
            {ideas.length === 0 && <p className="text-sm text-muted">{keywordsReady() ? "Fetched every Monday, or press “Fetch ideas now” on the keyword page." : "Connect DataForSEO to get real search numbers."}</p>}
            <ul className="space-y-1 text-sm">{ideas.map((k) => <li key={k.id} className="flex justify-between gap-2"><span className="truncate">{k.keyword} <span className="text-xs text-muted">{k.locale}</span></span><span className="tabular-nums text-muted">{k.volume}/mo</span></li>)}</ul>
          </section>

          <section className={box}>
            <h2 className="font-semibold">Hidden from Google <span className="text-sm font-normal text-muted">[{hidden.length} services]</span></h2>
            <p className="text-sm text-muted">No page is written, they are marked “noindex”, left out of the sitemap, brand hubs and public price list, and shown only to signed-in customers. Switch it per service in Services &amp; prices.</p>
            <ul className="flex flex-wrap gap-1.5 text-xs">{hidden.map((p) => <li key={p.id}><Link href={`/admin/products/${p.id}`} className="rounded-md bg-surface-2 px-2 py-1">{t(p.name, "en")}</Link></li>)}</ul>
          </section>

          <section className={`${box} text-sm`}>
            <h2 className="font-semibold">Every service page gets</h2>
            <ul className="list-inside list-disc space-y-0.5 text-muted">
              <li>Title and description with the main keyword</li>
              <li>Real price, delivery time and success rate</li>
              <li>Sample result (IMEI hidden), when one exists</li>
              <li>How it works, step by step, and FAQ (rich results on Google)</li>
              <li>Links to related services and the brand hub</li>
              <li>Same page in every language, linked together</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

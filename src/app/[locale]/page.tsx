import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { normalizeHomepage, type HomeSectionId } from "@/lib/homepage";
import { pageSeo } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { getDisplaySettings } from "@/lib/settings";
import { t } from "@/lib/text";
import { homeData } from "@/lib/storefront";
import { listNames } from "@/lib/pay-methods";
import { allServiceStats, storeNumbers, systemsOnline } from "@/lib/service-stats";
import { durationParts } from "@/lib/duration";
import { Price } from "@/components/Money";
import { ReviewsSection } from "@/components/ReviewsSection";
import { SearchBox } from "@/components/shop/SearchBox";
import { ServiceCard } from "@/components/shop/ServiceCard";
import { HomeSlider } from "@/components/shop/HomeSlider";
import { ToolTabs } from "@/components/shop/ToolTabs";
import { ArrowRightIcon, CheckListIcon, ChipIcon, KeyIcon, UnlockPhoneIcon } from "@/components/Icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageSeo(locale, "/", "");
}

/** Icon for a home tile, from the category's name (any language) */
function tileIcon(slug: string, i: number) {
  const s = slug.toLowerCase();
  if (/check|imei|verif/.test(s)) return CheckListIcon;
  if (/credit|tool|licen|key/.test(s)) return KeyIcon;
  if (/firm|frp|data|file|flash|mdm/.test(s)) return ChipIcon;
  if (/unlock|carrier|network|debl/.test(s)) return UnlockPhoneIcon;
  return [UnlockPhoneIcon, CheckListIcon, KeyIcon, ChipIcon][i % 4];
}

/** Soft color pairs for the "Services by type" icon tiles, used in turn. */
const TILE_TONES = ["bg-[#e8f0fe] text-[#1d4ed8]", "bg-[#e0f5f9] text-[#0e7490]", "bg-[#f1ebfe] text-[#6d28d9]", "bg-[#fef0dc] text-[#b45309]", "bg-[#fde7f1] text-[#be185d]"];

function initials(s: string) {
  const w = s.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? w[0]?.[1] ?? "")).toUpperCase();
}

const INSTANT = /instant|imedya|instantan|فوري/i;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-bold tracking-[0.1em] text-primary">{children}</span>;
}

/** Below these, shop counters look like an empty shop, so they stay hidden. */
const MIN_DELIVERED = 500;
const MIN_CUSTOMERS = 100;

/** Home (iUnlocker-style, in GSMLite blue): hero, popular services card, types, tools, IMEI check, how it works, trust. */
export default async function HomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const viewer = sp.preview ? await getUser() : null;
  const preview = !!viewer && isStaff(viewer.role) && !!viewer.twoFactorEnabled;
  const [g, settings, data, numbers, online, stats] = await Promise.all([getTranslations("gl"), getDisplaySettings(), homeData(locale), storeNumbers(), systemsOnline(), allServiceStats()]);
  const home = normalizeHomepage(preview ? settings.homepageDraft : settings.homepage);
  const show = (id: HomeSectionId) => home.sections.find((s) => s.id === id)?.visible !== false;
  const methods = listNames(data.methods, locale);
  const signedIn = !!data.user;
  const dur = (m: number | null) => {
    if (m == null) return null;
    const d = durationParts(m);
    return g(`time.${d.key}`, { n: d.n });
  };
  const payNames = [...new Set(data.methods.filter((m) => m.kind !== "wallet").map((m) => (m.kind === "card" ? "Visa/Mastercard" : m.name)))];
  const fmt = (n: number) => n.toLocaleString(locale === "ht" ? "fr" : locale);

  const faq = [1, 2, 3, 4].map((i) => ({
    q: g(`home.q${i}`),
    a: i === 2 ? (methods ? g("home.a2", { methods }) : g("home.a2Wallet")) : g(`home.a${i}`),
  }));
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: settings.businessName, url: siteUrl(), address: settings.businessAddress },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];

  // Hero promises; real counters replace them only once they are big enough to build trust.
  const promises = [
    numbers.delivered >= MIN_DELIVERED ? { b: fmt(numbers.delivered), s: g("home.statDelivered") } : { b: g("home.promiseRefundT"), s: g("home.promiseRefund") },
    payNames.length ? { b: payNames.slice(0, 2).join(" · "), s: g("home.promisePay") } : null,
    numbers.customers >= MIN_CUSTOMERS ? { b: fmt(numbers.customers), s: g("home.statCustomers") } : { b: g("home.promiseSupportT"), s: g("home.promiseSupport") },
  ].filter(Boolean) as { b: string; s: string }[];

  const popular = data.best.slice(0, 6).map((p, i) => {
    const st = stats[p.id];
    return { ...p, hot: i < 2, rate: st?.successRate ?? null, fast: !!p.delivery && INSTANT.test(p.delivery) };
  });
  const steps = [
    [g("home.how1"), ""],
    [methods ? g("home.how2", { methods }) : g("home.how2Wallet"), ""],
    [g("home.how3"), ""],
    [g("home.how4"), ""],
  ];
  const statusPill = (
    <Link href="/status" className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-white/20">
      <span className={`h-2 w-2 rounded-full ${online ? "bg-[#6ee7a0]" : "bg-[#ffb547]"}`} />
      {online ? g("home.statusOnline") : g("home.statusIssues")}
    </Link>
  );

  return (
    <>
      {jsonLd.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}

      {/* ─────────── Hero ─────────── */}
      <section className="bg-[linear-gradient(150deg,#0f1b3d_0%,#1e3a8a_55%,#1d4ed8_100%)] pb-28 pt-6 text-white lg:pb-36 lg:pt-12">
        <div className="container-page grid items-center gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            {statusPill}
            <h1 className="display mt-4 text-[36px] font-extrabold leading-[1.04] tracking-tight sm:text-5xl lg:text-[54px]">{g("home.title")}</h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[#dbe6ff] sm:text-lg">{methods ? g("home.subtitle", { methods }) : g("home.subtitleWallet")}</p>
            <div className="mt-5 lg:hidden">
              <SearchBox label={g("home.searchLabel")} placeholder={g("home.searchPlaceholder")} buttonLabel={g("home.searchButton")} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-3 lg:mt-7">
              <Link href="/check" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold tracking-wide text-primary hover:bg-[#e8f0fe] sm:text-[15px]">
                {g("home.heroCheck")} <ArrowRightIcon width={18} height={18} className="hidden sm:block rtl:-scale-x-100" />
              </Link>
              {signedIn ? (
                <Link href="/account/orders" className="inline-flex min-h-12 items-center justify-center rounded-2xl border-[1.5px] border-white/45 px-5 text-sm font-semibold hover:bg-white/10 sm:text-[15px]">{g("home.myOrders")}</Link>
              ) : (
                <Link href="/store" className="inline-flex min-h-12 items-center justify-center rounded-2xl border-[1.5px] border-white/45 px-5 text-sm font-semibold hover:bg-white/10 sm:text-[15px]">{g("home.heroUnlock")}</Link>
              )}
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-3 sm:flex sm:gap-9 lg:mt-8">
              {promises.map((p) => (
                <div key={p.s}>
                  <dt className="text-[15px] font-bold sm:text-xl">{p.b}</dt>
                  <dd className="line-clamp-2 text-xs text-[#c7d6fb] sm:text-[13px]">{p.s}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="hidden justify-center lg:flex" aria-hidden>
            {settings.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.heroImageUrl} alt="" className="max-h-[340px] w-auto object-contain" />
            ) : (
              <div className="relative h-[330px] w-[300px]">
                <div className="absolute left-5 top-8 h-[290px] w-[150px] -rotate-12 rounded-[34px] bg-[#172554] shadow-[0_30px_60px_rgba(7,13,31,0.45)]" />
                <div className="absolute left-[110px] top-2.5 grid h-[300px] w-[160px] rotate-[8deg] place-items-center rounded-[34px] border-[6px] border-[#0f1b3d] bg-[linear-gradient(160deg,#3b82f6,#1d4ed8)] shadow-[0_30px_60px_rgba(7,13,31,0.45)]">
                  <span className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────── Popular services (card over the hero) ─────────── */}
      {popular.length > 0 && (
        <section aria-labelledby="pop" className="container-page relative -mt-20 lg:-mt-28">
          <div className="rounded-3xl bg-surface p-3.5 shadow-[0_24px_60px_rgba(15,27,61,0.14)] sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:mb-4">
              <h2 id="pop" className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c62f3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 2 1.5 2.5 2.5 2.5C11 8 11 5.5 12 3z" /></svg>
                {g("home.popularServices")}
              </h2>
              <Link href="/store" className="text-sm font-semibold text-primary">{g("home.seeAllServices")}</Link>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {popular.map((p) => (
                <article key={p.id} className="flex gap-3 rounded-2xl border border-border p-3 sm:p-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-bold text-primary">{initials(p.category || p.name)}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${p.slug}`} dir="auto" className="line-clamp-2 text-[15px] font-semibold leading-snug hover:text-primary sm:text-sm">{p.name}</Link>
                    <span className="mt-0.5 block truncate text-[11px] uppercase tracking-wide text-muted">{p.category}</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.hot && <span className="rounded-md bg-danger px-1.5 py-0.5 text-[11px] font-bold text-white">{g("home.hot")}</span>}
                      {p.delivery && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${p.fast ? "bg-success-soft text-success" : "bg-primary-soft text-primary"}`}>{p.delivery}</span>}
                      {p.rate != null && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">{g("home.successPct", { n: p.rate })}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                    <b className="text-base tabular-nums"><Price usd={p.price} /></b>
                    <Link href={`/products/${p.slug}#order`} className="inline-flex min-h-9 items-center rounded-xl bg-primary px-3.5 text-[13px] font-semibold text-white hover:bg-primary-hover">{g("home.order")}</Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Offers set in Admin → Homepage */}
      {show("slider") && data.slides.length > 0 && (
        <section className="container-page mt-8">
          <HomeSlider slides={data.slides} prevLabel={g("home.prev")} nextLabel={g("home.next")} />
        </section>
      )}

      {/* ─────────── Services by type ─────────── */}
      {show("quickActions") && data.categories.length > 0 && (
        <section aria-labelledby="types" className="container-page mt-12 lg:mt-14">
          <Eyebrow>{g("home.typesEyebrow")}</Eyebrow>
          <h2 id="types" className="display mb-4 mt-1 text-[26px] font-bold lg:text-3xl">{g("home.typesTitle")}</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {data.categories.slice(0, 8).map((c, i) => {
              const Icon = tileIcon(`${c.slug} ${t(c.name, "en")}`, i);
              return (
                <Link key={c.id} href={`/categories/${c.slug}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-primary sm:p-3.5">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${TILE_TONES[i % TILE_TONES.length]}`}><Icon width={22} height={22} /></span>
                  <span className="min-w-0">
                    <b className="block text-sm leading-tight">{t(c.name, locale)}</b>
                    {t(c.description, locale) && <span className="line-clamp-1 hidden text-xs text-muted sm:block">{t(c.description, locale)}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─────────── Deal of the week ─────────── */}
      {show("deals") && data.deals.length > 0 && (
        <section aria-labelledby="deals" className="container-page mt-12 lg:mt-14">
          <div className="mb-4 flex items-end justify-between gap-3">
            <span><Eyebrow>{g("home.dealOfDaySub")}</Eyebrow><h2 id="deals" className="display mt-1 text-[26px] font-bold lg:text-3xl">{g("home.dealOfDay")}</h2></span>
            <Link href="/deals" className="text-sm font-semibold text-primary">{g("home.allDeals")} ›</Link>
          </div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
            {data.deals.slice(0, 5).map((c) => <div key={c.id} className="w-[46%] shrink-0 snap-start sm:w-auto"><ServiceCard card={c} orderLabel={g("home.addToCart")} /></div>)}
          </div>
        </section>
      )}

      {/* ─────────── Tools ─────────── */}
      {show("shopByTool") && data.tools.length > 0 && (
        <section aria-labelledby="tools" className="container-page mt-12 lg:mt-14">
          <Eyebrow>{g("home.toolsEyebrow")}</Eyebrow>
          <h2 id="tools" className="display mb-4 mt-1 text-[26px] font-bold lg:text-3xl">{g("home.shopByTool")}</h2>
          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-surface sm:grid-cols-4 lg:grid-cols-6">
            {data.tools.map((x) => (
              <Link key={x.slug} href={`/categories/${x.slug}`} className="-mb-px -mr-px flex flex-col items-center gap-2 border-b border-r border-border px-2 py-4 text-center hover:bg-surface-2">
                {x.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={x.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  : <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f1b3d] text-xs font-bold text-[#93c5fd]">{x.code}</span>}
                <b className="text-[13px] leading-tight sm:text-sm">{x.name}</b>
              </Link>
            ))}
          </div>
          {show("topTools") && data.tools.some((x) => x.options.length) && (
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border bg-surface lg:block">
              <ToolTabs tools={data.tools.filter((x) => x.options.length)} />
            </div>
          )}
        </section>
      )}

      {/* ─────────── Free IMEI check ─────────── */}
      {show("promos") && (
        <section className="container-page mt-12 lg:mt-16">
          <div className="grid items-center gap-6 rounded-[28px] bg-[linear-gradient(120deg,#1e3a8a_0%,#1d4ed8_100%)] p-5 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-9 lg:p-10">
            <div>
              <span className="text-xs font-bold tracking-[0.1em] text-[#93c5fd]">{g("home.slideCheckTag").toUpperCase()}</span>
              <h2 className="display mt-1.5 text-[26px] font-bold leading-tight lg:text-[32px]">{g("home.ctaTitle")}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[#dbe6ff] lg:text-base">{g("home.ctaText")}</p>
            </div>
            <form action={`/${locale}/check`} className="rounded-[20px] bg-surface p-4 text-text shadow-[0_20px_40px_rgba(7,13,31,0.25)] sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="home-imei" className="text-[15px] font-bold">{g("home.ctaLabel")}</label>
                <span className="rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">{g("home.slideCheckTag").toUpperCase()}</span>
              </div>
              <input id="home-imei" name="imei" inputMode="numeric" autoComplete="off" placeholder="35 678901 234567 8" className="input mt-3 min-h-[52px] border-2 border-[#c7d7fb] text-base" />
              <button className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold tracking-wide text-white hover:bg-primary-hover">
                {g("home.ctaButton")} <ArrowRightIcon width={18} height={18} className="rtl:-scale-x-100" />
              </button>
              <p className="mt-2.5 text-center text-[13px] text-muted">{g.rich("home.ctaHelp", { mono: (c) => <b className="font-mono">{c}</b> })}</p>
            </form>
          </div>
        </section>
      )}

      {/* ─────────── Tool updates ─────────── */}
      {show("toolUpdates") && data.updates.length > 0 && (
        <section aria-labelledby="updates" className="container-page mt-12 lg:mt-14">
          <div className="mb-4 flex items-end justify-between gap-3">
            <span><Eyebrow>{g("home.toolUpdatesSub").toUpperCase()}</Eyebrow><h2 id="updates" className="display mt-1 text-[26px] font-bold lg:text-3xl">{g("home.toolUpdates")}</h2></span>
            <Link href="/news?kind=tool" className="shrink-0 text-sm font-semibold text-primary">{g("home.viewAll")} ›</Link>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-3 lg:gap-3">
            {data.updates.map((u) => (
              <Link key={u.slug} href={`/news/${u.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 hover:border-primary">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0f1b3d] text-xs font-bold text-[#93c5fd]">{u.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-xs"><b className="text-primary">{g("home.newBadge")}</b>{u.version && <> · v{u.version}</>}</span>
                  <b className="block">{u.tool}</b>
                  <span className="line-clamp-1 text-[13px] text-muted">{u.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─────────── How it works + where to find the IMEI ─────────── */}
      {show("howItWorks") && (
        <section className="container-page mt-12 grid gap-8 lg:mt-16 lg:grid-cols-2 lg:gap-6">
          <div>
            <h2 className="display mb-4 text-[26px] font-bold lg:text-[28px]">{g("home.howTitle")}</h2>
            <ol className="grid gap-2.5">
              {steps.map(([text], i) => (
                <li key={i} className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-white">{i + 1}</span>
                  <span className="text-[15px]">{text}</span>
                </li>
              ))}
            </ol>
            {numbers.medianMinutes != null && <p className="mt-3 text-sm text-muted">{g("home.statAvg")}: <b className="text-text">{dur(numbers.medianMinutes)}</b></p>}
          </div>
          <div>
            <h2 className="display mb-4 text-[26px] font-bold lg:text-[28px]">{g("home.findTitle")}</h2>
            <div className="grid gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <details key={i} open={i === 1} className="group rounded-2xl border border-border bg-surface p-3.5">
                  <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-[13px] font-bold text-primary">{i}</span>
                    {g(`home.find${i}t`)}
                    <span aria-hidden className="ms-auto text-muted transition group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="ms-11 mt-2 text-sm text-muted">{g(`home.find${i}`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {show("reviews") && <ReviewsSection locale={locale} />}

      {/* ─────────── Why GSMLite + FAQ ─────────── */}
      {show("aboutFaq") && (
        <section className="container-page mt-12 grid gap-5 lg:mt-16 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="display text-[26px] font-bold lg:text-[28px]">{g("home.whyTitle")}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{g("home.aboutText")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-border p-3.5">
                  <b className="block text-[15px] text-primary">{g(`home.why${i}t`)}</b>
                  <span className="text-[13px] text-muted">{g(`home.why${i}`)}</span>
                </div>
              ))}
            </div>
            {payNames.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {payNames.map((n) => <span key={n} className="rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-[13px] font-semibold">{n}</span>)}
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <Eyebrow>{g("home.faqEyebrow").toUpperCase()}</Eyebrow>
            <h2 className="display mt-1 text-[26px] font-bold lg:text-[28px]">{g("home.faqTitle")}</h2>
            <div className="mt-3 space-y-2.5">
              {faq.map((f, i) => (
                <details key={i} open={i === 0} className="rounded-xl border border-border px-4 py-3 open:border-[#c7d7fb] open:bg-primary-soft/50">
                  <summary className="cursor-pointer font-semibold">{f.q}</summary>
                  <p className="mt-2 text-[15px] text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────── Contact ─────────── */}
      {show("support") && (
        <section className="mt-12 border-t border-[#c7d7fb] bg-primary-soft lg:mt-16">
          <div className="container-page flex flex-wrap items-center gap-3 py-5 sm:gap-4">
            <span className="min-w-[240px] flex-1">
              <b className="block text-lg">{g("home.contactTitle")}</b>
              <span className="text-sm text-muted">{g("home.needHelpSub")}</span>
            </span>
            <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noopener" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-[#1fa855] px-5 font-semibold text-white sm:flex-none">{g("home.whatsapp")}</a>
            {settings.telegramUrl && <a href={settings.telegramUrl} target="_blank" rel="noopener" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-[#c7d7fb] bg-surface px-5 font-semibold sm:flex-none">{g("home.telegram")}</a>}
          </div>
        </section>
      )}
    </>
  );
}

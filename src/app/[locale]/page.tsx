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
import { storeNumbers, systemsOnline } from "@/lib/service-stats";
import { durationParts } from "@/lib/duration";
import { Price } from "@/components/Money";
import { ReviewsSection } from "@/components/ReviewsSection";
import { SearchBox } from "@/components/shop/SearchBox";
import { ServiceCard } from "@/components/shop/ServiceCard";
import { HomeSlider, type Slide } from "@/components/shop/HomeSlider";
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

function SectionHead({ title, sub, href, linkLabel }: { title: string; sub?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-[#111418] px-5 py-3.5 text-white">
      <span>
        <b className="display block text-xl">{title}</b>
        {sub && <span className="text-[13px] text-[#c9cfc6]">{sub}</span>}
      </span>
      {href && linkLabel && <Link href={href} className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-white px-3.5 text-sm font-semibold text-[#111418]">{linkLabel} <span className="inline-block rtl:-scale-x-100">→</span></Link>}
    </div>
  );
}

export default async function HomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const viewer = sp.preview ? await getUser() : null;
  const preview = !!viewer && isStaff(viewer.role) && !!viewer.twoFactorEnabled;
  const [g, settings, data, numbers, online] = await Promise.all([getTranslations("gl"), getDisplaySettings(), homeData(locale), storeNumbers(), systemsOnline()]);
  const home = normalizeHomepage(preview ? settings.homepageDraft : settings.homepage);
  const show = (id: HomeSectionId) => home.sections.find((s) => s.id === id)?.visible !== false;
  const methods = listNames(data.methods, locale);
  const signedIn = !!data.user;
  const gate = (href: string) => (signedIn ? href : `/auth/login?next=${encodeURIComponent(href)}`);
  const dur = (m: number | null) => {
    if (m == null) return null;
    const d = durationParts(m);
    return g(`time.${d.key}`, { n: d.n });
  };

  // Offers from Admin → Homepage; without any, two built-in ones (top-up bonus only when it is switched on).
  const slides: Slide[] = data.slides.length
    ? data.slides
    : [
        ...(settings.topupBonus.firstPct > 0
          ? [{
              id: "topup", tag: g("home.slideTopupTag"), label: g("home.slideTopupLabel"), title: g("home.slideTopupTitle", { pct: settings.topupBonus.firstPct }),
              bullets: [...(methods ? [g("home.slideTopup1", { methods })] : []), g("home.slideTopup2"), g("home.slideTopup3")],
              buttonText: g("home.slideTopupBtn"), buttonHref: gate("/account/wallet/deposit"),
              button2Text: g("home.slideWhatsapp"), button2Href: `https://wa.me/${settings.whatsappNumber}`,
            }]
          : []),
        {
          id: "check", tag: g("home.slideCheckTag"), label: g("home.slideCheckLabel"), title: g("home.slideCheckTitle"),
          bullets: [g("home.slideCheck1"), g("home.slideCheck2"), g("home.slideCheck3")], buttonText: g("home.slideCheckBtn"), buttonHref: "/check",
        },
      ];

  const faq = [1, 2, 3, 4].map((i) => ({
    q: g(`home.q${i}`),
    a: i === 2 ? (methods ? g("home.a2", { methods }) : g("home.a2Wallet")) : g(`home.a${i}`),
  }));
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: settings.businessName, url: siteUrl(), address: settings.businessAddress },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];
  const stats = [
    numbers.delivered > 0 && { v: numbers.delivered.toLocaleString(locale === "ht" ? "fr" : locale), l: g("home.statDelivered") },
    numbers.customers > 0 && { v: numbers.customers.toLocaleString(locale === "ht" ? "fr" : locale), l: g("home.statCustomers") },
    numbers.medianMinutes != null && { v: dur(numbers.medianMinutes), l: g("home.statAvg") },
    numbers.services > 0 && { v: String(numbers.services), l: g("home.statServices") },
  ].filter(Boolean) as { v: string; l: string }[];
  const status = (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${online ? "text-[#7ce0a8]" : "text-[#ffb547]"}`}>
      <span className={`h-2 w-2 rounded-full ${online ? "bg-[#7ce0a8]" : "bg-[#ffb547]"}`} />
      {online ? g("home.statusOnline") : g("home.statusIssues")}
    </span>
  );
  const credits = data.categories.find((c) => /credit|server/i.test(c.slug));

  return (
    <>
      {jsonLd.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}

      {/* ─────────── Phones (mockup "Home") ─────────── */}
      <div className="lg:hidden">
        <section className="container-page pb-5 pt-3">
          <h1 className="display text-[34px] leading-[1.05] tracking-tight">{g("home.title")}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{methods ? g("home.subtitle", { methods }) : g("home.subtitleWallet")}</p>
          <div className="mt-4">
            <SearchBox label={g("home.searchLabel")} placeholder={g("home.searchPlaceholder")} buttonLabel={g("home.searchButton")} />
            <p className="mt-1.5 text-xs text-muted">{g.rich("home.imeiTip", { mono: (c) => <span className="font-mono">{c}</span> })}</p>
          </div>
        </section>

        {data.categories.length > 0 && (
          <section aria-labelledby="m-cats" className="container-page">
            <h2 id="m-cats" className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{g("home.services")}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {data.categories.slice(0, 4).map((c, i) => {
                const Icon = tileIcon(`${c.slug} ${t(c.name, "en")}`, i);
                const first = i === 0;
                return (
                  <Link key={c.id} href={`/categories/${c.slug}`}
                    className={`flex min-h-28 flex-col justify-between gap-4 rounded-2xl p-3.5 ${first ? "bg-[#111418] text-white" : "border border-border bg-surface"}`}>
                    <Icon width={26} height={26} className={first ? "text-[#7ce0a8]" : "text-primary"} />
                    <span>
                      <b className="block text-base leading-tight">{t(c.name, locale)}</b>
                      {t(c.description, locale) && <span className={`line-clamp-1 text-xs ${first ? "text-[#b9c0b6]" : "text-muted"}`}>{t(c.description, locale)}</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="container-page mt-4">
          <Link href="/check" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary bg-surface p-4">
            <span>
              <b className="block text-[15px]">{g("home.checkTitle")}</b>
              <span className="text-[13px] text-muted">{g("home.checkSub")}</span>
            </span>
            <ArrowRightIcon className="shrink-0 text-primary" />
          </Link>
        </section>

        {show("deals") && data.best.length > 0 && (
          <section aria-labelledby="m-pop" className="container-page mt-6">
            <div className="flex items-baseline justify-between">
              <h2 id="m-pop" className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{g("home.popular")}</h2>
              <Link href="/store" className="text-sm font-semibold text-primary">{g("home.allServices")}</Link>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {data.best.slice(0, 5).map((p) => (
                <Link key={p.id} href={`/products/${p.slug}`} className="flex items-center gap-3 p-3.5">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{p.name}</b>
                    {p.delivery && <span className={`text-[13px] ${/instant|imedya|instantan/i.test(p.delivery) ? "font-semibold text-primary" : "text-muted"}`}>{p.delivery}</span>}
                  </span>
                  <b className="text-[15px] tabular-nums"><Price usd={p.price} /></b>
                </Link>
              ))}
            </div>
          </section>
        )}

        {show("howItWorks") && (
          <section className="container-page mt-6">
            <div className="rounded-2xl bg-primary-soft p-4">
              <b className="text-[15px]">{g("home.howTitle")}</b>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
                <li>{g("home.how1")}</li>
                <li>{methods ? g("home.how2", { methods }) : g("home.how2Wallet")}</li>
                <li>{g("home.how3")}</li>
                <li>{g("home.how4")}</li>
              </ol>
            </div>
          </section>
        )}
      </div>

      {/* ─────────── Wide screens (mockup "Desktop") ─────────── */}
      <div className="container-page hidden space-y-5 pt-5 lg:block">
        {show("slider") && (
          <div className="grid grid-cols-[300px_1fr_300px] gap-5">
            <aside aria-labelledby="d-top" className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
              <h2 id="d-top" className="bg-[#111418] px-4 py-3.5 font-semibold text-white">{g("home.topCategories")}</h2>
              <ul className="flex-1 divide-y divide-border">
                {data.categories.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link href={`/categories/${c.slug}`} className="flex items-center gap-3 px-4 py-3 text-[15px] hover:bg-surface-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-[11px] font-bold text-primary">{c.code || t(c.name, "en").slice(0, 2).toUpperCase()}</span>
                      {t(c.name, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/categories" className="px-4 py-3 text-sm font-semibold text-primary underline">{g("home.viewAllCategories")} <span className="inline-block rtl:-scale-x-100">→</span></Link>
            </aside>
            <HomeSlider slides={slides} prevLabel={g("home.prev")} nextLabel={g("home.next")} />
            <aside className="flex flex-col gap-5">
              <div className="rounded-2xl border border-border bg-surface p-5">
                {data.user ? (
                  <>
                    <b className="text-xl">{g("home.welcomeBack", { name: data.user.name.split(" ")[0] })}</b>
                    <p className="mt-1.5 text-sm text-muted">{g("home.welcomeBackText")}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link href="/account/orders" className="btn-primary min-h-11">{g("home.myOrders")}</Link>
                      <Link href="/account/wallet/deposit" className="btn-secondary min-h-11">{g("home.addFunds")}</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <b className="text-xl">{g("home.welcome")}</b>
                    <p className="mt-1.5 text-sm text-muted">{g("home.welcomeText")}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link href="/auth/login" className="btn-primary min-h-11">{g("header.signIn")}</Link>
                      <Link href="/auth/register" className="btn-secondary min-h-11">{g("home.register")}</Link>
                    </div>
                  </>
                )}
              </div>
              <nav aria-labelledby="d-ql" className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface">
                <h2 id="d-ql" className="border-b border-border px-4 py-3 font-semibold">{g("home.quickLinks")}</h2>
                {[
                  { href: "/check", b: g("home.qlCheck"), s: g("home.qlCheckSub") },
                  { href: "/deals", b: g("home.qlDeal"), s: g("home.qlDealSub") },
                  { href: "/store?sort=popular", b: g("home.qlBest"), s: g("home.qlBestSub") },
                ].map((q) => (
                  <Link key={q.href} href={q.href} className="block border-b border-border px-4 py-3 hover:bg-surface-2">
                    <b className="block">{q.b}</b><span className="text-[13px] text-muted">{q.s}</span>
                  </Link>
                ))}
                <Link href="/status" className="block px-4 py-3 hover:bg-surface-2">
                  <b className="block">{g("home.qlStatus")}</b>
                  <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${online ? "text-primary" : "text-warning"}`}>
                    <span className={`h-2 w-2 rounded-full ${online ? "bg-primary" : "bg-warning"}`} />{online ? g("home.statusOnline") : g("home.statusIssues")}
                  </span>
                </Link>
              </nav>
            </aside>
          </div>
        )}

        {show("quickActions") && (
          <div className="grid grid-cols-4 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {[
              { href: gate("/account/wallet/deposit"), b: g("home.addFunds"), s: methods || g("home.addFundsSub") },
              { href: "/store", b: g("home.placeOrder"), s: g("home.placeOrderSub") },
              { href: gate("/account/orders"), b: g("home.myOrders"), s: g("home.myOrdersSub") },
              { href: "/track", b: g("home.track"), s: g("home.trackSub") },
            ].map((q) => (
              <Link key={q.b} href={q.href} className="px-5 py-4 hover:bg-surface-2">
                <b className="block">{q.b}</b><span className="line-clamp-1 text-[13px] text-muted">{q.s}</span>
              </Link>
            ))}
          </div>
        )}

        {show("deals") && data.deals.length > 0 && (
          <section aria-label={g("home.dealOfDay")} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <SectionHead title={g("home.dealOfDay")} sub={g("home.dealOfDaySub")} href="/deals" linkLabel={g("home.allDeals")} />
            <div className="grid grid-cols-5 gap-4 p-5">
              {data.deals.slice(0, 5).map((c) => <ServiceCard key={c.id} card={c} orderLabel={g("home.addToCart")} />)}
            </div>
          </section>
        )}

        {show("promos") && (
          <div className="grid grid-cols-2 gap-5">
            <Link href={credits ? `/categories/${credits.slug}` : "/store?type=SERVER"} className="flex items-center justify-between gap-4 rounded-2xl bg-[#111418] p-6 text-white">
              <span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7ce0a8]">{g("home.creditsTag")}</span>
                <b className="mt-1 block text-xl">{g("home.creditsTitle")}</b>
                <span className="text-sm text-[#b9c0b6]">{g("home.creditsSub")}</span>
              </span>
              <span className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-[#7ce0a8] px-4 font-semibold text-[#0b2a1a]">{g("home.creditsBtn")} <span className="inline-block rtl:-scale-x-100">→</span></span>
            </Link>
            <Link href="/check" className="flex items-center justify-between gap-4 rounded-2xl border border-[#cfe7d8] bg-[#e4f3ea] p-6 text-[#111418]">
              <span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#145c39]">{g("home.checkTag")}</span>
                <b className="mt-1 block text-xl">{g("home.checkTitle")}</b>
                <span className="text-sm text-[#4a5048]">{g("home.checkSub")}</span>
              </span>
              <span className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-[#111418] px-4 font-semibold text-white">{g("home.checkBtn")} <span className="inline-block rtl:-scale-x-100">→</span></span>
            </Link>
          </div>
        )}

        {show("topTools") && data.tools.some((x) => x.options.length) && (
          <section aria-label={g("home.topTools")} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <SectionHead title={g("home.topTools")} sub={g("home.topToolsSub")} href="/store?tool=1" linkLabel={g("home.viewAll")} />
            <ToolTabs tools={data.tools.filter((x) => x.options.length)} />
          </section>
        )}

        {show("shopByTool") && data.tools.length > 0 && (
          <section aria-label={g("home.shopByTool")} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <SectionHead title={g("home.shopByTool")} sub={g("home.shopByToolSub")} />
            <div className="grid grid-cols-5 gap-3 p-5">
              {data.tools.map((x) => (
                <Link key={x.slug} href={`/categories/${x.slug}`} className="flex items-center gap-3 rounded-xl border border-border p-3 font-semibold hover:border-primary">
                  {x.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={x.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    : <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#111418] text-xs font-bold text-[#7ce0a8]">{x.code}</span>}
                  {x.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {show("toolUpdates") && data.updates.length > 0 && (
          <section aria-label={g("home.toolUpdates")} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <SectionHead title={g("home.toolUpdates")} sub={g("home.toolUpdatesSub")} href="/news?kind=tool" linkLabel={g("home.viewAll")} />
            <div className="grid grid-cols-3 divide-x divide-border">
              {data.updates.map((u) => (
                <article key={u.slug} className="flex items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#111418] text-xs font-bold text-[#7ce0a8]">{u.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-xs"><b className="text-primary">{g("home.newBadge")}</b>{u.version && <> · v{u.version}</>}</span>
                    <b className="block">{u.tool}</b>
                    <span className="line-clamp-1 text-[13px] text-muted">{u.text}</span>
                  </span>
                  <Link href={`/news/${u.slug}`} className="btn-primary min-h-10 px-3 text-sm">{g("home.view")}</Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {show("howItWorks") && (
          <section className="rounded-[20px] bg-[#111418] p-9 text-white">
            <div className="grid grid-cols-2 items-center gap-8">
              <div>
                <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#7ce0a8]">{g("home.howEyebrow")}</span>
                <h2 className="display mt-2 text-[40px] leading-[1.05]">{g("home.howHeadline1")} <span className="text-[#7ce0a8]">{g("home.howHeadline2")}</span></h2>
                <p className="mt-3 text-[#dfe4dc]">{g("home.howText")}</p>
                <div className="mt-5 flex items-center gap-3">
                  <Link href="/store" className="inline-flex min-h-12 items-center rounded-xl bg-[#7ce0a8] px-5 font-semibold text-[#0b2a1a]">{g("home.browse")} <span className="inline-block rtl:-scale-x-100">→</span></Link>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1.5">{status}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 rounded-2xl border border-white/10 p-6 text-center text-sm text-[#dfe4dc]">
                {[["1", g("home.step1"), false], ["2", g("home.step2"), true], ["✓", g("home.step3"), false]].map(([n, l, hi]) => (
                  <span key={String(l)} className="flex flex-col items-center gap-2.5">
                    <span className={`grid h-14 w-14 place-items-center rounded-xl text-sm font-bold ${hi ? "bg-[#7ce0a8] text-[#0b2a1a]" : "border border-white/20"}`}>{n}</span>
                    {l}
                  </span>
                ))}
              </div>
            </div>
            {stats.length > 0 && (
              <div className="mt-8 grid gap-3" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                {stats.map((s) => (
                  <div key={s.l} className="rounded-2xl border border-white/10 p-5 text-center">
                    <b className="display block text-3xl text-[#7ce0a8]">{s.v}</b>
                    <span className="text-[13px] text-[#c9cfc6]">{s.l}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {show("reviews") && <ReviewsSection locale={locale} />}

      {show("aboutFaq") && (
        <section className="container-page mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{g("home.aboutEyebrow")}</span>
            <h2 className="display mt-1.5 text-2xl">{g("home.aboutTitle")}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{g("home.aboutText")}{methods ? ` ${g("home.aboutPay", { methods })}` : ""}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px]">
              {[1, 2, 3, 4].map((i) => <li key={i}>{g(`home.about${i}`)}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{g("home.faqEyebrow")}</span>
            <h2 className="display mt-1.5 text-2xl">{g("home.faqTitle")}</h2>
            <div className="mt-3 space-y-2.5">
              {faq.map((f, i) => (
                <details key={i} open={i === 0} className="group rounded-xl border border-border px-4 py-3 open:border-[#cfe7d8] open:bg-primary-soft/50">
                  <summary className="cursor-pointer font-semibold">{f.q}</summary>
                  <p className="mt-2 text-[15px] text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {show("support") && (
        <section className="container-page mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#111418] px-6 py-5 text-white">
            <span>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7ce0a8]">● {g("home.supportOnline")}</span>
              <b className="block text-xl">{g("home.needHelp")}</b>
              <span className="text-sm text-[#b9c0b6]">{g("home.needHelpSub")}</span>
            </span>
            <span className="flex gap-2.5">
              <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-xl bg-[#7ce0a8] px-5 font-semibold text-[#0b2a1a]">{g("home.whatsapp")}</a>
              {settings.telegramUrl && <a href={settings.telegramUrl} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-5 font-semibold">{g("home.telegram")}</a>}
            </span>
          </div>
        </section>
      )}
    </>
  );
}

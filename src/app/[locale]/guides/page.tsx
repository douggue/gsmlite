import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage } from "@/components/ContentPage";
import { pageSeo } from "@/lib/seo";
import { getDisplaySettings } from "@/lib/settings";
import { PayLogo } from "@/components/PayLogo";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import type { PageContent } from "@/lib/content/machine";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return pageSeo(locale, "/guides", t("guidesTitle"));
}

export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const locale = (await params).locale;
  const [t, s, written, gs] = await Promise.all([
    getTranslations("pages"),
    getDisplaySettings(),
    prisma.contentPage.findMany({ where: { kind: "guide", status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 60 }),
    getTranslations("gl.seo"),
  ]);
  const guides = [
    { id: "moncash", title: t("guideMoncashTitle"), steps: t.raw("guideMoncash") as string[], badge: <PayLogo brand="moncash" height={26} /> },
    { id: "natcash", title: t("guideNatcashTitle"), steps: t.raw("guideNatcash") as string[], badge: <PayLogo brand="natcash" height={26} />, extra: `${s.natcashRecipientName} · ${s.natcashRecipientPhone}` },
    { id: "imei", title: t("guidePlayerIdTitle"), steps: t.raw("guidePlayerId") as string[], badge: <span aria-hidden>📱</span> },
  ];
  return (
    <ContentPage title={t("guidesTitle")}>
      {written.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {written.map((w) => {
            const c = w.content as unknown as PageContent;
            const p = c[locale] ?? c.en ?? Object.values(c)[0];
            return p ? (
              <li key={w.id}><Link href={`/guides/${w.slug}`} className="card block h-full p-4 hover:border-primary"><b className="block">{p.title}</b><span className="mt-1 block text-sm text-muted">{p.description}</span><span className="mt-2 block text-sm font-semibold text-primary">{gs("readGuide")} →</span></Link></li>
            ) : null;
          })}
        </ul>
      )}
      <nav className="flex flex-wrap gap-2">
        {guides.map((g) => <a key={g.id} href={`#${g.id}`} className="badge border border-border bg-surface px-3 py-1.5">{g.title}</a>)}
      </nav>
      {guides.map((g) => (
        <section key={g.id} id={g.id} className="card scroll-mt-24 p-5 sm:p-6">
          <h2 className="flex items-center gap-3 text-xl font-bold">{g.badge} {g.title}</h2>
          {g.extra && <p className="mt-2 font-mono text-sm font-semibold">{g.extra}</p>}
          <ol className="mt-4 space-y-3">
            {g.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </ContentPage>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageSeo } from "@/lib/seo";
import { t } from "@/lib/text";
import { currentShopper, getCategories, searchProducts } from "@/lib/catalog";
import { allServiceStats, systemsOnline } from "@/lib/service-stats";
import { durationParts } from "@/lib/duration";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const g = await getTranslations({ locale, namespace: "gl.status" });
  return pageSeo(locale, "/status", g("title"), g("sub"));
}

/** Live service status from real delivery data: online, slow right now, or paused. */
export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const shopper = await currentShopper();
  const [g, gp, tt, categories, products, stats, online] = await Promise.all([
    getTranslations("gl.status"), getTranslations("gl.prices"), getTranslations("gl.time"), getCategories(shopper), searchProducts({ shopper }), allServiceStats(), systemsOnline(),
  ]);
  const time = (m: number | null) => {
    if (m == null) return "—";
    const d = durationParts(m);
    return tt(d.key, { n: d.n });
  };
  const counts = { online: 0, slow: 0, down: 0 };
  for (const p of products) counts[stats[p.id]?.status ?? "online"]++;
  const ids = new Map<string, string>();
  for (const c of categories) { ids.set(c.id, c.id); for (const ch of c.children) ids.set(ch.id, c.id); }
  const cls = { online: "text-[#145c39] dark:text-success", slow: "text-[#8a3607] dark:text-warning", down: "text-danger" };
  return (
    <div className="container-page max-w-[880px] pb-10 pt-4 lg:pt-8">
      <h1 className="display text-[32px] tracking-tight">{g("title")}</h1>
      <p className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${online && counts.slow === 0 && counts.down === 0 ? "bg-primary-soft text-primary" : "bg-warning-soft text-warning"}`}>
        ● {online && counts.slow === 0 && counts.down === 0 ? g("allOnline") : g("someIssues", { slow: counts.slow, down: counts.down })}
      </p>
      <p className="mt-2 text-sm text-muted">{g("sub")}</p>
      <div className="mt-6 space-y-4">
        {categories.map((c) => {
          const rows = products.filter((p) => ids.get(p.categoryId) === c.id);
          if (!rows.length) return null;
          return (
            <section key={c.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <h2 className="border-b border-border px-4 py-3 font-semibold">{t(c.name, locale)}</h2>
              <ul className="divide-y divide-border text-sm">
                {rows.map((p) => {
                  const s = stats[p.id];
                  const st = s?.status ?? "online";
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <Link href={`/products/${p.slug}`} className="font-medium hover:text-primary">{t(p.name, locale)}</Link>
                      <span className="flex items-center gap-4">
                        <span className="text-muted">{s?.medianMinutes != null ? time(s.medianMinutes) : ""}</span>
                        <span className={`font-semibold ${cls[st]}`}>● {gp(`st.${st}`)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

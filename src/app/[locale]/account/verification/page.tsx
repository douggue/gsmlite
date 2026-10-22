import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { t } from "@/lib/text";
import { ensureKycDefaults, userKycRank, type Requirement } from "@/lib/kyc";
import { KycForm } from "@/components/shop/KycForm";
import { Link } from "@/i18n/navigation";

/** Customer verification: levels the owner defined, what each needs, the status of what was sent. */
export default async function VerificationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ level?: string; next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const sp = await searchParams;
  await ensureKycDefaults();
  const [g, fmt, levels, subs, rank, me] = await Promise.all([
    getTranslations("gl.kyc"),
    getFormatter(),
    prisma.kycLevel.findMany({ where: { isActive: true }, orderBy: { rank: "asc" } }),
    prisma.kycSubmission.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    userKycRank(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true, phone: true } }),
  ]);
  const latest = (levelId: string) => subs.find((s) => s.levelId === levelId);
  const chosen = levels.find((l) => l.key === sp.level);
  const next = sp.next?.startsWith("/") ? sp.next : null;
  const statusCls: Record<string, string> = { APPROVED: "bg-primary-soft text-primary", PENDING: "bg-[#dcebfa] text-[#154a80]", NEEDS_MORE: "bg-[#fcebdd] text-[#8a3607]", REJECTED: "bg-danger-soft text-danger" };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="display text-2xl tracking-tight sm:text-3xl">{g("title")}</h1>
        <p className="mt-1 text-sm text-muted">{g("sub")}</p>
      </div>
      <p className="rounded-2xl bg-[#111418] px-4 py-3 text-sm text-white">
        {g("current")} <b className="text-[#7ce0a8]">{rank.levelKey ? t(levels.find((l) => l.key === rank.levelKey)?.name, locale) : g("none")}</b>
      </p>

      <ul className="space-y-3">
        {levels.map((l) => {
          const s = latest(l.id);
          const reqs = (l.requirements as Requirement[]) ?? [];
          const autoOnly = reqs.every((r) => r.type === "email" || r.type === "phone");
          const done = l.rank <= rank.rank;
          return (
            <li key={l.id} className={`rounded-2xl border bg-surface p-4 ${chosen?.id === l.id ? "border-2 border-primary" : "border-border"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-base">{t(l.name, locale)}</b>
                {done ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls.APPROVED}`}>{g("status.APPROVED")}</span>
                  : s && s.status !== "APPROVED" ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls[s.status]}`}>{g(`status.${s.status}`)}</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted">{t(l.description, locale)}</p>
              {s && (s.status === "NEEDS_MORE" || s.status === "REJECTED") && s.note && <p className="mt-2 rounded-xl bg-[#fcebdd] px-3 py-2 text-sm text-[#8a3607]">{s.note}</p>}
              {s?.status === "PENDING" && <p className="mt-2 text-xs text-muted">{g("sentOn", { date: fmt.dateTime(s.createdAt, { dateStyle: "medium", timeStyle: "short" }) })}</p>}
              {autoOnly && !done && (
                <ul className="mt-2 space-y-1 text-sm">
                  {reqs.map((r) => (
                    <li key={r.type}>{(r.type === "email" ? me?.emailVerified : me?.phone) ? "✓" : "○"} {t(r.label, locale)}{r.type === "phone" && !me?.phone && <> · <Link href="/account/profile" className="font-semibold text-primary">{g("addPhone")}</Link></>}</li>
                  ))}
                </ul>
              )}
              {!autoOnly && !done && s?.status !== "PENDING" && (
                chosen?.id === l.id
                  ? <KycForm levelId={l.id} next={next} requirements={reqs.map((r, i) => ({ i, type: r.type, label: t(r.label, locale), required: r.required })).filter((r) => r.type !== "email" && r.type !== "phone")} />
                  : <Link href={`/account/verification?level=${l.key}${next ? `&next=${encodeURIComponent(next)}` : ""}`} className="btn-primary mt-3 min-h-11">{s ? g("sendAgain") : g("start")}</Link>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">{g("privacy")}</p>
    </div>
  );
}

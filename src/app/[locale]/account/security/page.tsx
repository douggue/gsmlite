import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession, requireUser } from "@/lib/session";
import { SecurityForms } from "@/components/SecurityForms";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";

/** "iPhone · Safari" from a browser's user-agent text. */
function device(ua: string | null) {
  if (!ua) return null;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  return [os, browser].filter(Boolean).join(" · ") || ua.slice(0, 60);
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [ts, fmt, current, sessions] = await Promise.all([
    getTranslations("security"),
    getFormatter(),
    getSession(),
    // Read straight from the database: the auth library's listSessions refuses ("Session is not fresh")
    // once the sign-in is older than a day, which took the whole page down.
    prisma.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: "desc" }, select: { id: true, token: true, userAgent: true, ipAddress: true, updatedAt: true } }),
  ]);
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ts("title")}</h1>
      <SecurityForms />
      <TwoFactorSettings enabled={!!user.twoFactorEnabled} />
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">{ts("sessions")}</h2>
        <ul className="divide-y divide-border text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="py-3">
              <p className="font-medium">
                {device(s.userAgent) ?? "—"}
                {s.token === current?.session.token && <span className="badge ml-2 bg-success-soft text-success">{ts("thisDevice")}</span>}
              </p>
              <p className="text-xs text-muted">{s.ipAddress ? `${s.ipAddress} · ` : ""}{fmt.dateTime(new Date(s.updatedAt), { dateStyle: "medium", timeStyle: "short" })}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

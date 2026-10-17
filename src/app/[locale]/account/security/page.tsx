import { headers } from "next/headers";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getSession, requireUser } from "@/lib/session";
import { SecurityForms } from "@/components/SecurityForms";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const [ts, fmt, current, sessions] = await Promise.all([
    getTranslations("security"),
    getFormatter(),
    getSession(),
    auth.api.listSessions({ headers: await headers() }),
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
                {s.userAgent?.slice(0, 80) ?? "—"}
                {s.token === current?.session.token && <span className="badge ml-2 bg-success-soft text-success">{ts("thisDevice")}</span>}
              </p>
              <p className="text-xs text-muted">{s.ipAddress ?? ""} · {fmt.dateTime(new Date(s.updatedAt), { dateStyle: "medium", timeStyle: "short" })}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

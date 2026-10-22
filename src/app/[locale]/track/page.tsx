import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const g = await getTranslations({ locale, namespace: "gl.track" });
  return { title: g("title"), robots: { index: false } };
}

/** Find one of your orders by its number or by an IMEI in it. */
export default async function TrackPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await getTranslations("gl.track");
  const user = await getUser();
  const q = ((await searchParams).q ?? "").trim().replace(/[#\s-]/g, "").slice(0, 20);
  let notFound = false;
  if (user && q) {
    const byNumber = /^\d{1,9}$/.test(q) ? await prisma.order.findFirst({ where: { userId: user.id, number: Number(q) }, select: { id: true } }) : null;
    const byImei = byNumber ? null : await prisma.order.findFirst({ where: { userId: user.id, items: { some: { identifier: q } } }, orderBy: { createdAt: "desc" }, select: { id: true } });
    const hit = byNumber ?? byImei;
    if (hit) redirect(`/${locale}/account/orders/${hit.id}`);
    notFound = true;
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="display text-[28px] tracking-tight">{g("title")}</h1>
      <p className="mt-1.5 text-sm text-muted">{g("sub")}</p>
      {user ? (
        <form className="mt-5 flex gap-2">
          <label htmlFor="tq" className="sr-only">{g("label")}</label>
          <input id="tq" name="q" defaultValue={q} inputMode="numeric" placeholder={g("placeholder")} className="input h-12 min-w-0 flex-1 font-mono" />
          <button className="btn-primary min-h-12 px-5">{g("find")}</button>
        </form>
      ) : (
        <Link href="/auth/login?next=/track" className="btn-primary mt-5 min-h-12">{g("signIn")}</Link>
      )}
      {notFound && <p className="mt-3 rounded-xl bg-[#fcebdd] px-4 py-3 text-sm text-[#8a3607]">{g("notFound")}</p>}
      {user && <Link href="/account/orders" className="mt-6 inline-block text-sm font-semibold text-primary">{g("all")} <span className="inline-block rtl:-scale-x-100">→</span></Link>}
    </div>
  );
}

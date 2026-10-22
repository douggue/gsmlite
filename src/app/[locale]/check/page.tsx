import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageSeo } from "@/lib/seo";
import { getUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { checksLeft } from "@/lib/free-check";
import { fullCheckOffer } from "@/lib/check-offers";
import { CheckForm } from "@/components/shop/CheckForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const g = await getTranslations({ locale, namespace: "gl.check" });
  return pageSeo(locale, "/check", g("metaTitle"), g("metaDescription"));
}

/** Free IMEI check (mockup "Check"): the main way in; the result leads to the full check and the matching unlock. */
export default async function CheckPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ imei?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { imei } = await searchParams;
  const user = await getUser();
  const [settings, full] = await Promise.all([getSettings(), fullCheckOffer(user)]);
  const device = (await cookies()).get("gl_dev")?.value ?? null;
  const left = user ? await checksLeft(user.id, device) : settings.freeChecksPerDay;
  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-2 lg:pt-8">
      <CheckForm
        initial={(imei ?? "").replace(/\D/g, "").slice(0, 17)}
        signedIn={!!user}
        left={left}
        perDay={settings.freeChecksPerDay}
        full={full}
        creditDays={settings.checkCreditDays}
      />
    </div>
  );
}

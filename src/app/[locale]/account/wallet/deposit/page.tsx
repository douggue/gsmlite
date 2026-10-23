import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { moncashAvailable } from "@/lib/payments/moncash";
import { DepositForm } from "@/components/DepositForm";
import { VerifyGate } from "@/components/VerifyGate";
import { mustVerifyEmail } from "@/lib/verify-email";
import { getManualMethods } from "@/lib/manual-methods";
import { Link } from "@/i18n/navigation";
import { shopperCountry } from "@/lib/prefs";
import { payMethodsFor } from "@/lib/pay-methods";

export default async function DepositPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ method?: string }> }) {
  const { locale } = await params;
  const { method } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (await mustVerifyEmail(user.id)) return <VerifyGate email={user.email} />;
  const country = await shopperCountry(user);
  const [tw, tc, s, allManual, allowed] = await Promise.all([getTranslations("wallet"), getTranslations("common"), getSettings(), getManualMethods(locale, "deposits"), payMethodsFor(country, "deposits", locale)]);
  // Only what this customer's country may use (the others are never shown).
  const ok = new Set(allowed.map((m) => m.id));
  const manual = allManual.filter((m) => ok.has(`MANUAL:${m.id}`));
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/account/wallet" className="text-sm text-muted hover:text-text">← {tc("wallet")}</Link>
        <h1 className="display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{tw("depositTitle")}</h1>
      </div>
      <DepositForm
        initial={method}
        card={ok.has("CARD")}
        moncash={ok.has("MONCASH") && moncashAvailable(s.moncashEnabled)}
        natcash={ok.has("NATCASH")}
        natcashName={s.natcashRecipientName}
        natcashPhone={s.natcashRecipientPhone}
        natcashQr={s.natcashQrUrl}
        manual={manual}
        minHtg={Math.round(s.minDepositUsd * s.htgPerUsd)}
        maxHtg={Math.round(s.maxDepositUsd * s.htgPerUsd)}
        htgPerUsd={s.htgPerUsd}
      />
      <p className="text-sm text-muted">{tw("storeCredit")}</p>
    </div>
  );
}

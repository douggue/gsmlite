import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { AccountNav, type AccountNavGroup } from "@/components/AccountNav";
import { getSettings } from "@/lib/settings";

export const metadata = { robots: { index: false } };

export default async function AccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [ta, tc, tn, tg] = await Promise.all([getTranslations("account"), getTranslations("common"), getTranslations("notifications"), getTranslations("gl.kyc")]);
  const settings = await getSettings();
  const user = await requireUser(locale, `/${locale}/account`);
  const groups: AccountNavGroup[] = [
    { label: ta("groupStore"), items: [
      { href: "/account", label: ta("dashboard"), icon: "home" },
      { href: "/account/orders", label: ta("myOrders"), icon: "orders" },
      { href: "/store", label: tc("store"), icon: "store" },
    ] },
    { label: ta("groupWallet"), items: [
      { href: "/account/wallet", label: tc("wallet"), icon: "wallet" },
      { href: "/account/wallet/deposit", label: ta("addCredit"), icon: "add" },
      ...(settings.referralEnabled ? [{ href: "/account/referrals", label: ta("referrals"), icon: "gift" as const }] : []),
    ] },
    { label: ta("groupAccount"), items: [
      { href: "/account/profile", label: ta("profile"), icon: "user" },
      { href: "/account/verification", label: tg("verification"), icon: "kyc" },
      { href: "/account/notifications", label: tn("title"), icon: "bell" },
      { href: "/account/support", label: ta("support"), icon: "chat" },
      { href: "/account/security", label: ta("security"), icon: "security" },
      { href: "/account/privacy", label: ta("privacy"), icon: "privacy" },
    ] },
  ];
  return (
    <div className="container-page flex flex-col gap-5 lg:max-w-7xl py-5 sm:py-8 lg:flex-row lg:items-start lg:gap-6">
      <AccountNav groups={groups} user={{ name: user.name, email: user.email }} placeOrder={ta("placeOrder")} foldLabel={ta("foldMenu")} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

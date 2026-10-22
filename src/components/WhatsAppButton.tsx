import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "./Icons";
import { HideOnFormPages } from "./HideOnFormPages";

export async function WhatsAppButton({ number, message }: { number: string; message?: string }) {
  const t = await getTranslations("common");
  const text = encodeURIComponent(message ?? t("whatsappMessage"));
  return (
    <HideOnFormPages>
      <a
        href={`https://wa.me/${number}?text=${text}`}
        target="_blank"
        rel="noopener"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
        className="kb-hide fixed right-3 z-30 hidden lg:!bottom-6 lg:right-6 lg:inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-[#1fa855] px-3 font-semibold text-white shadow-lg shadow-black/20 hover:bg-[#178a45] md:h-14 md:px-4"
        aria-label={t("whatsappHelp")}
      >
        <WhatsAppIcon />
        <span className="hidden sm:inline">{t("help")}</span>
      </a>
    </HideOnFormPages>
  );
}

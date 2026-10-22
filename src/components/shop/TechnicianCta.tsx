import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";

/**
 * "Repair shop? Get technician prices" — shown to customers not yet in a price group, while a KYC level that
 * moves people into a group (shop check) is switched on. A request already waiting shows its status instead.
 */
export async function TechnicianCta({ userId }: { userId: string | null }) {
  const level = await prisma.kycLevel.findFirst({ where: { isActive: true, joinsGroupId: { not: null } }, orderBy: { rank: "asc" } });
  const group = level?.joinsGroupId ? await prisma.priceGroup.findUnique({ where: { id: level.joinsGroupId }, select: { discountBps: true } }) : null;
  if (!level || !group || group.discountBps <= 0) return null;
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { priceGroup: { select: { discountBps: true } } } });
    if ((u?.priceGroup?.discountBps ?? 0) >= group.discountBps) return null;
  }
  const waiting = userId ? await prisma.kycSubmission.findFirst({ where: { userId, levelId: level.id, status: "PENDING" } }) : null;
  const g = await getTranslations("gl.tech");
  const pct = Math.round(group.discountBps / 100);
  const href = `/account/verification?level=${level.key}`;
  return (
    <aside className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111418] p-4 text-white">
      <div className="min-w-0">
        <b className="block text-[15px]">{g("title", { pct })}</b>
        <span className="text-sm text-white/70">{waiting ? g("waiting") : g("sub")}</span>
      </div>
      {!waiting && (
        <Link href={userId ? href : `/auth/register?next=${encodeURIComponent(href)}`} className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-[#111418]">
          {g("cta")}
        </Link>
      )}
    </aside>
  );
}

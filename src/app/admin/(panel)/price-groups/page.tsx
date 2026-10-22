import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { savePriceGroup, setGroupPrice } from "@/actions/price-groups";
import { ActionForm } from "@/components/admin/ActionButton";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Price groups" };
const usd = (c: number | null | undefined) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);

/** Price groups (mockup): one card per group, then the selected group's settings and its fixed prices. */
export default async function PriceGroupsPage({ searchParams }: { searchParams: Promise<{ id?: string; q?: string }> }) {
  await requireStaff("catalog.manage");
  const sp = await searchParams;
  const [groups, retailCount, totalUsers] = await Promise.all([
    prisma.priceGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { discountBps: "asc" }], include: { _count: { select: { users: true } } } }),
    prisma.user.count({ where: { priceGroupId: null, role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
  ]);
  const g = sp.id === "new" ? null : groups.find((x) => x.id === sp.id) ?? groups[0] ?? null;
  const creating = sp.id === "new" || !groups.length;
  const q = (sp.q ?? "").trim();
  const nameIds = q ? (await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE name::text ILIKE ${"%" + q + "%"}`).map((r) => r.id) : null;
  const [fixed, variants] = g && !creating
    ? await Promise.all([
        prisma.groupPrice.findMany({ where: { priceGroupId: g.id } }),
        prisma.productVariant.findMany({
          where: { isActive: true, product: { isPublished: true, ...(nameIds ? { id: { in: nameIds } } : {}) } },
          include: { product: { select: { name: true } } },
          orderBy: [{ product: { sortOrder: "asc" } }, { sortOrder: "asc" }],
          take: 60,
        }),
      ])
    : [[], []];
  const fixedMap = new Map(fixed.map((f) => [f.variantId, f.priceUsd]));
  const card = (on: boolean) => `rounded-2xl border bg-surface p-4 ${on ? "border-2 border-primary" : "border-border"}`;
  const rule = (x: (typeof groups)[number]) => x.description || (x.autoRule === "spend" ? `Spends ${usd(x.minMonthlySpendUsd)}+ a month` : x.autoRule === "kyc" ? "Joined through KYC" : "Added by hand");

  return (
    <>
      <PageTitle title="Price groups" sub="Lower prices for technicians and loyal shops. A customer's group can change automatically with their monthly spending." actions={<Link href="/admin/price-groups?id=new" className="btn-secondary min-h-10 px-4">+ New group</Link>} />
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <div className={card(false)}><b className="block">Retail</b><span className="text-[13px] text-muted">Everyone by default</span><b className="display mt-2 block text-2xl">0%</b><span className="text-[13px] text-muted">{retailCount} of {totalUsers} customers</span></div>
        {groups.map((x) => (
          <Link key={x.id} href={`/admin/price-groups?id=${x.id}`} className={card(x.id === g?.id && !creating)}>
            <b className="block">{x.name}</b><span className="text-[13px] text-muted">{rule(x)}</span>
            <b className="display mt-2 block text-2xl text-primary">−{x.discountBps / 100}%</b><span className="text-[13px] text-muted">{x._count.users} customers</span>
          </Link>
        ))}
      </div>

      <section className="card mt-6 space-y-4 p-5">
        <h2 className="font-semibold">{creating ? "New group" : `${g?.name} group · settings`}</h2>
        <ActionForm action={savePriceGroup} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" resetOnSuccess={creating}>
          {!creating && g && <input type="hidden" name="id" value={g.id} />}
          <label><span className="label">Name</span><input name="name" defaultValue={creating ? "" : g?.name} required className="input" placeholder="Technician" /></label>
          <label><span className="label">Discount %</span><input name="discount" defaultValue={creating ? "10" : String((g?.discountBps ?? 0) / 100)} inputMode="decimal" className="input" /></label>
          <label><span className="label">Join automatically when</span>
            <select name="autoRule" defaultValue={creating ? "kyc" : g?.autoRule} className="input">
              <option value="kyc">Shop KYC approved</option>
              <option value="spend">Monthly spending over…</option>
              <option value="manual">Only by hand</option>
            </select>
          </label>
          <label><span className="label">Monthly spending (USD, for “spending”)</span><input name="minSpend" defaultValue={creating ? "" : ((g?.minMonthlySpendUsd ?? 0) / 100).toFixed(2)} inputMode="decimal" className="input" /></label>
          <label><span className="label">Never sell below cost + (USD)</span><input name="floor" defaultValue={creating ? "0.20" : ((g?.floorProfitUsd ?? 0) / 100).toFixed(2)} inputMode="decimal" className="input" /></label>
          <label><span className="label">Note for staff</span><input name="description" defaultValue={creating ? "" : g?.description ?? ""} className="input" placeholder="Shop verified (KYC)" /></label>
          <button className="btn-primary min-h-11 sm:col-span-2 sm:justify-self-start lg:col-span-3">Save group</button>
        </ActionForm>
        {!creating && g?.autoRule === "kyc" && <p className="text-xs text-muted">Pick this group as “Joins price group” on a level in <Link href="/admin/kyc/settings" className="text-primary">KYC levels</Link>.</p>}
      </section>

      {!creating && g && (
        <section className="card mt-6 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="font-semibold">Fixed prices for this group (win over the %)</h3>
            <form className="flex gap-2"><input type="hidden" name="id" value={g.id} /><input name="q" defaultValue={q} placeholder="Search a service" className="input min-h-10 w-56" /></form>
          </div>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5">Service</th><th className="px-4 py-2.5">Retail</th><th className="px-4 py-2.5">Group price</th><th className="px-4 py-2.5">Margin</th></tr></thead>
            <tbody>
              {variants.map((v) => {
                const retail = v.salePriceUsd ?? v.priceUsd;
                const f = fixedMap.get(v.id);
                const pct = Math.max(1, Math.round((retail * (10_000 - g.discountBps)) / 10_000));
                const floor = v.costUsd != null && g.floorProfitUsd ? Math.min(retail, v.costUsd + g.floorProfitUsd) : 0;
                const groupPrice = f != null ? Math.min(f, retail) : Math.max(pct, floor);
                return (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-4 py-2.5">{t(v.product.name, "en")} <span className="text-muted">· {t(v.name, "en")}</span></td>
                    <td className="px-4 py-2.5 tabular-nums">{usd(retail)}</td>
                    <td className="px-4 py-2.5">
                      <ActionForm action={setGroupPrice} className="flex items-center gap-2">
                        <input type="hidden" name="groupId" value={g.id} /><input type="hidden" name="variantId" value={v.id} />
                        <input name="price" defaultValue={f != null ? (f / 100).toFixed(2) : ""} placeholder={(groupPrice / 100).toFixed(2)} inputMode="decimal" className="input min-h-9 w-24" aria-label="Fixed price" />
                        <button className="btn-secondary min-h-9 px-2.5 text-xs">Set</button>
                      </ActionForm>
                    </td>
                    <td className={`px-4 py-2.5 tabular-nums ${v.costUsd != null && groupPrice - v.costUsd <= 0 ? "text-danger" : ""}`}>{v.costUsd != null ? usd(groupPrice - v.costUsd) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-muted">Empty = the group % applies (shown in grey). Leave the box empty and press Set to remove a fixed price.</p>
        </section>
      )}
    </>
  );
}

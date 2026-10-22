import { packCostCents, packSizeFor } from "@/lib/packs";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { ago } from "@/lib/ago";
import { syncSupplier } from "@/actions/suppliers";
import { ActionButton } from "@/components/admin/ActionButton";
import { SupplierForm } from "@/components/admin/SupplierForm";
import { ImportTable, type ImportRow } from "@/components/admin/ImportTable";
import type { ServiceMeta } from "@/lib/suppliers/sync";

export const metadata = { title: "Supplier service list" };

const SHOWS = { todo: "Not imported", imported: "Already on my site", new: "New", changed: "Price changed", removed: "Removed by supplier" } as const;
type Show = keyof typeof SHOWS;
const TYPES: ServiceType[] = ["IMEI", "SERVER", "REMOTE"];
const SORTS = { group: "Group", name: "Name", cost: "Cost", time: "Delivery time" } as const;
const RECENT = 14 * 86_400_000;

export default async function SupplierServices({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff("suppliers.manage");
  const { id } = await params;
  const sp = await searchParams;
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  const show: Show = sp.show && sp.show in SHOWS ? (sp.show as Show) : "todo";
  const type = TYPES.includes(sp.type as ServiceType) ? (sp.type as ServiceType) : undefined;
  const sort = sp.sort && sp.sort in SORTS ? (sp.sort as keyof typeof SORTS) : "group";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const group = sp.group?.slice(0, 200);

  const linked = await prisma.productVariant.findMany({
    where: { supplierId: id, supplierServiceId: { not: null } },
    select: { supplierServiceId: true, productId: true, priceUsd: true, salePriceUsd: true, pausedBySupplier: true },
  });
  const onSite = new Map(linked.map((v) => [v.supplierServiceId!, v]));
  const importedIds = [...onSite.keys()];
  // Services from the very first sync are not "new"; later additions are, for two weeks.
  const newSince = new Date(Math.max(supplier.createdAt.getTime() + 3_600_000, Date.now() - RECENT));
  const changedSince = new Date(Date.now() - RECENT);

  const showWhere: Record<Show, Prisma.SupplierServiceWhereInput> = {
    todo: { active: true, remoteId: { notIn: importedIds } },
    imported: { remoteId: { in: importedIds } },
    new: { active: true, firstSeenAt: { gte: newSince } },
    changed: { active: true, priceChangedAt: { gte: changedSince } },
    removed: { active: false },
  };
  const base: Prisma.SupplierServiceWhereInput = {
    supplierId: id,
    ...(type ? { type } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { groupName: { contains: q, mode: "insensitive" } }, { remoteId: q }] } : {}),
  };
  const [counts, groups, services, categories] = await Promise.all([
    Promise.all((Object.keys(SHOWS) as Show[]).map((k) => prisma.supplierService.count({ where: { ...base, ...showWhere[k] } }))),
    prisma.supplierService.groupBy({ by: ["groupName"], where: { ...base, ...showWhere[show] }, _count: true, orderBy: { groupName: "asc" } }),
    prisma.supplierService.findMany({
      where: { ...base, ...showWhere[show], ...(group ? { groupName: group } : {}) },
      orderBy: sort === "cost" ? [{ credit: "asc" }] : sort === "name" ? [{ name: "asc" }] : sort === "time" ? [{ time: "asc" }, { name: "asc" }] : [{ groupName: "asc" }, { name: "asc" }],
      take: 400,
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true, parent: { select: { name: true } } } }),
  ]);
  const total = await prisma.supplierService.count({ where: { supplierId: id, active: true } });
  const nNew = await prisma.supplierService.count({ where: { supplierId: id, ...showWhere.new } });

  const rows: ImportRow[] = services.map((s) => {
    const meta = (s.fields ?? {}) as unknown as Partial<ServiceMeta>;
    const asks = [
      ...(s.type === "IMEI" ? [meta.identifierLabel || "IMEI"] : []),
      ...(meta.inputs ?? []).map((f) => (f.type === "select" ? `${f.name} (list)` : f.name)),
      ...(meta.qty ? [`Qty ${meta.qty.min}–${meta.qty.max}`] : []),
    ];
    const v = onSite.get(s.remoteId);
    return {
      id: s.id,
      remoteId: s.remoteId,
      name: s.name,
      group: s.groupName,
      type: s.type,
      time: s.time,
      info: s.info,
      asks,
      // Sub-cent credits are priced per pack (see lib/packs)
      pack: s.type === "SERVER" ? packSizeFor(s.creditMicros) : 1,
      cost: s.type === "SERVER" && packSizeFor(s.creditMicros) > 1 ? packCostCents(s.creditMicros, packSizeFor(s.creditMicros)) : s.credit,
      was: s.priceChangedAt && s.priceChangedAt >= changedSince ? s.previousCredit : null,
      isNew: s.firstSeenAt >= newSince,
      active: s.active,
      onSite: v ? { productId: v.productId, price: v.salePriceUsd ?? v.priceUsd, paused: v.pausedBySupplier } : null,
    };
  });

  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const all = { show, type, sort, q: q || undefined, group, ...p };
    for (const [k, val] of Object.entries(all)) if (val && !(k === "show" && val === "todo") && !(k === "sort" && val === "group")) u.set(k, val);
    const s = u.toString();
    return `/admin/suppliers/${id}${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean, warn = false) =>
    `inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold ${on ? "bg-[#111418] text-white dark:bg-primary" : `border bg-surface ${warn ? "border-warning/40 text-warning" : "border-border"}`}`;
  // Phones: one row that scrolls sideways; wide screens: wraps.
  const scroller = "-mx-4 flex gap-2 overflow-x-auto whitespace-nowrap px-4 sm:mx-0 sm:flex-wrap sm:px-0 [&>*]:shrink-0";
  const pill = (on: boolean) => `rounded-full px-2.5 py-1 font-semibold ${on ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`;

  const groupLinks = (
    <>
      <Link href={href({ group: undefined })} className={`flex justify-between border-b border-border px-3.5 py-2.5 ${!group ? "bg-primary-soft font-semibold" : ""}`}>
        <span>All groups</span><span>{groups.reduce((n, g) => n + g._count, 0)}</span>
      </Link>
      {groups.map((g) => (
        <Link key={g.groupName} href={href({ group: g.groupName })} className={`flex justify-between gap-2 border-b border-border px-3.5 py-2.5 last:border-0 ${group === g.groupName ? "bg-primary-soft font-semibold" : ""}`}>
          <span className="min-w-0 truncate">{g.groupName}</span><span>{g._count}</span>
        </Link>
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/suppliers" className="text-sm text-primary">← Suppliers</Link>
          <h1 className="display mt-1 text-2xl font-bold sm:text-3xl">{supplier.name} · service list</h1>
          <p className="mt-1 text-sm text-muted">{total} services from their site · synced {ago(supplier.lastSyncAt)}{nNew ? ` · ${nNew} new` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Sync now" className="btn-secondary min-h-11 px-4" action={syncSupplier.bind(null, id)} />
          <Link href={`/admin/suppliers/${id}/logs`} className="btn-secondary min-h-11 px-4">Logs</Link>
        </div>
      </div>

      {total === 0 && (
        <p className="card p-5 text-sm">No services yet. Press <b>Sync now</b> to load {supplier.name}&apos;s list.{supplier.lastError && <span className="mt-1 block text-danger">Last error: {supplier.lastError}</span>}</p>
      )}

      <form action={`/admin/suppliers/${id}`} className="flex flex-wrap items-center gap-2">
        {show !== "todo" && <input type="hidden" name="show" value={show} />}
        {type && <input type="hidden" name="type" value={type} />}
        <label htmlFor="q" className="sr-only">Search the supplier&apos;s services</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search: iPhone, Samsung FRP, Chimera…" className="input min-h-11 flex-[1_1_300px]" />
        <div className={scroller}>
        {(Object.keys(SHOWS) as Show[]).map((k, i) => (
          <Link key={k} href={href({ show: k, group: undefined })} className={chip(show === k, k === "removed" && counts[i] > 0)}>
            {SHOWS[k]} {counts[i]}
          </Link>
        ))}
        </div>
      </form>

      <div className={`${scroller} items-center !gap-1.5 text-[13px]`}>
        <span className="font-semibold">Type:</span>
        <Link href={href({ type: undefined })} className={pill(!type)}>All</Link>
        {TYPES.map((x) => <Link key={x} href={href({ type: x })} className={pill(type === x)}>{x === "IMEI" ? "IMEI" : x[0] + x.slice(1).toLowerCase()}</Link>)}
        <span className="ml-3 font-semibold">Sort:</span>
        {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => <Link key={k} href={href({ sort: k })} className={pill(sort === k)}>{SORTS[k]}</Link>)}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <details aria-label="Supplier groups" className="card w-full overflow-hidden lg:hidden">
          <summary className="flex cursor-pointer justify-between px-3.5 py-3 text-sm font-semibold"><span>Group: {group ?? "All groups"}</span><span>▾</span></summary>
          <nav className="max-h-[50vh] overflow-y-auto border-t border-border text-sm">{groupLinks}</nav>
        </details>
        <aside aria-label="Supplier groups" className="card hidden w-60 shrink-0 overflow-hidden lg:block">
          <h2 className="border-b border-border px-3.5 py-3 text-sm font-semibold">Their groups</h2>
          <nav className="max-h-[60vh] overflow-y-auto text-sm">{groupLinks}</nav>
        </aside>

        <div className="min-w-0 flex-[4_1_560px]">
          <ImportTable rows={rows} categories={categories.map((c) => ({ id: c.id, name: c.parent ? `${t(c.parent.name, "en")} › ${t(c.name, "en")}` : t(c.name, "en") }))} />
        </div>
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">Connection settings</summary>
        <div className="mt-3"><SupplierForm s={supplier} /></div>
      </details>
    </div>
  );
}

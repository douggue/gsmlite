import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { saveCategory } from "@/actions/admin";
import { ActionForm } from "@/components/admin/ActionButton";
import { PageTitle, Table, Empty } from "@/components/admin/ui";
import { LocalizedInputs } from "@/components/admin/LocalizedInputs";
import { ImageField } from "@/components/admin/ImageField";

export const metadata = { title: "Services & prices" };

const SHOW = { all: "All", live: "On the site", draft: "Hidden", loss: "Losing money", paused: "Paused by supplier" } as const;
type Show = keyof typeof SHOW;

/** Services & prices (mockup): search and filters, cost vs price per service, losses flagged first. */
export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; cat?: string; type?: string }> }) {
  await requireStaff("catalog.manage");
  const sp = await searchParams;
  const show: Show = sp.show && sp.show in SHOW ? (sp.show as Show) : "all";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const where: Prisma.ProductWhereInput = {
    ...(sp.cat ? { categoryId: sp.cat } : {}),
    ...(sp.type && ["IMEI", "SERVER", "REMOTE", "FILE"].includes(sp.type) ? { serviceType: sp.type as "IMEI" } : {}),
    ...(show === "live" ? { isPublished: true } : show === "draft" ? { isPublished: false } : show === "paused" ? { variants: { some: { pausedBySupplier: true } } } : {}),
    ...(q ? { OR: [{ slug: { contains: q.toLowerCase() } }, { tags: { has: q } }, { variants: { some: { supplierServiceId: q } } }, { name: { path: ["en"], string_contains: q } }] } : {}),
  };
  const [all, categories] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ sortOrder: "asc" }], take: 400, include: { category: true, variants: { include: { supplier: { select: { name: true } } } } } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  const losing = (p: (typeof all)[number]) => p.variants.some((v) => v.isActive && v.costUsd != null && (v.salePriceUsd ?? v.priceUsd) < v.costUsd);
  const products = (show === "loss" ? all.filter(losing) : all).sort((a, b) => Number(losing(b)) - Number(losing(a)));
  const lossCount = all.filter(losing).length;
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, show: show === "all" ? undefined : show, cat: sp.cat, type: sp.type, ...p })) if (v) u.set(k, v);
    return `/admin/products${u.size ? `?${u}` : ""}`;
  };
  return (
    <>
      <PageTitle title="Services & prices" sub="From a supplier (Suppliers → import) or your own." actions={<><Link href="/admin/suppliers" className="btn-secondary">Import from a supplier</Link><Link href="/admin/products/new" className="btn-primary">+ New service</Link></>} />
      <form className="mb-3 flex flex-wrap items-center gap-2">
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        <label htmlFor="pq" className="sr-only">Search services</label>
        <input id="pq" name="q" defaultValue={q} placeholder="Name, address, tag or supplier ID…" className="input min-h-11 flex-[1_1_240px]" />
        <select name="cat" defaultValue={sp.cat ?? ""} className="input min-h-11 w-auto" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{t(c.name, "en")}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="input min-h-11 w-auto" aria-label="Type">
          <option value="">All types</option><option value="IMEI">IMEI</option><option value="SERVER">Server</option><option value="REMOTE">Remote</option><option value="FILE">File</option>
        </select>
        <button className="btn-secondary min-h-11 px-4">Search</button>
      </form>
      <nav className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
        {(Object.keys(SHOW) as Show[]).map((f) => (
          <Link key={f} href={href({ show: f === "all" ? undefined : f })}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold ${show === f ? "bg-[#111418] text-white dark:bg-primary" : `border bg-surface ${f === "loss" && lossCount ? "border-danger/50 text-danger" : "border-border"}`}`}>
            {SHOW[f]}{f === "loss" ? ` ${lossCount}` : ""}
          </Link>
        ))}
      </nav>
      <Table head={["Service", "Category", "Type", "Options", "Cost", "Price", "Margin", "Status"]} empty={products.length === 0} emptyText={<Empty title="No services here" hint="Add a service by hand, or import a list from a supplier." />}>
        {products.map((p) => {
          const active = p.variants.filter((v) => v.isActive);
          const cheapest = active.length ? active.reduce((a, b) => ((a.salePriceUsd ?? a.priceUsd) <= (b.salePriceUsd ?? b.priceUsd) ? a : b)) : null;
          const price = cheapest ? cheapest.salePriceUsd ?? cheapest.priceUsd : null;
          const cost = cheapest?.costUsd ?? null;
          const loss = losing(p);
          const margin = price && cost != null ? Math.round(((price - cost) / price) * 100) : null;
          const suppliers = [...new Set(p.variants.map((v) => v.supplier?.name).filter(Boolean))];
          return (
            <tr key={p.id} className={loss ? "bg-danger-soft/40" : "hover:bg-surface-2"}>
              <td className="px-4 py-3"><div className="flex items-center gap-3">{p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg" style={{ background: p.accent ?? "#1F7A4D" }} />}<div><Link href={`/admin/products/${p.id}`} className="font-semibold text-primary">{t(p.name, "en")}</Link><br /><span className="text-xs text-muted">{suppliers.length ? suppliers.join(", ") : p.fulfillmentType === "MANUAL" ? "Manual" : p.fulfillmentType === "CODE_INVENTORY" ? "Codes from stock" : "No supplier"}</span></div></div></td>
              <td className="px-4 py-3">{t(p.category.name, "en")}</td>
              <td className="px-4 py-3 text-xs">{p.serviceType}</td>
              <td className="px-4 py-3">{p.variants.length}</td>
              <td className="px-4 py-3 tabular-nums text-muted">{cost != null ? formatMoney(cost, "USD", "en") : "—"}</td>
              <td className="px-4 py-3 tabular-nums">{price != null ? formatMoney(price, "USD", "en") : "—"}</td>
              <td className={`px-4 py-3 font-semibold ${loss ? "text-danger" : ""}`}>{loss ? "Loss! cost went up" : margin != null ? `${margin}%` : "—"}</td>
              <td className="px-4 py-3">{p.isPublished ? <span className="badge bg-success-soft text-success">On the site</span> : <span className="badge bg-surface-2 text-muted">Hidden</span>}{p.isFeatured && <span className="badge ml-1 bg-primary-soft text-primary">Featured</span>}{p.variants.some((v) => v.pausedBySupplier) && <span className="badge ml-1 bg-warning-soft text-warning">Paused</span>}</td>
            </tr>
          );
        })}
      </Table>

      <details id="categories" className="mt-10">
      <summary className="mb-3 cursor-pointer text-lg font-semibold">Categories ({categories.length})</summary>
      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        {categories.map((c) => (
          <ActionForm key={c.id} action={saveCategory} className="card space-y-3 p-4">
            <input type="hidden" name="id" value={c.id} />
            <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] gap-2">
              <input name="slug" defaultValue={c.slug} className="input" aria-label="Slug" />
              <input name="icon" defaultValue={c.icon ?? ""} className="input" aria-label="Icon" />
              <input name="sortOrder" type="number" defaultValue={c.sortOrder} className="input" aria-label="Order" />
            </div>
            <LocalizedInputs prefix="name" label="Name" value={c.name as Record<string, string>} />
            <label className="block"><span className="label">Parent (makes this a subcategory)</span>
              <select name="parentId" defaultValue={c.parentId ?? ""} className="input">
                <option value="">None (top level)</option>
                {categories.filter((x) => !x.parentId && x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{t(x.name, "en")}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
              <ImageField name="cover" label="Background image (big)" value={c.cover} folder="categories" aspect="aspect-[16/9]" hint="Wide picture filling the whole card, about 1200×700 px. Keep the left side calm: the name and icon sit there. Empty = colored background." />
              <ImageField name="image" label="Square icon (small)" value={c.image} folder="categories" aspect="aspect-square" hint="Replaces the emoji in the white tile." />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVisible" defaultChecked={c.isVisible} /> Visible · {c._count.products} products</label>
              <button className="btn-secondary min-h-9 px-3 text-xs">Save</button>
            </div>
          </ActionForm>
        ))}
        <ActionForm action={saveCategory} className="card space-y-3 border-dashed p-4" resetOnSuccess>
          <p className="font-semibold">New category</p>
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] gap-2">
            <input name="slug" placeholder="slug" className="input" required />
            <input name="icon" placeholder="🎮" className="input" />
            <input name="sortOrder" type="number" defaultValue={10} className="input" />
          </div>
          <LocalizedInputs prefix="name" label="Name" />
          <label className="block"><span className="label">Parent (optional)</span>
            <select name="parentId" defaultValue="" className="input">
              <option value="">None (top level)</option>
              {categories.filter((x) => !x.parentId).map((x) => <option key={x.id} value={x.id}>{t(x.name, "en")}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <ImageField name="cover" label="Background image (big)" folder="categories" aspect="aspect-[16/9]" hint="Wide picture filling the whole card, about 1200×700 px. Keep the left side calm: the name and icon sit there. Empty = colored background." />
            <ImageField name="image" label="Square icon (small)" folder="categories" aspect="aspect-square" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVisible" defaultChecked /> Visible</label>
          <button className="btn-primary min-h-9 px-3 text-xs">Create</button>
        </ActionForm>
      </div>
      </details>
    </>
  );
}

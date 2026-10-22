import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { saveVariant, setProductSoldOut } from "@/actions/admin";
import { ActionForm } from "@/components/admin/ActionButton";
import { LocalizedInputs } from "@/components/admin/LocalizedInputs";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageTitle } from "@/components/admin/ui";
import type { FieldDef } from "@/lib/orders";

export const metadata = { title: "Edit service" };

/** Lines like "Model · list · required · sent as MODELID" for the fields panel. */
function summarize(fields: FieldDef[]) {
  return fields.map((f) => `${t(f.label, "en") || f.key} · ${f.type}${f.required ? " · required" : ""}${f.supplierName ? ` · sent as ${f.supplierName.replace(/^param:/, "")}` : ""}`);
}

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("catalog.manage");
  const { id } = await params;
  const [categories, kycLevels] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.kycLevel.findMany({ where: { isActive: true }, orderBy: { rank: "asc" } }),
  ]);
  const cats = categories.map((c) => ({ id: c.id, name: t(c.name, "en") }));
  const levels = kycLevels.map((l) => ({ key: l.key, name: t(l.name, "en") }));
  if (id === "new") {
    return (
      <>
        <PageTitle title="New service" sub="Your own service (delivered by hand or from license-key stock), or link options to a supplier below once saved." />
        <ProductForm categories={cats} kycLevels={levels} />
      </>
    );
  }
  const product = await prisma.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { codes: { where: { status: "AVAILABLE" } } } } } } } });
  if (!product) notFound();
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const linked = await prisma.supplierService.findMany({
    where: { OR: product.variants.filter((v) => v.supplierId && v.supplierServiceId).map((v) => ({ supplierId: v.supplierId!, remoteId: v.supplierServiceId! })) },
    select: { supplierId: true, remoteId: true, name: true, credit: true, active: true, previousCredit: true, priceChangedAt: true },
  });
  const linkedName = (v: { supplierId: string | null; supplierServiceId: string | null }) => linked.find((l) => l.supplierId === v.supplierId && l.remoteId === v.supplierServiceId);
  const qtyFields = product.serviceType === "SERVER";
  const money = (n: number | null) => (n == null ? "" : (n / 100).toFixed(2));
  const supplierName = (sid: string | null) => suppliers.find((x) => x.id === sid)?.name;
  return (
    <>
      <PageTitle title={`Edit service · ${t(product.name, "en")}`} sub={`/${product.slug} · ${product.variants.some((v) => v.supplierId) ? "from a supplier" : "your own service"}`} actions={<Link href="/admin/products/new" className="btn-secondary min-h-10 px-4">+ New service</Link>} />
      <ProductForm
        categories={cats}
        kycLevels={levels}
        fieldsSummary={summarize(product.fields as FieldDef[])}
        product={{
          id: product.id, slug: product.slug, categoryId: product.categoryId, accent: product.accent ?? "#1F7A4D",
          fulfillmentType: product.fulfillmentType, isPublished: product.isPublished, isFeatured: product.isFeatured, sortOrder: product.sortOrder,
          name: product.name as Record<string, string>, description: product.description as Record<string, string>,
          delivery: (product.deliveryEstimate ?? {}) as Record<string, string>, seoTitle: (product.seoTitle ?? {}) as Record<string, string>,
          seoDescription: (product.seoDescription ?? {}) as Record<string, string>, fields: JSON.stringify(product.fields, null, 2),
          image: product.image, gallery: (product.gallery ?? []) as string[], tags: product.tags,
          serviceType: product.serviceType, identifierLabel: (product.identifierLabel ?? {}) as Record<string, string>,
          identifierFormat: product.identifierFormat, allowBulk: product.allowBulk,
          countryMode: product.countryMode, countries: product.countries, hideFromGoogle: product.hideFromGoogle, offerCheck: product.offerCheck,
          seoPage: product.seoPage, kycLevelKey: product.kycLevelKey,
          cardTitle: (product.cardTitle ?? {}) as Record<string, string>, cardTag: (product.cardTag ?? {}) as Record<string, string>, cardStyle: product.cardStyle,
        }}
      />

      <section className="card mt-6 overflow-x-auto">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Options and prices</h2>
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5">Option</th><th className="px-4 py-2.5">Supplier · ID</th><th className="px-4 py-2.5">Cost</th><th className="px-4 py-2.5">Price</th><th className="px-4 py-2.5">Margin</th></tr></thead>
          <tbody>
            {product.variants.map((v) => {
              const l = linkedName(v);
              const cost = l?.credit ?? v.costUsd;
              const price = v.salePriceUsd ?? v.priceUsd;
              const margin = cost != null ? price - cost : null;
              const rose = l?.previousCredit != null && l.credit > l.previousCredit && l.priceChangedAt && Date.now() - l.priceChangedAt.getTime() < 30 * 86_400_000;
              return (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-4 py-3">{t(v.name, "en")}{v.soldOut && <span className="ml-1.5 text-xs text-danger">out of stock</span>}</td>
                  <td className="px-4 py-3">{v.supplierId ? `${supplierName(v.supplierId) ?? "?"} · ${v.supplierServiceId}` : <span className="text-muted">— your own</span>}</td>
                  <td className="px-4 py-3 tabular-nums">{cost != null ? `$${money(cost)}` : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">${money(price)}{v.salePriceUsd != null && <span className="ml-1 text-xs text-muted line-through">${money(v.priceUsd)}</span>}</td>
                  <td className={`px-4 py-3 font-semibold tabular-nums ${margin == null ? "text-muted" : margin <= 0 ? "text-danger" : "text-primary"}`}>
                    {margin == null ? "—" : margin <= 0 ? `Loss!${rose ? " cost went up" : ""}` : `$${money(margin)} · ${cost ? Math.round((margin / cost) * 100) : 100}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Edit options (prices in USD; HTG is converted at the store rate)</h2>
        <div className="flex flex-wrap gap-2">
          <ActionForm action={setProductSoldOut}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="soldOut" value="1" />
            <button className="btn-secondary min-h-9 px-3 text-xs text-danger">Mark all out of stock</button>
          </ActionForm>
          <ActionForm action={setProductSoldOut}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="soldOut" value="0" />
            <button className="btn-secondary min-h-9 px-3 text-xs">All back in stock</button>
          </ActionForm>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {product.variants.map((v) => (
          <ActionForm key={v.id} action={saveVariant} className="card space-y-3 p-4">
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="productId" value={product.id} />
            <LocalizedInputs prefix="vname" label="Name" value={v.name as Record<string, string>} />
            <div className="grid grid-cols-3 gap-2">
              <label><span className="mb-1 block text-xs text-muted">Price USD</span><input name="price" defaultValue={money(v.priceUsd)} className="input" inputMode="decimal" /></label>
              <label><span className="mb-1 block text-xs text-muted">Sale price</span><input name="salePrice" defaultValue={money(v.salePriceUsd)} className="input" inputMode="decimal" /></label>
              <label><span className="mb-1 block text-xs text-muted">Order</span><input name="sortOrder" type="number" defaultValue={v.sortOrder} className="input" /></label>
            </div>
            {qtyFields ? (
              <div className="grid grid-cols-2 gap-2">
                <label><span className="mb-1 block text-xs text-muted">Min quantity</span><input name="minQty" type="number" min={1} defaultValue={v.minQty} className="input" /></label>
                <label><span className="mb-1 block text-xs text-muted">Max quantity</span><input name="maxQty" type="number" min={1} defaultValue={v.maxQty} className="input" /></label>
              </div>
            ) : (
              <><input type="hidden" name="minQty" value="1" /><input type="hidden" name="maxQty" value="1" /></>
            )}
            <SupplierLink suppliers={suppliers} supplierId={v.supplierId} serviceId={v.supplierServiceId} cost={money(v.costUsd)} linked={linkedName(v)} price={v.salePriceUsd ?? v.priceUsd} />
            <div className="flex items-center justify-between text-sm">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={v.isActive} /> Active</label>
                <label className={`flex items-center gap-2 ${v.soldOut ? "font-semibold text-danger" : ""}`}><input type="checkbox" name="soldOut" defaultChecked={v.soldOut} /> Out of stock</label>
              </span>
              {product.fulfillmentType === "CODE_INVENTORY" && <Link href={`/admin/codes?variant=${v.id}`} className="text-primary">{v._count.codes} codes in stock</Link>}
              <button className="btn-secondary min-h-9 px-3 text-xs">Save</button>
            </div>
          </ActionForm>
        ))}
        <ActionForm action={saveVariant} className="card space-y-3 border-dashed p-4" resetOnSuccess>
          <p className="font-semibold">New variant</p>
          <input type="hidden" name="productId" value={product.id} />
          <LocalizedInputs prefix="vname" label="Name" />
          <div className="grid grid-cols-3 gap-2">
            <input name="price" placeholder="Price USD" className="input" inputMode="decimal" required />
            <input name="salePrice" placeholder="Sale (optional)" className="input" inputMode="decimal" />
            <input name="sortOrder" type="number" defaultValue={product.variants.length} className="input" />
          </div>
          <SupplierLink suppliers={suppliers} supplierId={product.variants[0]?.supplierId ?? null} serviceId={null} cost="" price={0} />
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked /> Active</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="soldOut" /> Out of stock</label>
          </div>
          <button className="btn-primary min-h-9 px-3 text-xs">Add variant</button>
        </ActionForm>
      </div>
    </>
  );
}

/** Which supplier service an option is sent to, with the margin at the current price. */
function SupplierLink({ suppliers, supplierId, serviceId, cost, linked, price }: {
  suppliers: { id: string; name: string }[];
  supplierId: string | null;
  serviceId: string | null;
  cost: string;
  linked?: { name: string; credit: number; active: boolean };
  price: number;
}) {
  const margin = linked && price ? price - linked.credit : null;
  return (
    <div className="space-y-2 rounded-xl bg-surface-2 p-3">
      <div className="grid grid-cols-[1fr_8rem_6rem] gap-2">
        <label><span className="mb-1 block text-xs text-muted">Supplier</span>
          <select name="supplierId" defaultValue={supplierId ?? ""} className="input">
            <option value="">None (manual / stock)</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label><span className="mb-1 block text-xs text-muted">Service ID</span><input name="supplierServiceId" defaultValue={serviceId ?? ""} className="input" placeholder="e.g. 6904" /></label>
        <label><span className="mb-1 block text-xs text-muted">Cost USD</span><input name="cost" defaultValue={cost} className="input" inputMode="decimal" disabled={!!linked} /></label>
      </div>
      {linked && (
        <p className="text-xs text-muted">
          {linked.name} · cost ${(linked.credit / 100).toFixed(2)}
          {margin != null && <b className={margin > 0 ? " text-success" : " text-danger"}> · margin ${(margin / 100).toFixed(2)}</b>}
          {!linked.active && <b className="text-danger"> · no longer in the supplier&apos;s list</b>}
        </p>
      )}
    </div>
  );
}

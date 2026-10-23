import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { CITIES, cityFlag } from "@/lib/trust";
import { t } from "@/lib/text";
import { addReview, deleteReview, saveTrustSettings, setLowStock, updateReview } from "@/actions/trust-admin";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { PageTitle, Table, Empty } from "@/components/admin/ui";

export const metadata = { title: "Trust" };

type Tab = "reviews" | "stock";
const TABS: [Tab, string][] = [["reviews", "Customer reviews"], ["stock", "Stock is low (license keys)"]];
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

function CitySelect({ name = "city", required = false }: { name?: string; required?: boolean }) {
  return (
    <select name={name} required={required} className="input" defaultValue="">
      <option value="" disabled={required}>{required ? "City…" : "City (optional)"}</option>
      {CITIES.map((c) => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
    </select>
  );
}

export default async function TrustAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("catalog.manage");
  const tab = ((await searchParams).tab as Tab) || "reviews";
  const settings = await getSettings();
  const products = await prisma.product.findMany({
    orderBy: [{ isPublished: "desc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, isPublished: true, fulfillmentType: true },
  });
  const sellable = products;
  const pname = (id: string | null) => t(products.find((p) => p.id === id)?.name, "en") || "—";

  return (
    <>
      <PageTitle title="Trust" sub="Customer reviews and the “stock is low” message. Everything shown to customers comes from real orders and real comments." />
      <nav className="mb-6 flex flex-wrap gap-1 self-start rounded-2xl bg-surface-2 p-1" aria-label="Sections">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/admin/trust?tab=${id}`} aria-current={tab === id ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === id ? "bg-primary text-white" : "text-muted hover:text-text"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "reviews" && <ReviewsTab sellable={sellable} pname={pname} />}
      {tab === "stock" && <StockTab limit={settings.lowStockLimit} />}
    </>
  );
}

type P = { id: string; name: unknown; isPublished: boolean };

async function ReviewsTab({ sellable, pname }: { sellable: P[]; pname: (id: string | null) => string }) {
  const reviews = await prisma.review.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });
  const pending = reviews.filter((r) => r.status === "pending").length;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="space-y-3">
        <h2 className="font-bold">Reviews {pending > 0 && <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">{pending} new</span>}</h2>
        <p className="text-sm text-muted">Customers are asked “How was it?” on their order once it&apos;s delivered. Approve the good ones and tick “Homepage” to show them in the reviews section (hidden until at least one is ticked).</p>
        <Table head={["Rating", "Comment", "Customer", "Product", "Status", ""]} empty={reviews.length === 0} emptyText={<Empty title="No reviews yet" hint="Customers can leave a review after a delivered order. You approve them here before they show." />}>
          {reviews.map((r) => (
            <tr key={r.id} className={r.status === "hidden" ? "opacity-50" : ""}>
              <td className="whitespace-nowrap px-4 py-3 text-[#e0a400]">{"★".repeat(r.rating)}<span className="text-border">{"★".repeat(5 - r.rating)}</span></td>
              <td className="max-w-xs px-4 py-3">{r.quote ? `“${r.quote}”` : <span className="text-muted">(stars only)</span>}</td>
              <td className="px-4 py-3">{r.name}{r.city && <span className="block text-xs text-muted">{cityFlag(r.city)} {r.city}</span>}<span className="block text-xs text-muted">{r.source === "order" ? "After delivery" : "Added by staff"} · {day(r.createdAt)}</span></td>
              <td className="px-4 py-3">{pname(r.productId)}</td>
              <td className="px-4 py-3 text-xs font-bold">{r.onHome ? <span className="text-success">✓ On homepage</span> : r.status === "approved" ? "Approved" : r.status === "hidden" ? "Hidden" : <span className="text-warning">New</span>}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {!r.onHome && r.quote && <ActionButton label="Homepage" action={updateReview.bind(null, r.id, { onHome: true })} />}
                  {r.onHome && <ActionButton label="Off homepage" action={updateReview.bind(null, r.id, { onHome: false })} />}
                  {r.status === "pending" && <ActionButton label="Approve" action={updateReview.bind(null, r.id, { status: "approved" })} />}
                  {r.status !== "hidden" ? (
                    <ActionButton label="Hide" className="btn-ghost min-h-9 px-3 text-xs" action={updateReview.bind(null, r.id, { status: "hidden" })} />
                  ) : (
                    <ActionButton label="Delete" className="btn-ghost min-h-9 px-3 text-xs text-danger" confirm="Delete this review for good?" action={deleteReview.bind(null, r.id)} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <ActionForm action={addReview} resetOnSuccess className="card h-fit space-y-3 p-5">
        <h2 className="font-bold">+ Add a customer comment</h2>
        <p className="text-xs text-muted">A real comment a customer sent you (WhatsApp, Facebook…). Ask them first if you can show it with their first name and city.</p>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <input name="first" required maxLength={24} placeholder="First name" className="input" />
          <input name="last" maxLength={30} placeholder="Last (M.)" className="input" />
        </div>
        <CitySelect />
        <select name="rating" defaultValue="5" className="input">
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
        </select>
        <textarea name="quote" required minLength={5} maxLength={400} rows={4} placeholder="Their comment, word for word" className="input min-h-28 py-3" />
        <select name="productId" className="input" defaultValue="">
          <option value="">Product (optional)</option>
          {sellable.map((p) => <option key={p.id} value={p.id}>{t(p.name, "en")}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="onHome" defaultChecked className="h-4 w-4 accent-[var(--primary)]" /> Show on the homepage</label>
        <button className="btn-primary w-full">Add review</button>
      </ActionForm>
    </div>
  );
}

async function StockTab({ limit }: { limit: number }) {
  const products = await prisma.product.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      fulfillmentType: true,
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, lowStock: true, lowStockUntil: true, _count: { select: { codes: { where: { status: "AVAILABLE" } } } } } },
    },
  });
  const now = Date.now();
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted">
        Customers see “Stock is running low” with no number. <b>Automatic</b> (licenses delivered from stock): shows when {limit} codes or fewer are left, hides when you add codes. <b>On</b>: for services delivered by hand or by a supplier, turn it on when stock is really low; set days so it turns itself off.
      </p>
      <ActionForm action={saveTrustSettings} className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="lowLimit">“Stock is low” when codes left ≤</label>
        <input id="lowLimit" type="number" name="lowLimit" min={1} max={100} defaultValue={limit} className="input w-20" />
        <button className="btn-secondary min-h-10 px-4">Save</button>
      </ActionForm>
      <Table head={["Product · option", "Stock", "Mode", "Customers see"]} empty={products.length === 0}>
        {products.flatMap((p) =>
          p.variants.map((v) => {
            const codes = p.fulfillmentType === "CODE_INVENTORY";
            const left = v._count.codes;
            const showing = v.lowStock === "on" ? !v.lowStockUntil || v.lowStockUntil.getTime() > now : v.lowStock === "auto" && codes && left > 0 && left <= limit;
            return (
              <tr key={v.id}>
                <td className="px-4 py-3"><b>{t(p.name, "en")}</b><span className="block text-xs text-muted">{t(v.name, "en")}</span></td>
                <td className="px-4 py-3 text-muted">{codes ? `${left} codes` : "Delivered by hand"}</td>
                <td className="px-4 py-3">
                  <ActionForm action={setLowStock.bind(null, v.id)} className="flex flex-wrap items-center gap-2">
                    <select name="mode" defaultValue={v.lowStock} className="input h-10 w-auto py-0">
                      <option value="off">Off</option>
                      {codes && <option value="auto">Automatic</option>}
                      <option value="on">On</option>
                    </select>
                    <input name="days" type="number" min={0} max={60} placeholder="days" title="Turn off after this many days (On only; empty = until you turn it off)" className="input h-10 w-20 py-0" />
                    <button className="btn-secondary min-h-10 px-3 text-xs">Save</button>
                  </ActionForm>
                  {v.lowStock === "on" && v.lowStockUntil && <span className="mt-1 block text-xs text-muted">Until {day(v.lowStockUntil)}</span>}
                </td>
                <td className={`px-4 py-3 text-xs font-bold ${showing ? "text-warning" : "text-muted"}`}>{showing ? "⚠ Stock is running low" : "Nothing"}</td>
              </tr>
            );
          }),
        )}
      </Table>
    </section>
  );
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProduct } from "@/actions/admin";
import { LocalizedInputs } from "./LocalizedInputs";
import { GalleryField } from "./ImageField";
import { CardArtEditor } from "./CardArtEditor";
import { CountryRuleField } from "./CountryRuleField";

type P = {
  id: string; slug: string; categoryId: string; accent: string; fulfillmentType: string; isPublished: boolean; isFeatured: boolean; sortOrder: number;
  name: Record<string, string>; description: Record<string, string>; delivery: Record<string, string>;
  seoTitle: Record<string, string>; seoDescription: Record<string, string>; fields: string; tags: string[];
  image: string | null; gallery: string[];
  serviceType: string; identifierLabel: Record<string, string>; identifierFormat: string; allowBulk: boolean;
  countryMode: string; countries: string[]; hideFromGoogle: boolean; offerCheck: boolean; seoPage: boolean; kycLevelKey: string | null;
  cardTitle: Record<string, string>; cardTag: Record<string, string>; cardStyle: string;
};

const LANGS = ["en", "ht", "fr", "es"] as const;

/** Service editor (mockup "Edit service"): details on the left; image, what shows on the site and where it's sold on the right. */
export function ProductForm({ product, categories, kycLevels = [], fieldsSummary = [] }: {
  product?: P; categories: { id: string; name: string }[]; kycLevels?: { key: string; name: string }[];
  /** "IMEI · 15 digits checked · sent as IMEI" lines for the fields panel */
  fieldsSummary?: string[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [type, setType] = useState(product?.serviceType ?? "IMEI");
  const missing = LANGS.filter((l) => !product?.name[l]?.trim() || !product?.description[l]?.trim());
  const category = categories.find((c) => c.id === product?.categoryId)?.name ?? "";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if ((e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "publish") fd.set("isPublished", "on");
        start(async () => {
          const r = await saveProduct(fd);
          if (!r.ok) return setMsg({ ok: false, text: r.error });
          setMsg({ ok: true, text: "Saved" });
          if (!product && r.id) router.push(`/admin/products/${r.id}`);
          else router.refresh();
        });
      }}
    >
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="accent" value={product?.accent ?? "#1F7A4D"} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {msg && <span className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`} role="status">{msg.text}</span>}
        {product && <a href={`/en/products/${product.slug}`} target="_blank" className="btn-secondary min-h-11 px-4">Preview</a>}
        <button className="btn-secondary min-h-11 px-4" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button name="go" value="publish" className="btn-primary min-h-11 px-4" disabled={pending}>Save &amp; publish</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label><span className="label">Category</span>
              <select name="categoryId" defaultValue={product?.categoryId} className="input">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <label><span className="label">Type</span>
              <select name="serviceType" value={type} onChange={(e) => setType(e.target.value)} className="input">
                <option value="IMEI">IMEI</option>
                <option value="SERVER">Server</option>
                <option value="REMOTE">Remote</option>
                <option value="FILE">File</option>
              </select>
            </label>
            <label><span className="label">Delivery</span>
              <select name="fulfillmentType" defaultValue={product?.fulfillmentType ?? "MANUAL"} className="input">
                <option value="SUPPLIER_API">Supplier (automatic)</option>
                <option value="MANUAL">Manual</option>
                <option value="CODE_INVENTORY">Codes from stock</option>
              </select>
            </label>
            <label><span className="label">Address</span><input name="slug" defaultValue={product?.slug} required className="input font-mono text-sm" placeholder="iphone-usa-att-unlock" /></label>
          </div>
          <p className="flex flex-wrap gap-2 text-xs font-semibold">
            Languages:
            {LANGS.map((l) => <span key={l} className={missing.includes(l) ? "text-warning" : "text-primary"}>{l.toUpperCase()} {missing.includes(l) ? "missing" : "✓"}</span>)}
          </p>
          <LocalizedInputs prefix="name" label="Name" value={product?.name} required />
          <LocalizedInputs prefix="description" label="Description" value={product?.description} textarea />
          <LocalizedInputs prefix="delivery" label="Delivery time shown before there is real data (e.g. 1–3 days)" value={product?.delivery} />

          {type === "IMEI" && (
            <fieldset className="grid gap-3 rounded-xl bg-surface-2 p-4 sm:grid-cols-2">
              <legend className="sr-only">Device identifier</legend>
              <p className="text-sm font-semibold sm:col-span-2">Device identifier</p>
              <label><span className="label">Check</span>
                <select name="identifierFormat" defaultValue={product?.identifierFormat ?? "imei"} className="input">
                  <option value="imei">IMEI: 15 digits + check digit</option>
                  <option value="serial">Serial number: 5–30 letters/digits</option>
                  <option value="any">Anything (one per line)</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" name="allowBulk" defaultChecked={product?.allowBulk ?? true} /> Several per order (one per line)</label>
              <div className="sm:col-span-2"><LocalizedInputs prefix="idLabel" label="Box label (empty = “IMEI”)" value={product?.identifierLabel} /></div>
            </fieldset>
          )}

          <section className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">What the customer fills in</h2>
              {product && <Link href={`/admin/products/${product.id}/form`} className="text-sm font-semibold text-primary">+ Add a field · open the form builder</Link>}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {type === "IMEI" && <li><b>{product?.identifierLabel?.en || "IMEI"}</b> · {product?.identifierFormat === "serial" ? "serial checked" : "15 digits checked"} · {product?.allowBulk !== false ? "several per order" : "one per order"}</li>}
              {fieldsSummary.map((f) => <li key={f}>{f}</li>)}
              {!fieldsSummary.length && type !== "IMEI" && <li className="text-muted">No fields yet.</li>}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted">Advanced: fields as JSON</summary>
              <textarea name="fields" rows={6} defaultValue={product?.fields ?? "[]"} className="input mt-2 py-2 font-mono text-xs" />
            </details>
          </section>

          <label className="block">
            <span className="label">Filter tags (comma-separated: brands, carriers, regions)</span>
            <input name="tags" defaultValue={product?.tags.join(", ")} placeholder="Apple, AT&T, USA" className="input" />
          </label>
          <GalleryField name="gallery" label="Extra photos (optional)" value={product?.gallery} folder="products" />
          <details className="rounded-xl bg-surface-2 p-4">
            <summary className="cursor-pointer font-semibold">SEO title and description</summary>
            <div className="mt-3 space-y-3">
              <LocalizedInputs prefix="seoTitle" label="SEO title" value={product?.seoTitle} />
              <LocalizedInputs prefix="seoDescription" label="SEO description" value={product?.seoDescription} />
            </div>
          </details>
        </div>

        <aside className="space-y-5">
          <div className="card p-4">
            <CardArtEditor name={product?.name.en || "New service"} category={category} title={product?.cardTitle ?? {}} tag={product?.cardTag ?? {}} style={product?.cardStyle ?? "ink"} image={product?.image ?? null} />
          </div>
          <div className="card space-y-2 p-4 text-sm">
            <b>Show on site</b>
            <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={product?.isPublished} /> Published</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured} /> Featured on home (deal of the day)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="offerCheck" defaultChecked={product?.offerCheck ?? true} /> Offer IMEI check first</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="seoPage" defaultChecked={product?.seoPage ?? true} /> SEO page by the content machine</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="hideFromGoogle" defaultChecked={product?.hideFromGoogle} /> Hide from Google (signed-in customers only)</label>
            <label className="block pt-1"><span className="mb-1 block text-xs text-muted">Needs KYC</span>
              <select name="kycLevelKey" defaultValue={product?.kycLevelKey ?? ""} className="input">
                <option value="">No (general rules only)</option>
                {kycLevels.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 pt-1">Order <input name="sortOrder" type="number" defaultValue={product?.sortOrder ?? 0} className="input w-24" /></label>
            {product && <Link href="/admin/marketing#deal" className="block pt-1 text-xs font-semibold text-primary">Make it the deal of the week →</Link>}
          </div>
          <div className="card p-4">
            <CountryRuleField mode={product?.countryMode} countries={product?.countries} />
          </div>
        </aside>
      </div>
    </form>
  );
}

"use client";
import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importSupplierServices } from "@/actions/suppliers";
import { importPrice, type PriceRounding } from "@/lib/import-price";

export type ImportRow = {
  id: string;
  remoteId: string;
  name: string;
  group: string;
  type: string;
  time: string | null;
  info: string | null;
  asks: string[];
  cost: number;
  was: number | null;
  isNew: boolean;
  active: boolean;
  onSite: { productId: string; price: number; paused: boolean } | null;
};

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const field = "mt-1 block h-10 rounded-xl border-0 bg-white px-2 text-sm text-[#111418]";

/** Supplier services with checkboxes, details on tap, and the import bar (category, markup, rounding). */
export function ImportTable({ rows, categories }: { rows: ImportRow[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  // Phones: the bar stays one line until "Import…" is tapped, so it never covers the list.
  const [barOpen, setBarOpen] = useState(false);
  const [markup, setMarkup] = useState("35");
  const [minProfit, setMinProfit] = useState("0.50");
  const [round, setRound] = useState<PriceRounding>("99");
  const [categoryId, setCategoryId] = useState("group");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const selectable = rows.filter((r) => r.active && !r.onSite);
  const allOn = selectable.length > 0 && selectable.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const markupBps = Math.round((Number(markup.replace(",", ".")) || 0) * 100);
  const minCents = Math.round((Number(minProfit.replace(/[$,]/g, "")) || 0) * 100);
  const preview = useMemo(() => {
    const prices = rows.filter((r) => picked.has(r.id)).map((r) => importPrice(r.cost, markupBps, minCents, round));
    if (!prices.length) return null;
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    return lo === hi ? usd(lo) : `${usd(lo)} – ${usd(hi)}`;
  }, [rows, picked, markupBps, minCents, round]);

  function run(publish: boolean) {
    const fd = new FormData();
    for (const id of picked) fd.append("ids", id);
    fd.set("categoryId", categoryId);
    fd.set("markup", markup);
    fd.set("minProfit", minProfit.replace(/[$\s]/g, ""));
    fd.set("round", round);
    if (publish) fd.set("publish", "on");
    start(async () => {
      const r = await importSupplierServices(fd);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Imported" } : { ok: false, text: r.error });
      if (r.ok) {
        setPicked(new Set());
        setBarOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <section aria-label="Services" className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5"><input type="checkbox" aria-label="Select all shown" checked={allOn} disabled={!selectable.length} onChange={() => setPicked(allOn ? new Set() : new Set(selectable.map((r) => r.id)))} /></th>
                <th className="px-3 py-2.5">Service (their name)</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Customer must give</th>
                <th className="px-3 py-2.5">Cost</th>
                <th className="px-3 py-2.5">On my site</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = picked.has(r.id);
                const can = r.active && !r.onSite;
                return (
                  <Fragment key={r.id}>
                    <tr className={`border-t border-border ${on ? "bg-primary-soft/60" : ""} ${!r.active ? "opacity-60" : ""}`}>
                      <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${r.name}`} checked={on} disabled={!can} onChange={() => toggle(r.id)} /></td>
                      <td className="px-3 py-2.5">
                        <button type="button" className="text-left font-semibold hover:text-primary" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                          {r.name}
                        </button>
                        {r.isNew && <span className="ml-1.5 rounded-md bg-primary px-1.5 py-px text-[11px] font-semibold text-white">NEW</span>}
                        <span className="block text-xs text-muted">{r.group} · ID {r.remoteId}</span>
                      </td>
                      <td className="px-3 py-2.5">{r.type === "IMEI" ? "IMEI" : r.type[0] + r.type.slice(1).toLowerCase()}</td>
                      <td className="px-3 py-2.5">{r.time || "—"}</td>
                      <td className="px-3 py-2.5">{r.asks.join(" · ") || "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {r.active ? usd(r.cost) : "—"}
                        {r.was != null && r.active && (
                          <span className={`block text-xs font-semibold ${r.cost > r.was ? "text-warning" : "text-success"}`}>{r.cost > r.was ? "↑" : "↓"} was {usd(r.was)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {!r.active ? (
                          <span className="font-semibold text-warning">Removed by supplier{r.onSite ? " · your service is paused" : ""}</span>
                        ) : r.onSite ? (
                          <Link href={`/admin/products/${r.onSite.productId}`} className="font-semibold text-primary">
                            ✓ {usd(r.onSite.price)} · edit
                            {r.onSite.price <= r.cost && <span className="block text-xs text-danger">Selling at a loss</span>}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr className="border-t border-border bg-surface-2">
                        <td />
                        <td colSpan={6} className="px-3 py-3 text-[13px]">
                          <p className="whitespace-pre-wrap">{r.info || "The supplier gave no description."}</p>
                          {r.asks.length > 0 && <p className="mt-2 text-muted">Order form: {r.asks.join(", ")}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-8 text-center text-sm text-muted">Nothing here.</p>}
        </div>
        <p className="border-t border-border px-3.5 py-2.5 text-xs text-muted">Tap a service to see the supplier&apos;s full description and every field it asks for before importing.</p>
      </section>

      {picked.size > 0 && (
        <section aria-label="Import selected" className="sticky bottom-24 z-20 mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-[#111418] p-4 text-white shadow-xl lg:bottom-4">
          <div className="flex-[1_1_160px] self-center">
            <b className="text-base">{picked.size} selected</b>
            {preview && <span className="block text-xs text-[#b9c0b6]">Your price{picked.size > 1 ? "s" : ""}: {preview}</span>}
          </div>
          {!barOpen && <button type="button" onClick={() => setBarOpen(true)} className="min-h-11 rounded-xl bg-[#7ce0a8] px-4 font-semibold text-[#0b2a1a] lg:hidden">Import…</button>}
          <div className={`${barOpen ? "flex" : "hidden"} w-full flex-wrap items-end gap-3 lg:flex lg:w-auto`}>
          <label className="text-xs text-[#b9c0b6]">Put in category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${field} max-w-[14rem]`}>
              <option value="group">Same name as their group</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#b9c0b6]">Markup %<input value={markup} onChange={(e) => setMarkup(e.target.value)} inputMode="decimal" className={`${field} w-20`} /></label>
          <label className="text-xs text-[#b9c0b6]">Min. profit $<input value={minProfit} onChange={(e) => setMinProfit(e.target.value)} inputMode="decimal" className={`${field} w-20`} /></label>
          <label className="text-xs text-[#b9c0b6]">Round prices
            <select value={round} onChange={(e) => setRound(e.target.value as PriceRounding)} className={field}>
              <option value="99">to .99</option>
              <option value="49">to .49 / .99</option>
              <option value="none">No</option>
            </select>
          </label>
          <div className="flex w-full flex-wrap gap-2 xl:w-auto">
          <button type="button" disabled={pending} onClick={() => run(false)} className="min-h-11 rounded-xl border border-[#3a423a] px-3.5 font-semibold">Import as hidden drafts</button>
          <button type="button" disabled={pending} onClick={() => run(true)} className="min-h-11 rounded-xl bg-[#7ce0a8] px-3.5 font-semibold text-[#0b2a1a]">{pending ? "Importing…" : "Import and publish"}</button>
          </div>
          </div>
        </section>
      )}
      {msg && <p role="status" className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
    </>
  );
}

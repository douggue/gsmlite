"use client";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Price } from "../Money";

export type PriceGroupView = {
  id: string;
  name: string;
  rows: { slug: string; name: string; type: "IMEI" | "SERVER" | "REMOTE" | "FILE"; status: "online" | "slow" | "down"; time: string; price: number; haystack: string }[];
};

/** Search + type chips; one collapsible table per group (the first open), live status and real average time. */
export function PriceList({ groups, deal, telegram }: { groups: PriceGroupView[]; deal: { slug: string; name: string; price: number; endsAt: string } | null; telegram: string }) {
  const g = useTranslations("gl.prices");
  const fmt = useFormatter();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "IMEI" | "SERVER" | "REMOTE" | "FILE">("");
  const [open, setOpen] = useState<Set<string>>(new Set(groups[0] ? [groups[0].id] : []));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(
    () => groups.map((gr) => ({ ...gr, rows: gr.rows.filter((r) => (!type || r.type === type) && words.every((w) => r.haystack.includes(w))) })).filter((gr) => gr.rows.length),
    [groups, type, q], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const searching = words.length > 0 || !!type;
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chip = (on: boolean) => `min-h-[46px] rounded-xl px-4 font-semibold ${on ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`;
  const statusCls = { online: "text-[#145c39] dark:text-success", slow: "text-[#8a3607] dark:text-warning", down: "text-danger" };

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="ps" className="sr-only">{g("search")}</label>
        <input id="ps" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={g("searchPlaceholder")}
          className="h-[46px] min-w-0 flex-[1_1_280px] rounded-xl border-[1.5px] border-[#111418] bg-white px-3.5 text-base text-[#111418] dark:border-border dark:bg-surface dark:text-text" />
        <div className="flex gap-2 overflow-x-auto">
          {(["IMEI", "SERVER", "REMOTE", "FILE"] as const).filter((x) => x !== "FILE" || groups.some((gr) => gr.rows.some((r) => r.type === "FILE"))).map((x) => (
            <button key={x} type="button" aria-pressed={type === x} onClick={() => setType(type === x ? "" : x)} className={chip(type === x)}>{g(`type.${x}`)}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 && <p className="rounded-2xl border border-border bg-surface p-8 text-center text-muted">{g("none")}</p>}

      {shown.map((gr) => {
        const isOpen = searching || open.has(gr.id);
        return (
          <section key={gr.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <button type="button" onClick={() => toggle(gr.id)} aria-expanded={isOpen}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left ${isOpen ? "bg-[#111418] text-white" : ""}`}>
              <b>{gr.name}</b>
              <span className={`text-[13px] ${isOpen ? "text-[#b9c0b6]" : "text-muted"}`}>{isOpen ? `${g("collapse")} ▲` : `${g("count", { n: gr.rows.length })} · ${g("expand")} ▼`}</span>
            </button>
            {isOpen && (
              <ul className="divide-y divide-border sm:hidden">
                {gr.rows.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/products/${r.slug}`} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <b className="block text-[15px] text-primary">{r.name}</b>
                        <span className="text-xs"><span className={`font-semibold ${statusCls[r.status]}`}>● {g(`st.${r.status}`)}</span><span className="text-muted"> · {r.time}</span></span>
                      </span>
                      <b className="shrink-0 tabular-nums"><Price usd={r.price} /></b>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {isOpen && (
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.06em] text-muted">
                    <tr><th className="px-4 py-2.5">{g("service")}</th><th className="px-4 py-2.5">{g("status")}</th><th className="px-4 py-2.5">{g("avgTime")}</th><th className="px-4 py-2.5 text-right">{g("price")}</th></tr>
                  </thead>
                  <tbody>
                    {gr.rows.map((r) => (
                      <tr key={r.slug} className="border-t border-border">
                        <td className="px-4 py-3"><Link href={`/products/${r.slug}`} className="font-semibold text-primary">{r.name}</Link></td>
                        <td className={`px-4 py-3 font-semibold ${statusCls[r.status]}`}>● {g(`st.${r.status}`)}</td>
                        <td className="px-4 py-3">{r.time}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums"><Price usd={r.price} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {(deal || telegram) && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111418] p-4 text-white">
          {deal ? (
            <span><b className="text-[#7ce0a8]">{g("dealLabel")}</b> <Link href={`/products/${deal.slug}`} className="underline">{deal.name}</Link> {g("dealAt")} <Price usd={deal.price} /> {g("until", { date: fmt.dateTime(new Date(deal.endsAt), { weekday: "long", day: "numeric", month: "short" }) })}</span>
          ) : <span>{g("telegramText")}</span>}
          {telegram && <a href={telegram} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xl bg-[#7ce0a8] px-4 font-semibold text-[#0b2a1a]">{g("joinTelegram")}</a>}
        </section>
      )}
    </div>
  );
}

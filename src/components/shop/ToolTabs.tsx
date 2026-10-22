"use client";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Price } from "../Money";

type Tool = { slug: string; name: string; options: { id: string; slug: string; title: string; sub: string; price: number }[] };

/** "Top tools": one tab per tool, its licenses (12/6/3 months × new/renewal) as tiles. */
export function ToolTabs({ tools }: { tools: Tool[] }) {
  const [active, setActive] = useState(0);
  const tool = tools[active];
  return (
    <div>
      <div role="tablist" className="flex gap-5 overflow-x-auto border-b border-border px-5 text-[15px]">
        {tools.map((t, i) => (
          <button key={t.slug} role="tab" type="button" aria-selected={i === active} onClick={() => setActive(i)}
            className={`-mb-px min-h-12 whitespace-nowrap border-b-[3px] font-semibold ${i === active ? "border-primary text-text" : "border-transparent text-muted"}`}>
            {t.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="grid gap-3 p-5 sm:grid-cols-3 xl:grid-cols-6">
        {tool?.options.map((o) => (
          <Link key={o.id} href={`/products/${o.slug}`} className="rounded-xl border border-border p-3.5 hover:border-primary">
            <b className="block">{o.title}</b>
            <span className="block text-[13px] text-muted">{o.sub}</span>
            <b className="mt-3 block text-lg tabular-nums"><Price usd={o.price} /></b>
          </Link>
        ))}
      </div>
    </div>
  );
}

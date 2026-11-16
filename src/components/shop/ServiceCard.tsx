import { Link } from "@/i18n/navigation";
import { Price } from "../Money";
import { PlusIcon } from "../Icons";
import type { CardView } from "@/lib/storefront";

const STYLES: Record<string, { box: string; label: string; title: string; tag: string }> = {
  ink: { box: "bg-[#0F1B3D]", label: "text-[#93c5fd]", title: "text-white", tag: "bg-[#93c5fd] text-[#0f1b3d]" },
  green: { box: "bg-[#1d4ed8]", label: "text-[#dbeafe]", title: "text-white", tag: "bg-white text-[#1e40af]" },
  mint: { box: "bg-[#e8f0fe]", label: "text-[#1e40af]", title: "text-[#0F1B3D]", tag: "bg-[#0F1B3D] text-white" },
  slate: { box: "bg-[#262b2f]", label: "text-[#93c5fd]", title: "text-white", tag: "bg-[#93c5fd] text-[#0f1b3d]" },
};

/** Uniform service art (mockup "Deal of the day"): label, big two-line title, ribbon; then the full name, price and "+". */
export function ServiceCard({ card, orderLabel }: { card: CardView; orderLabel: string }) {
  const s = STYLES[card.style] ?? STYLES.ink;
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <Link href={`/products/${card.slug}`} className={`relative flex aspect-[1.1/1] flex-col justify-between p-3.5 ${s.box}`}>
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : null}
        <span className={`relative text-[11px] font-semibold uppercase tracking-[0.1em] ${s.label}`}>{card.category}</span>
        {!card.image && <b className={`display relative line-clamp-3 text-[22px] leading-[1.08] sm:text-[26px] ${s.title}`}>{card.title}</b>}
        {card.tag ? <span className={`relative self-start rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase ${s.tag}`}>{card.tag}</span> : <span />}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link href={`/products/${card.slug}`} dir="auto" className="line-clamp-2 text-[13.5px] leading-snug hover:text-primary">{card.name}</Link>
        <div className="mt-auto flex items-center justify-between gap-2">
          <b className="text-lg tabular-nums"><Price usd={card.price} /></b>
          <Link href={`/products/${card.slug}#order`} aria-label={`${orderLabel}: ${card.name}`} className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary hover:bg-primary hover:text-white">
            <PlusIcon width={18} height={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}

import Image from "next/image";

const STYLES: Record<string, { box: string; label: string; title: string; tag: string }> = {
  ink: { box: "bg-[#111418]", label: "text-[#7ce0a8]", title: "text-white", tag: "bg-[#7ce0a8] text-[#0b2a1a]" },
  green: { box: "bg-[#1f7a4d]", label: "text-[#d3eedd]", title: "text-white", tag: "bg-white text-[#145c39]" },
  mint: { box: "bg-[#e4f3ea]", label: "text-[#145c39]", title: "text-[#111418]", tag: "bg-[#111418] text-white" },
  slate: { box: "bg-[#262b2f]", label: "text-[#7ce0a8]", title: "text-white", tag: "bg-[#7ce0a8] text-[#0b2a1a]" },
};

/** Old products only have an accent color: pick the closest card style. */
function styleFrom(accent?: string | null) {
  const a = (accent ?? "").toLowerCase();
  if (a === "#1f7a4d") return "green";
  if (a === "#e4f3ea") return "mint";
  if (a === "#2b2f35" || a === "#262b2f") return "slate";
  return "ink";
}

/**
 * Service art in the mockup style: small label, big two-line title and a ribbon on a flat ink / green / mint tile.
 * Uploaded product photos are shown instead when there is one.
 */
export function ProductArt({ name, accent, image, size = "md", priority = false, label, title, tag, cardStyle }: {
  name: string; accent?: string | null; image?: string | null; size?: "md" | "lg"; priority?: boolean;
  label?: string; title?: string; tag?: string; cardStyle?: string;
}) {
  const round = size === "lg" ? "rounded-3xl" : "rounded-xl";
  if (image) {
    return (
      <div className={`relative aspect-[4/3] overflow-hidden bg-surface-2 ${round}`}>
        <Image
          src={image}
          alt={name}
          fill
          priority={priority}
          sizes={size === "lg" ? "(min-width: 1024px) 45vw, 100vw" : "(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"}
          className="object-cover"
        />
      </div>
    );
  }
  const s = STYLES[cardStyle ?? ""] ?? STYLES[styleFrom(accent)];
  return (
    <div className={`relative flex aspect-[4/3] flex-col justify-between overflow-hidden p-3 ${round} ${s.box}`} aria-hidden>
      <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${s.label}`}>{label ?? ""}</span>
      <b className={`display line-clamp-3 leading-[1.08] ${s.title} ${size === "lg" ? "text-4xl" : "text-[19px] sm:text-[21px]"}`}>{title || name}</b>
      {tag ? <span className={`self-start rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.tag}`}>{tag}</span> : <span />}
    </div>
  );
}

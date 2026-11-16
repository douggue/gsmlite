/** MonCash / NatCash logos (public/brand), shown wherever customers pick or see a payment method. */
const LOGOS = {
  moncash: { src: "/brand/moncash.webp", alt: "MonCash", ratio: 391 / 96 },
  natcash: { src: "/brand/natcash.webp", alt: "NatCash", ratio: 370 / 96 },
} as const;

export function PayLogo({ brand, height = 24, className = "" }: { brand: keyof typeof LOGOS; height?: number; className?: string }) {
  const l = LOGOS[brand];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={l.src} alt={l.alt} width={Math.round(height * l.ratio)} height={height} className={`w-auto shrink-0 ${className}`} style={{ height }} />;
}

const MARK: Record<string, { src: string; alt: string; ratio: number }[]> = {
  MONCASH: [{ src: "/brand/moncash.webp", alt: "MonCash", ratio: 391 / 96 }],
  NATCASH: [{ src: "/brand/natcash.webp", alt: "NatCash", ratio: 370 / 96 }],
  CARD: [{ src: "/logos/visa.svg", alt: "Visa", ratio: 1 }, { src: "/logos/mastercard.svg", alt: "Mastercard", ratio: 1 }],
  USDT: [{ src: "/logos/tether.svg", alt: "USDT", ratio: 1 }],
};

/** Logos of the payment methods a shopper can use (white chips, so they read on light and dark backgrounds). */
export function PayLogos({ methods, height = 22, className = "" }: { methods: { id: string; name: string; kind: string }[]; height?: number; className?: string }) {
  const seen = new Set<string>();
  const marks = methods.flatMap((m) => {
    const key = m.kind === "card" ? "CARD" : m.kind === "crypto" || /usdt|tether/i.test(m.name) ? "USDT" : m.id;
    if (seen.has(key) || m.kind === "wallet") return [];
    seen.add(key);
    return (MARK[key] ?? []).map((x) => ({ ...x, key }));
  });
  if (!marks.length) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {marks.map((x) => (
        <span key={x.alt} className="inline-flex items-center rounded-lg bg-white px-2 py-1 ring-1 ring-black/5" title={x.alt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={x.src} alt={x.alt} width={Math.round(height * x.ratio)} height={height} style={{ height }} className="w-auto" />
        </span>
      ))}
    </span>
  );
}

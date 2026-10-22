export type PriceRounding = "99" | "49" | "none";

/**
 * Selling price for a supplier cost (all USD cents): cost + markup, never less than cost + minimum profit,
 * then rounded up to end in .99 (or .49/.99). Shared by the import screen preview and the import itself.
 */
export function importPrice(costCents: number, markupBps: number, minProfitCents: number, round: PriceRounding = "none") {
  const raw = Math.max(costCents + minProfitCents, Math.ceil((costCents * (10_000 + markupBps)) / 10_000));
  if (round === "none") return raw;
  const endings = round === "99" ? [99] : [49, 99];
  const dollars = Math.floor(raw / 100);
  for (const d of [dollars, dollars + 1]) for (const e of endings) if (d * 100 + e >= raw) return d * 100 + e;
  return raw;
}

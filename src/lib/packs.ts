/**
 * Sub-cent supplier credits (e.g. $0.004 per credit): prices are whole cents, so such services are sold in packs
 * (1 pack = 10, 100, 1000… credits) big enough to cost at least $1. Services from 10 cents up are sold one by one.
 */
export function packSizeFor(creditMicros: number): number {
  if (creditMicros <= 0 || creditMicros >= 100_000) return 1;
  for (const n of [10, 100, 1_000, 10_000, 100_000]) if (creditMicros * n >= 1_000_000) return n;
  return 100_000;
}

/** Cost of one pack in cents. */
export function packCostCents(creditMicros: number, packSize: number): number {
  return Math.round((creditMicros * packSize) / 10_000);
}

/** Exact micro-dollars from a supplier price ("0.0045", "$1.20"); capped to fit the database column. */
export function toMicros(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[^\d.-]/g, "")) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(2_000_000_000, Math.max(0, Math.round(Number((n * 1_000_000).toPrecision(12)))));
}

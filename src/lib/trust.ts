export { CITIES, cityFlag, isCity } from "./cities";

/** "Jean-Philippe Moïse" → "Jean-Philippe M." — first name and last initial only. */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0].slice(0, 24);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/** Variant ids whose "Stock is low" message should show right now. */
export function lowStockVariants(
  variants: { id: string; lowStock: string; lowStockUntil: Date | null }[],
  stock: Record<string, number> | null,
  limit: number,
): string[] {
  const now = Date.now();
  return variants
    .filter((v) => {
      if (v.lowStock === "on") return !v.lowStockUntil || v.lowStockUntil.getTime() > now;
      if (v.lowStock === "auto" && stock) {
        const left = stock[v.id] ?? 0;
        return left > 0 && left <= limit;
      }
      return false;
    })
    .map((v) => v.id);
}

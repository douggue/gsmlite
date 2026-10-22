/** "5 min ago" / "3 h ago" / "2 days ago" for staff screens. */
export function ago(d: Date | null) {
  if (!d) return "never";
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}

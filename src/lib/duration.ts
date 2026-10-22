/** Minutes → the unit to show: under 2 min "Instant", then minutes, hours, days (rounded). */
export function durationParts(minutes: number): { key: "instant" | "min" | "h" | "d"; n: number } {
  if (minutes < 2) return { key: "instant", n: 0 };
  if (minutes < 90) return { key: "min", n: Math.round(minutes) };
  if (minutes < 48 * 60) return { key: "h", n: Math.round(minutes / 60) };
  return { key: "d", n: Math.round(minutes / 1440) };
}

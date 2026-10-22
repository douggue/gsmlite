/** Admin IP allowlist: exact IPv4/IPv6 addresses or IPv4 ranges written as CIDR (196.3.0.0/16). */

function v4(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function validEntry(entry: string): boolean {
  const [ip, bits] = entry.split("/");
  if (bits !== undefined) return v4(ip) != null && /^\d{1,2}$/.test(bits) && Number(bits) <= 32;
  return v4(ip) != null || /^[0-9a-f:]{2,39}$/i.test(ip);
}

export function ipAllowed(ip: string | null, list: string[]): boolean {
  if (!list.length) return true;
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, "");
  for (const entry of list) {
    const [base, bits] = entry.split("/");
    if (bits === undefined) {
      if (base.toLowerCase() === clean.toLowerCase()) return true;
      continue;
    }
    const a = v4(clean);
    const b = v4(base);
    if (a == null || b == null) continue;
    const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
    if ((a & mask) >>> 0 === (b & mask) >>> 0) return true;
  }
  return false;
}

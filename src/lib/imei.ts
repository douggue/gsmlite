/** Device identifiers: IMEI (15 digits with a Luhn check digit) and serial numbers. */

export type IdentifierFormat = "imei" | "serial" | "any";

/** Luhn check used by the 15th digit of an IMEI. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Strip the spaces, dashes and slashes people paste (e.g. "35 678901 234567 8"). */
export function cleanIdentifier(raw: string, format: IdentifierFormat): string {
  const v = raw.trim();
  if (format === "imei") return v.replace(/[\s\-/.]/g, "");
  if (format === "serial") return v.replace(/\s/g, "").toUpperCase();
  return v;
}

export function isValidIdentifier(value: string, format: IdentifierFormat): boolean {
  if (format === "imei") return /^\d{15}$/.test(value) && luhnValid(value);
  if (format === "serial") return /^[A-Z0-9]{5,30}$/.test(value);
  return value.length >= 1 && value.length <= 100 && !/[\r\n]/.test(value);
}

/**
 * Split a bulk box (one identifier per line, or separated by commas) into cleaned identifiers.
 * Duplicates are dropped so the same phone is never charged twice in one order.
 */
export function parseIdentifiers(text: string, format: IdentifierFormat): { valid: string[]; invalid: string[] } {
  const parts = text.split(format === "any" ? /\r?\n/ : /[\r\n,;]+/).map((p) => cleanIdentifier(p, format)).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (!isValidIdentifier(p, format)) invalid.push(p);
    else if (!valid.includes(p)) valid.push(p);
  }
  return { valid, invalid };
}

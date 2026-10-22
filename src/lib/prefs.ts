import "server-only";
import { cookies, headers } from "next/headers";
import type { Currency } from "@prisma/client";

export const CURRENCY_COOKIE = "gl_currency";

/** Visitor's country from the host's location header (Vercel, or Cloudflare in front of the VPS). */
export async function visitorCountry(): Promise<string | null> {
  const h = await headers();
  return (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "").toUpperCase() || null;
}

/**
 * Display currency: the visitor's own choice (the currency switch and the profile both set this cookie), then gourdes
 * for visitors in Haiti, otherwise USD (service prices are set in USD).
 */
export async function getDisplayCurrency(): Promise<Currency> {
  const c = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (c === "HTG" || c === "USD") return c;
  return (await visitorCountry()) === "HT" ? "HTG" : "USD";
}

/**
 * Country that decides which services and payment methods a shopper sees: the account's country,
 * else the visitor's location, else the store's default country.
 */
export async function shopperCountry(user?: { id: string } | null): Promise<string> {
  if (user) {
    const { prisma } = await import("./db");
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { country: true } });
    if (row?.country) return row.country;
  }
  const visitor = await visitorCountry();
  if (visitor && visitor !== "XX" && visitor !== "T1") return visitor;
  const { getDisplaySettings } = await import("./settings");
  return (await getDisplaySettings()).defaultCountry || "HT";
}

import "server-only";
import { prisma } from "./db";
import { t } from "./text";
import { allowedIn, countryWhere } from "./countries";
import { getDisplaySettings, type Settings } from "./settings";
import { moncashAvailable } from "./payments/moncash";
import { cardAvailable } from "./payments/card";

/** One way to pay that this shopper may use. Methods they can't use are never returned, so they are never shown or named. */
export type PayMethod = {
  /** WALLET, MONCASH, NATCASH, CARD or MANUAL:<id> */
  id: string;
  name: string;
  /** Short line under the name: "Instant · HTG", "Visa, Mastercard · USD"… (message key + values, filled by the page) */
  hint: "instantHtg" | "checkedHtg" | "cardUsd" | "cryptoUsd" | "manualHtg" | "manualUsd" | "wallet";
  currency: "HTG" | "USD";
  logo: string | null;
  kind: "wallet" | "api" | "manual" | "crypto" | "card";
};

export function builtinAllowed(settings: Pick<Settings, "payCountries">, key: "moncash" | "natcash" | "card", country: string | null) {
  return allowedIn(settings.payCountries?.[key] ?? { countryMode: "all", countries: [] }, country);
}

/** Payment methods for this shopper's country, for orders or for wallet top-ups, in display order. */
export async function payMethodsFor(country: string | null, use: "orders" | "deposits", locale: string): Promise<PayMethod[]> {
  const settings = await getDisplaySettings();
  const out: PayMethod[] = [];
  if (moncashAvailable(settings.moncashEnabled) && builtinAllowed(settings, "moncash", country)) {
    out.push({ id: "MONCASH", name: "MonCash", hint: "instantHtg", currency: "HTG", logo: null, kind: "api" });
  }
  if (settings.natcashEnabled && builtinAllowed(settings, "natcash", country)) {
    out.push({ id: "NATCASH", name: "NatCash", hint: "checkedHtg", currency: "HTG", logo: null, kind: "manual" });
  }
  if (cardAvailable(settings.cardEnabled) && builtinAllowed(settings, "card", country)) {
    out.push({ id: "CARD", name: "Card", hint: "cardUsd", currency: "USD", logo: null, kind: "card" });
  }
  const manual = await prisma.manualMethod.findMany({
    where: { isEnabled: true, ...(use === "orders" ? { allowOrders: true } : { allowDeposits: true }), ...countryWhere(country) },
    orderBy: { sortOrder: "asc" },
  });
  for (const m of manual) {
    const crypto = m.kind === "crypto";
    out.push({
      id: `MANUAL:${m.id}`,
      name: t(m.name, locale) || m.code,
      hint: crypto ? "cryptoUsd" : m.currency === "USD" ? "manualUsd" : "manualHtg",
      currency: m.currency,
      logo: m.logo,
      kind: crypto ? "crypto" : "manual",
    });
  }
  return out;
}

/** "MonCash, NatCash and USDT" in the reader's language: fills {payment_methods} in any text that lists ways to pay. */
export function listNames(methods: PayMethod[], locale: string) {
  const names = [...new Set(methods.filter((m) => m.kind !== "wallet").map((m) => (m.kind === "card" ? "Visa/Mastercard" : m.name)))];
  try {
    return new Intl.ListFormat(locale === "ht" ? "fr" : locale, { type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** Server check at order/top-up time: the chosen method must be one this shopper may use. */
export async function methodAllowed(id: string, country: string | null, use: "orders" | "deposits", locale = "en") {
  if (id === "WALLET") return true;
  return (await payMethodsFor(country, use, locale)).some((m) => m.id === id);
}

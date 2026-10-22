import { defineRouting } from "next-intl/routing";

export const locales = ["ht", "fr", "en", "es", "pt", "ar"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ht",
  localePrefix: "always",
});

export const localeNames: Record<Locale, string> = {
  ht: "Kreyòl",
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português",
  ar: "العربية",
};

/** Right-to-left languages (the page gets dir="rtl"). */
export const rtlLocales: readonly string[] = ["ar"];

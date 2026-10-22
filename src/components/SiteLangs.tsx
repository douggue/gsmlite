"use client";
import { createContext, useContext } from "react";
import { locales, type Locale } from "@/i18n/routing";

const Ctx = createContext<readonly Locale[]>(locales);

/** Languages switched on in Settings → Site (all of them until staff turn some off). */
export function SiteLangs({ value, children }: { value: string[]; children: React.ReactNode }) {
  const on = locales.filter((l) => value.includes(l));
  return <Ctx.Provider value={on.length ? on : locales}>{children}</Ctx.Provider>;
}

export const useSiteLocales = () => useContext(Ctx);

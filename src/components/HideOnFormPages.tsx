"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The floating help button would cover totals, prices and fields: on phones it hides on service, cart, checkout and
 * IMEI-check pages, and everywhere in the account (which has its own Support link). Help stays in the menu.
 */
export function HideOnFormPages({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const formPage = /\/(products\/[^/]+|cart|checkout|check)(\/|$)/.test(path);
  const account = /\/account(\/|$)/.test(path);
  return <div className={account ? "hidden" : formPage ? "max-md:hidden" : undefined}>{children}</div>;
}

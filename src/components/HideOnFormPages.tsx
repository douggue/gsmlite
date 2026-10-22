"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Phones: the floating help button would cover order totals and buttons on service, cart and checkout pages, so it hides there (help stays in the menu). */
export function HideOnFormPages({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const formPage = /\/(products\/[^/]+|cart|checkout)(\/|$)/.test(path);
  return <div className={formPage ? "max-md:hidden" : undefined}>{children}</div>;
}

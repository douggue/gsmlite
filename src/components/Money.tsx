"use client";
import { useLocale } from "next-intl";
import { formatMoney, priceIn } from "@/lib/money";
import { useStore } from "./cart/CartProvider";

/** Shows a USD-based price (cents) in the visitor's display currency. */
export function Price({ usd, className }: { usd: number; className?: string }) {
  const { currency, htgPerUsd } = useStore();
  const locale = useLocale();
  const value = priceIn(usd, currency, htgPerUsd);
  return <span className={className}>{formatMoney(value, currency, locale)}</span>;
}

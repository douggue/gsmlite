"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSavedCart, saveCart } from "@/actions/customer";
import { priceIn } from "@/lib/money";

export type CartLine = {
  key: string;
  variantId: string;
  productSlug: string;
  productName: Record<string, string>;
  variantName: Record<string, string>;
  accent?: string | null;
  image?: string | null;
  priceHtg: number;
  quantity: number;
  fields: Record<string, string>;
  /** "Customer enters the amount" products: USD cents typed, and the price in USD (not converted at the store rate) */
  amount?: number;
  priceUsd?: number;
};

/** Unit price of a cart line in the display currency. */
export function linePrice(l: Pick<CartLine, "priceHtg" | "priceUsd">, currency: "HTG" | "USD", htgPerUsd: number) {
  return currency === "USD" && l.priceUsd != null ? l.priceUsd : priceIn(l.priceHtg, currency, htgPerUsd);
}

type StoreCtx = {
  currency: "HTG" | "USD";
  htgPerUsd: number;
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const Ctx = createContext<StoreCtx | null>(null);
const STORAGE_KEY = "hg_cart_v1";

function lineKey(variantId: string, fields: Record<string, string>, amount?: number) {
  return `${variantId}:${amount ? `$${amount}:` : ""}${Object.entries(fields).sort().map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export function CartProvider({ children, currency, htgPerUsd, signedIn = false }: { children: ReactNode; currency: "HTG" | "USD"; htgPerUsd: number; signedIn?: boolean }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  const synced = useRef(false);

  useEffect(() => {
    let local: CartLine[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) local = JSON.parse(raw);
    } catch {
      // storage unavailable (private mode) — cart works for this page view only
    }
    setLines(local);
    setReady(true);
    // Signed in: merge the cart saved on the account (other devices) with this device's cart.
    if (signedIn) {
      getSavedCart().then((remote) => {
        const merged = [...local];
        for (const r of remote as CartLine[]) if (!merged.some((l) => l.key === r.key)) merged.push(r);
        setLines(merged.slice(-20));
        synced.current = true;
      });
    }
  }, [signedIn]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
    if (!signedIn || !synced.current) return;
    const id = setTimeout(() => saveCart(lines), 800);
    return () => clearTimeout(id);
  }, [lines, ready, signedIn]);

  const add = useCallback((line: Omit<CartLine, "key">) => {
    const key = lineKey(line.variantId, line.fields, line.amount);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(10, l.quantity + line.quantity) } : l));
      return [...prev, { ...line, key }].slice(-20);
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(10, quantity)) } : l)));
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({ currency, htgPerUsd, lines, count: lines.reduce((s, l) => s + l.quantity, 0), ready, add, setQuantity, remove, clear }),
    [currency, htgPerUsd, lines, ready, add, setQuantity, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside CartProvider");
  return ctx;
}

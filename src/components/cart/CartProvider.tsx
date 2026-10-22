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
  /** Unit price in USD cents as shown when added (the server recomputes it at checkout) */
  priceUsd: number;
  /** IMEI services: one unit per identifier. Server credits: units ordered. */
  quantity: number;
  fields: Record<string, string>;
  /** IMEI services: the IMEIs / serial numbers, one order line each */
  identifiers?: string[];
  /** SERVER services: allowed quantity range, so the cart's +/- respects it */
  minQty?: number;
  maxQty?: number;
};

/** Unit price of a cart line in the display currency. */
export function linePrice(l: Pick<CartLine, "priceUsd">, currency: "HTG" | "USD", htgPerUsd: number) {
  return priceIn(l.priceUsd, currency, htgPerUsd);
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

function clampQty(l: Pick<CartLine, "minQty" | "maxQty">, q: number) {
  return Math.max(l.minQty ?? 1, Math.min(l.maxQty ?? 10, q));
}
const STORAGE_KEY = "gl_cart_v1";

function lineKey(variantId: string, fields: Record<string, string>, identifiers?: string[]) {
  return `${variantId}:${(identifiers ?? []).join(",")}:${Object.entries(fields).sort().map(([k, v]) => `${k}=${v}`).join("&")}`;
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
    const key = lineKey(line.variantId, line.fields, line.identifiers);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      // The same IMEIs for the same service are never added twice.
      if (existing && line.identifiers?.length) return prev;
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: clampQty(l, l.quantity + line.quantity) } : l));
      return [...prev, { ...line, key }].slice(-20);
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.key === key && !l.identifiers?.length ? { ...l, quantity: clampQty(l, quantity) } : l)));
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

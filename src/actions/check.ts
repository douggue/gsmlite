"use server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/session";
import { runFreeCheck } from "@/lib/free-check";
import { rateLimit } from "@/lib/rate-limit";
import { unlockOfferFor } from "@/lib/check-offers";

export type CheckResponse =
  | { ok: true; valid: boolean; brand: string | null; model: string | null; left: number; unlock: { href: string; from: number } | null }
  | { ok: false; error: "signin" | "limit" | "busy" };

/** Free IMEI check for a signed-in customer (daily limit per account and per browser). */
export async function freeCheck(imei: string): Promise<CheckResponse> {
  const user = await getUser();
  if (!user) return { ok: false, error: "signin" };
  if (!(await rateLimit(`freecheck:${user.id}`, 10, 60))) return { ok: false, error: "busy" };
  const device = (await cookies()).get("gl_dev")?.value ?? null;
  const r = await runFreeCheck(user.id, device, String(imei).slice(0, 40));
  if (!r.ok) return r;
  if (!r.valid) return { ok: true, valid: false, brand: null, model: null, left: r.left, unlock: null };
  return { ok: true, valid: true, brand: r.brand, model: r.model, left: r.left, unlock: await unlockOfferFor(r.brand, user) };
}

import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./auth";
import { can, isStaff, type Permission } from "./permissions";
import { prisma } from "./db";

/** One session lookup per request, however many components ask. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  locale: string;
  displayCurrency: "HTG" | "USD";
  twoFactorEnabled?: boolean | null;
  emailVerified: boolean;
  /** Only for CUSTOM staff roles */
  permissions?: string[];
};

async function withPermissions(user: SessionUser): Promise<SessionUser> {
  if (user.role !== "CUSTOM") return user;
  const row = await prisma.user.findUnique({ where: { id: user.id }, include: { customRole: true } });
  return { ...user, permissions: row?.customRole?.permissions ?? [] };
}

export async function getUser(): Promise<SessionUser | null> {
  const s = await getSession();
  return (s?.user as unknown as SessionUser) ?? null;
}

/** Customer pages: redirect to login when signed out. */
export async function requireUser(locale: string, next?: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/${locale}/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (user.status === "SUSPENDED" || user.status === "CLOSED") redirect(`/${locale}/auth/login?blocked=1`);
  return user;
}

export class AuthError extends Error {}

/** Server actions: throw when the caller is not signed in. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new AuthError("Not signed in");
  if (user.status === "SUSPENDED" || user.status === "CLOSED") throw new AuthError("Account is not active");
  return user;
}

/** Address of the current request (first hop of x-forwarded-for, set by Caddy / Vercel). */
export async function requestIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Admin IP allowlist (Admin → Security). ADMIN_IP_ALLOWLIST_OFF=1 in the hosting env switches it off if you lock yourself out. */
async function staffIpOk(): Promise<boolean> {
  if (process.env.ADMIN_IP_ALLOWLIST_OFF === "1") return true;
  const { getSettings } = await import("./settings");
  const { ipAllowed } = await import("./ip-allow");
  const { adminIpAllowlist } = await getSettings();
  return ipAllowed(await requestIp(), adminIpAllowlist);
}

/** Admin pages: staff with 2FA enabled and the given permission. */
export async function requireStaff(permission: Permission = "dashboard.view"): Promise<SessionUser> {
  const base = await getUser();
  if (!base || !isStaff(base.role)) redirect("/admin/login");
  if (!(await staffIpOk())) redirect("/admin/login?ip=1");
  if (!base.twoFactorEnabled) redirect("/admin/setup-2fa");
  const user = await withPermissions(base);
  if (!can(user, permission)) redirect("/admin?denied=1");
  return user;
}

/** Admin server actions: throw instead of redirecting. */
export async function assertStaff(permission: Permission): Promise<SessionUser> {
  const base = await getUser();
  if (!base || !isStaff(base.role) || !base.twoFactorEnabled) throw new AuthError("Staff sign-in with 2FA required");
  if (!(await staffIpOk())) throw new AuthError("This address is not on the admin allowlist");
  const user = await withPermissions(base);
  if (!can(user, permission)) throw new AuthError(`Missing permission: ${permission}`);
  return user;
}

/** Require a fresh 2FA confirmation (last 10 minutes) for high-risk actions. */
export async function assertStepUp(): Promise<void> {
  const s = await getSession();
  if (!s) throw new AuthError("Not signed in");
  const row = await prisma.stepUp.findUnique({ where: { sessionToken: s.session.token } });
  if (!row || row.until < new Date() || row.userId !== s.user.id) throw new AuthError("STEP_UP_REQUIRED");
}

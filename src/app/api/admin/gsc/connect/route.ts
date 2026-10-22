import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertStaff } from "@/lib/session";
import { randomToken } from "@/lib/crypto";
import { siteUrl } from "@/lib/site-url";
import { GSC_SCOPE } from "@/lib/content/gsc";

/** Start the Google sign-in that lets the content machine read Search Console (read-only). */
export async function GET() {
  try {
    await assertStaff("settings.manage");
  } catch {
    return NextResponse.redirect(new URL("/admin/login", siteUrl()));
  }
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.redirect(new URL("/admin/content?gsc=nokeys", siteUrl()));
  const state = randomToken(16);
  (await cookies()).set("gl_gsc_state", state, { httpOnly: true, sameSite: "lax", secure: siteUrl().startsWith("https"), maxAge: 600, path: "/api/admin/gsc" });
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${siteUrl()}/api/admin/gsc/callback`,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  return NextResponse.redirect(u);
}

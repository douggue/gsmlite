import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { assertStaff } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { siteUrl } from "@/lib/site-url";
import { getSettings, setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { listSites } from "@/lib/content/gsc";

/** Google sends the owner back here: keep the refresh token (encrypted) and pick the site's property. */
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/content?gsc=${q}`, siteUrl()));
  let staff;
  try {
    staff = await assertStaff("settings.manage");
  } catch {
    return NextResponse.redirect(new URL("/admin/login", siteUrl()));
  }
  const jar = await cookies();
  const state = jar.get("gl_gsc_state")?.value;
  jar.delete("gl_gsc_state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !state || state !== req.nextUrl.searchParams.get("state")) return back("failed");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: `${siteUrl()}/api/admin/gsc/callback`, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { refresh_token?: string } | null;
  if (!json?.refresh_token) return back("failed");
  const s = await getSettings();
  await setSetting("gsc", { ...s.gsc, refreshToken: encrypt(json.refresh_token), connectedAt: new Date().toISOString() });
  if (!s.gsc.site) {
    const sites = await listSites();
    const host = new URL(siteUrl()).hostname.replace(/^www\./, "");
    const pick = sites.find((x) => x === `sc-domain:${host}`) ?? sites.find((x) => x.includes(host)) ?? "";
    if (pick) await setSetting("gsc", { ...(await getSettings()).gsc, site: pick });
  }
  await audit(staff.id, "settings.gsc.connect", "Settings", null, {});
  return back("connected");
}

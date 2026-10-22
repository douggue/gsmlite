import "server-only";
import { decrypt } from "../crypto";
import { getSettings } from "../settings";

/**
 * Google Search Console (read-only): clicks, impressions and positions for the site. Connected in Admin → Content
 * machine with the same Google OAuth client as "Continue with Google" (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET);
 * add <site>/api/admin/gsc/callback as an authorized redirect URI in Google Cloud.
 */
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export async function gscConnected() {
  const s = await getSettings();
  return !!(s.gsc.refreshToken && s.gsc.site && process.env.GOOGLE_CLIENT_ID);
}

async function accessToken(): Promise<string | null> {
  const s = await getSettings();
  if (!s.gsc.refreshToken || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: decrypt(s.gsc.refreshToken), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null;
  return json?.access_token ?? null;
}

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

/** Search analytics for the last `days` days (Search Console data lags ~2 days). */
export async function searchAnalytics(dimensions: ("query" | "page")[], days = 28, rowLimit = 1000): Promise<GscRow[] | null> {
  const s = await getSettings();
  const token = await accessToken();
  if (!token || !s.gsc.site) return null;
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - days * 86_400_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(s.gsc.site)}/searchAnalytics/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ startDate: day(start), endDate: day(end), dimensions, rowLimit }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}

/** Sites this Google account can read (to pick the property after connecting). */
export async function listSites(): Promise<string[]> {
  const token = await accessToken();
  if (!token) return [];
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => null)) as { siteEntry?: { siteUrl: string }[] } | null;
  return (json?.siteEntry ?? []).map((e) => e.siteUrl);
}

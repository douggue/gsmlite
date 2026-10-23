/**
 * The shop's own domain (e.g. https://gsmlite.com), taken from NEXT_PUBLIC_SITE_URL once it is set to a real domain.
 * null while the site only has its .vercel.app address: then nothing redirects anywhere.
 */
export function canonicalSite(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return explicit && /^https?:\/\//.test(explicit) && !explicit.includes(".vercel.app") ? explicit : null;
}

/**
 * Public address of the site, without a trailing slash. Used for links in emails, SEO and payment returns.
 * - your own domain (NEXT_PUBLIC_SITE_URL) when set;
 * - otherwise the Vercel address (production address on the live site), then localhost for development.
 */
export function siteUrl(): string {
  const own = canonicalSite();
  if (own) return own;
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Same link, on the site's public address (once a domain is set, emails never point to the .vercel.app address). */
export function onSiteDomain(url: string): string {
  try {
    const u = new URL(url);
    const site = new URL(siteUrl());
    u.protocol = site.protocol;
    u.host = site.host;
    for (const key of ["callbackURL", "redirectTo"]) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//.test(v)) {
        const inner = new URL(v);
        inner.protocol = site.protocol;
        inner.host = site.host;
        u.searchParams.set(key, inner.toString());
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

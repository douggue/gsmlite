import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const dev = process.env.NODE_ENV !== "production";
// Scripts: our own plus Next's inline bootstrap and the theme script ('unsafe-inline'), and Cloudflare Turnstile.
// Images: our own, uploads (Vercel Blob or S3 public bucket via IMAGE_HOST), data/blob previews.
const imageHost = process.env.IMAGE_HOST ? ` ${process.env.IMAGE_HOST}` : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.googleusercontent.com${imageHost}`,
  "font-src 'self' data:",
  `connect-src 'self' https://challenges.cloudflare.com${dev ? " ws:" : ""}`,
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://checkout.stripe.com https://moncashbutton.digicelgroup.com https://sandbox.moncashbutton.digicelgroup.com",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Images (5 MB) and payment screenshots (3 MB) are sent through server actions; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);

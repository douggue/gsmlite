import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalSite, onSiteDomain, siteUrl } from "@/lib/site-url";

afterEach(() => vi.unstubAllEnvs());

describe("site address", () => {
  it("without an own domain, the live site keeps its .vercel.app address (no redirect to a domain not bought yet)", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "gsmlite.vercel.app");
    expect(canonicalSite()).toBeNull();
    expect(siteUrl()).toBe("https://gsmlite.vercel.app");
  });
  it("a vercel.app address in NEXT_PUBLIC_SITE_URL is not treated as an own domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gsmlite.vercel.app");
    expect(canonicalSite()).toBeNull();
    expect(siteUrl()).toBe("https://gsmlite.vercel.app");
  });
  it("an own domain wins", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com/");
    expect(canonicalSite()).toBe("https://shop.example.com");
    expect(siteUrl()).toBe("https://shop.example.com");
  });
  it("email links are moved to the own domain, callback included", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gsmlite.com");
    const link = onSiteDomain("https://gsmlite.vercel.app/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fgsmlite.vercel.app%2Fht%2Fcheckout");
    expect(link).toBe("https://gsmlite.com/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fgsmlite.com%2Fht%2Fcheckout");
    expect(onSiteDomain("https://gsmlite.vercel.app/api/auth/verify-email?token=abc&callbackURL=%2Fht%2Fcheckout")).toBe(
      "https://gsmlite.com/api/auth/verify-email?token=abc&callbackURL=%2Fht%2Fcheckout",
    );
  });
});

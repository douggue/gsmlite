import { afterEach, describe, expect, it, vi } from "vitest";
import { onSiteDomain, siteUrl } from "@/lib/site-url";

afterEach(() => vi.unstubAllEnvs());

describe("site address", () => {
  it("live site always uses gsmlite.com, even if the env points to vercel.app", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gsmlite.vercel.app");
    expect(siteUrl()).toBe("https://gsmlite.com");
  });
  it("an explicit own domain wins", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com/");
    expect(siteUrl()).toBe("https://shop.example.com");
  });
  it("email links are moved to the site's domain, callback included", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const link = onSiteDomain("https://gsmlite.vercel.app/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fgsmlite.vercel.app%2Fht%2Fcheckout");
    expect(link).toBe("https://gsmlite.com/api/auth/verify-email?token=abc&callbackURL=https%3A%2F%2Fgsmlite.com%2Fht%2Fcheckout");
    expect(onSiteDomain("https://gsmlite.vercel.app/api/auth/verify-email?token=abc&callbackURL=%2Fht%2Fcheckout")).toBe(
      "https://gsmlite.com/api/auth/verify-email?token=abc&callbackURL=%2Fht%2Fcheckout",
    );
  });
});

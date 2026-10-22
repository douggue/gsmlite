import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

// Built on each request (the icon can change in Settings), never at build time when there is no database.
export const dynamic = "force-dynamic";

/** Install manifest. Icons come from Settings → Brand (built-in until an icon is uploaded). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const v = s.appIconVersion ? `?v=${s.appIconVersion}` : "";
  const icon = (size: string) => `/app-icon/${size}${v}`;
  const shortcut = (name: string, short_name: string, url: string) => ({ name, short_name, url, icons: [{ src: icon("192"), sizes: "192x192" }] });
  return {
    id: "/",
    name: s.businessName || "GSMLite",
    short_name: "GSMLite",
    description: "Phone unlocking, IMEI checks and repair tool credits. Refunded automatically if it can't be done.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0B0E10",
    theme_color: "#111418",
    lang: "ht",
    dir: "ltr",
    categories: ["shopping", "utilities", "business"],
    icons: [
      { src: icon("192"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon("512"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon("maskable-512"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      shortcut("Sèvis / Services", "Sèvis", "/store?source=app"),
      shortcut("Pòtfèy / Wallet", "Pòtfèy", "/account/wallet?source=app"),
      shortcut("Kòmand / Orders", "Kòmand", "/account/orders?source=app"),
    ],
  };
}

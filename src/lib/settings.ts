import { locales } from "@/i18n/routing";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "./db";

export type Settings = {
  /** "Stock is low" shows when a code product has this many codes left or fewer (mode "auto") */
  lowStockLimit: number;
  /** HTG per 1 USD (mid rate) */
  htgPerUsd: number;
  /** Exchange spread applied against the customer, in basis points */
  exchangeSpreadBps: number;
  /** Flat exchange fee in basis points of the source amount */
  exchangeFeeBps: number;
  exchangeQuoteSeconds: number;
  minDepositHtg: number;
  maxDepositHtg: number;
  /** Manual deposits at or above this amount are held before becoming spendable */
  holdThresholdHtg: number;
  holdHours: number;
  /** Accounts younger than this many days get lower limits */
  newAccountDays: number;
  newAccountDailyLimitHtg: number;
  /** Orders at or above this total go to manual review before codes are released */
  reviewOrderThresholdHtg: number;
  natcashRecipientName: string;
  natcashRecipientPhone: string;
  natcashInstructions: Record<string, string>;
  /** Optional NatCash QR image customers scan on the deposit page */
  natcashQrUrl: string;
  moncashEnabled: boolean;
  natcashEnabled: boolean;
  whatsappNumber: string;
  supportHours: string;
  businessAddress: string;
  businessName: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTiktok: string;
  announcement: { enabled: boolean; text: Record<string, string>; link: string; startsAt?: string; endsAt?: string };
  /** Header and footer links (Admin → Navigation). Empty = built-in links. */
  navigation: { header: NavLink[]; footer: NavLink[] };
  newsletterEnabled: boolean;
  /** Customers must confirm their email before ordering, depositing or exchanging (only while email sending is on) */
  requireEmailVerification: boolean;
  /** New accounts on a browser already used by this many other accounts are flagged for review */
  maxAccountsPerDevice: number;
  /** Brand images (URLs). Empty = built-in logo / default artwork. */
  logoUrl: string;
  logoDarkUrl: string;
  /** Wallet adjustments at or above this HTG-equivalent amount need a second staff approval */
  approvalThresholdHtg: number;
  /** Paid orders not delivered after this many hours are refunded to the wallet automatically (0 = off) */
  autoRefundHours: number;
  referralEnabled: boolean;
  referralRewardHtg: number;
  referralMinOrderHtg: number;
  /** Reward for the invited friend too (HTG centimes, 0 = only the person who invited is rewarded) */
  referralFriendRewardHtg: number;
  heroImageUrl: string;
  ogImageUrl: string;
  homepage: unknown;
  homepageDraft: unknown;
  homepageHistory: { at: string; by: string; config: unknown }[];
  theme: ThemeConfig;
  themeHistory: { at: string; by: string; theme: ThemeConfig }[];
  /** Country used when the visitor's location is unknown (no Cloudflare/Vercel header) and the account has none */
  defaultCountry: string;
  /** Who sees the built-in payment methods (same rule as services: all / only / except + ISO codes) */
  payCountries: Record<"moncash" | "natcash" | "card", { countryMode: string; countries: string[] }>;
  /** Card payments (Stripe Checkout). Also needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the hosting env. */
  cardEnabled: boolean;
  /** Public Telegram channel or chat link shown to customers (e.g. https://t.me/gsmlite) */
  telegramUrl: string;
  /** Free IMEI checks per day for one account (and one device) */
  freeChecksPerDay: number;
  /** Optional supplier service (option id) asked for the model when a TAC is not known yet; empty = local list only */
  freeCheckVariantId: string;
  /** Days after a full IMEI check during which its price comes off an unlock of the same IMEI (0 = off) */
  checkCreditDays: number;
  /** KYC documents are deleted this many months after the account is closed */
  kycRetentionMonths: number;
  /** Telegram: public channel (@name or -100…) for announcements, and the staff chat id for alerts */
  telegramChannel: string;
  telegramStaffChat: string;
  /** Welcome credit in USD cents, paid once with the first top-up (0 = off) */
  welcomeCreditUsd: number;
  /** Automatic messages (Admin → Marketing) */
  autoMessages: { inactiveOn: boolean; inactiveDays: number; afterUnlockOn: boolean; backOnlineTelegram: boolean; toolUpdateTelegram: boolean; dealTelegram: boolean };
  /** Wallet top-up bonus: % on the first top-up, % on top-ups of at least minUsd (cents); 0 = off */
  topupBonus: { firstPct: number; pct: number; minUsd: number };
  /** Defaults on the supplier import screen */
  supplierDefaults: { markupPct: number; minProfitUsd: number; round: "99" | "49" | "none" };
  /** Success rate: shown once a service has this many finished orders in 90 days; alert / auto-pause under these % (0 = off) */
  successRate: { minOrders: number; alertBelowPct: number; pauseBelowPct: number };
  /** Last low-success alert / automatic pause per product (ISO dates), so staff are told once a day */
  successWatch: Record<string, { alertedAt?: string; pausedAt?: string }>;
  /** Square app icon (PNG, at least 512×512): favicon, home-screen icon and install icon are made from it. Empty = built-in. */
  appIconUrl: string;
  /** Changes with every new icon so phones and browsers fetch it again */
  appIconVersion: number;
  /** Maintenance mode: customers see a message; staff still use the admin and can preview the site. */
  maintenance: { on: boolean; message: Record<string, string>; until?: string };
  /** Legal details shown in the footer, terms and receipts */
  legal: { entity: string; registration: string; taxId: string; email: string; refundDays: number };
  /** Languages offered to customers (the rest are hidden from the switcher) */
  languages: string[];
  /** Admin only from these addresses (IPs or IPv4 CIDR). Empty = from anywhere (2FA still required). */
  adminIpAllowlist: string[];
  /** Content machine (Admin → Content machine). The AI key and DataForSEO login live in the hosting env only. */
  contentMachine: {
    onNewService: boolean;
    hubs: boolean;
    toolPosts: boolean;
    guides: boolean;
    refresh: boolean;
    perDay: number;
    languages: string[];
    budgetUsd: number;
    model: string;
    tone: string;
  };
  /** Google Search Console: the property (e.g. sc-domain:gsmlite.com) and the encrypted refresh token */
  gsc: { site: string; refreshToken: string; connectedAt?: string };
};

export type NavLink = { label: Record<string, string>; href: string };

export type MotionStyle = "calm" | "lively" | "neon";

export type ThemeConfig = {
  /** Accent in light mode (buttons, links) */
  primary: string;
  /** Accent in dark mode */
  primaryDark: string;
  /** Dark mode cards and panels */
  navy: string;
  /** Dark mode page background and the hero */
  midnight: string;
  /** Light mode page background */
  lightBg: string;
  radius: number;
  /** Master switch; visitors who ask for reduced motion never get animations */
  animations: boolean;
  /** What visitors see before they pick light or dark themselves */
  defaultMode: "dark" | "light";
  motion: MotionStyle;
  /** Strength of the blue glow behind the hero, cards and buttons (0 = off, 100 = strong) */
  glow: number;
  /** "gaming" = the display face (Bricolage Grotesque) for headings, "plain" = the body face everywhere (value name kept for saved themes) */
  displayFont: "gaming" | "plain";
  heroGrid: boolean;
  /** Words in the scrolling band under the hero, per language, separated by commas. Empty = no band. */
  marquee: Record<string, string>;
};

export const DEFAULT_THEME: ThemeConfig = {
  primary: "#1F7A4D",
  primaryDark: "#1F7A4D",
  navy: "#15191C",
  midnight: "#0B0E10",
  lightBg: "#F4F5F2",
  radius: 16,
  animations: true,
  defaultMode: "light",
  motion: "calm",
  glow: 20,
  displayFont: "gaming",
  heroGrid: false,
  marquee: {
    ht: "Debloke operatè, Tchèk IMEI, Kredi zouti, FRP, Firmware, Ranbousman otomatik",
    fr: "Déblocage opérateur, Vérification IMEI, Crédits d'outils, FRP, Firmware, Remboursement automatique",
    en: "Carrier unlock, IMEI checks, Tool credits, FRP, Firmware, Automatic refunds",
    es: "Liberación de operador, Verificación IMEI, Créditos de herramientas, FRP, Firmware, Reembolso automático",
  },
};

/** Saved themes from before these settings existed get the new defaults for anything missing. */
export function fullTheme(t: Partial<ThemeConfig> | undefined): ThemeConfig {
  return { ...DEFAULT_THEME, ...(t ?? {}), marquee: { ...DEFAULT_THEME.marquee, ...(t?.marquee ?? {}) } };
}

// Amounts in minor units (centimes).
export const DEFAULT_SETTINGS: Settings = {
  lowStockLimit: 5,
  htgPerUsd: 131.5,
  exchangeSpreadBps: 150,
  exchangeFeeBps: 0,
  exchangeQuoteSeconds: 120,
  minDepositHtg: 10_000,
  maxDepositHtg: 10_000_000,
  holdThresholdHtg: 2_500_000,
  holdHours: 24,
  newAccountDays: 3,
  newAccountDailyLimitHtg: 1_500_000,
  reviewOrderThresholdHtg: 2_000_000,
  natcashRecipientName: "GSMLite",
  natcashRecipientPhone: "+509 0000 0000",
  natcashInstructions: {},
  natcashQrUrl: "",
  moncashEnabled: true,
  natcashEnabled: true,
  whatsappNumber: "50900000000",
  supportHours: "Lun–Sam 8:00–20:00",
  businessAddress: "Port-au-Prince, Haïti",
  businessName: "GSMLite",
  socialFacebook: "",
  socialInstagram: "",
  socialTiktok: "",
  announcement: { enabled: false, text: {}, link: "" },
  logoUrl: "",
  logoDarkUrl: "",
  approvalThresholdHtg: 1_000_000,
  autoRefundHours: 24,
  referralEnabled: false,
  referralRewardHtg: 10_000,
  referralMinOrderHtg: 50_000,
  referralFriendRewardHtg: 0,
  heroImageUrl: "",
  ogImageUrl: "",
  homepage: null,
  homepageDraft: null,
  homepageHistory: [],
  theme: DEFAULT_THEME,
  themeHistory: [],
  navigation: { header: [], footer: [] },
  newsletterEnabled: false,
  requireEmailVerification: true,
  maxAccountsPerDevice: 3,
  defaultCountry: "HT",
  payCountries: {
    moncash: { countryMode: "only", countries: ["HT"] },
    natcash: { countryMode: "only", countries: ["HT"] },
    card: { countryMode: "all", countries: [] },
  },
  cardEnabled: false,
  telegramUrl: "",
  freeChecksPerDay: 3,
  freeCheckVariantId: "",
  checkCreditDays: 7,
  kycRetentionMonths: 12,
  telegramChannel: "",
  telegramStaffChat: "",
  welcomeCreditUsd: 0,
  autoMessages: { inactiveOn: false, inactiveDays: 14, afterUnlockOn: true, backOnlineTelegram: true, toolUpdateTelegram: true, dealTelegram: true },
  topupBonus: { firstPct: 10, pct: 3, minUsd: 5000 },
  supplierDefaults: { markupPct: 35, minProfitUsd: 50, round: "99" },
  successRate: { minOrders: 20, alertBelowPct: 80, pauseBelowPct: 0 },
  successWatch: {},
  appIconUrl: "",
  appIconVersion: 0,
  maintenance: { on: false, message: {} },
  legal: { entity: "", registration: "", taxId: "", email: "", refundDays: 7 },
  languages: [...locales],
  adminIpAllowlist: [],
  contentMachine: { onNewService: true, hubs: true, toolPosts: true, guides: true, refresh: true, perDay: 3, languages: ["en", "ht", "fr", "es"], budgetUsd: 20, model: "claude-opus-5-5", tone: "Clear, friendly and precise, for phone repair technicians and phone owners. Short sentences. No hype." },
  gsc: { site: "", refreshToken: "" },
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.siteSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  return merged as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
  try {
    revalidateTag("settings");
  } catch {
    // outside a Next.js request (seed/scripts): the 60-second expiry covers it
  }
}

/**
 * Cached copy for rendering public pages (logo, menus, announcement, contact numbers).
 * Refreshed as soon as staff save settings, and at most 60 seconds old otherwise.
 * Money paths (deposits, exchange, limits, checkout) keep using getSettings(), which always reads the database.
 */
const cachedSettings = unstable_cache(getSettings, ["site-settings"], { tags: ["settings"], revalidate: 60 });
export const getDisplaySettings = cache(() => cachedSettings());

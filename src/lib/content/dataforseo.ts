import "server-only";
import { prisma } from "../db";
import { recordSpend, withinBudget } from "./spend";

/**
 * DataForSEO keyword data (https://docs.dataforseo.com/v3/). Login and password go in the hosting env only:
 * DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD. DATAFORSEO_SANDBOX=1 uses their free sandbox (fake numbers) for testing.
 */
export const keywordsReady = () => !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);

/** Market per site language. Haitian Creole has no keyword data, so Kreyòl pages follow the French research. */
export const MARKETS: Record<string, { location: number; language: string; country: string }> = {
  en: { location: 2840, language: "en", country: "US" },
  fr: { location: 2250, language: "fr", country: "FR" },
  es: { location: 2484, language: "es", country: "MX" },
  pt: { location: 2076, language: "pt", country: "BR" },
  ar: { location: 2682, language: "ar", country: "SA" },
};

type Item = {
  keyword?: string;
  keyword_info?: { search_volume?: number | null; cpc?: number | null };
  keyword_properties?: { keyword_difficulty?: number | null };
  search_intent_info?: { main_intent?: string | null };
};

async function post(path: string, body: unknown): Promise<{ items: Item[]; cost: number }> {
  const host = process.env.DATAFORSEO_SANDBOX === "1" ? "https://sandbox.dataforseo.com" : "https://api.dataforseo.com";
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
  const res = await fetch(`${host}${path}`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json().catch(() => null)) as { status_code?: number; status_message?: string; cost?: number; tasks?: { status_code?: number; status_message?: string; result?: { items?: Item[] }[] }[] } | null;
  if (!json || json.status_code !== 20000) throw new Error(`DataForSEO: ${json?.status_message ?? `HTTP ${res.status}`}`);
  const task = json.tasks?.[0];
  if (task?.status_code !== 20000) throw new Error(`DataForSEO: ${task?.status_message ?? "task failed"}`);
  return { items: task.result?.[0]?.items ?? [], cost: json.cost ?? 0 };
}

/**
 * Keyword ideas around one seed in one market, saved in the Keyword table (a keyword already saved is not paid for again
 * until it is 30 days old). Returns how many keywords were saved.
 */
export async function researchSeed(seed: string, locale: keyof typeof MARKETS, limit = 50): Promise<number> {
  if (!keywordsReady()) throw new Error("Keyword research is not connected: add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the hosting environment");
  const m = MARKETS[locale];
  const fresh = await prisma.keyword.findFirst({ where: { keyword: seed.toLowerCase(), locale, country: m.country, fetchedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } });
  if (fresh) return 0;
  if (!(await withinBudget(50_000))) throw new Error("This month's content budget is spent");
  const { items, cost } = await post("/v3/dataforseo_labs/google/keyword_suggestions/live", [
    { keyword: seed, location_code: m.location, language_code: m.language, include_seed_keyword: true, limit },
  ]);
  await recordSpend("keywords", cost * 1_000_000, `suggestions: ${seed} (${locale})`);
  let saved = 0;
  for (const it of items) {
    const kw = it.keyword?.trim().toLowerCase();
    if (!kw || kw.length > 120) continue;
    const data = {
      volume: it.keyword_info?.search_volume ?? null,
      cpcCents: it.keyword_info?.cpc != null ? Math.round(it.keyword_info.cpc * 100) : null,
      difficulty: it.keyword_properties?.keyword_difficulty ?? null,
      intent: it.search_intent_info?.main_intent ?? null,
      source: "dataforseo",
      fetchedAt: new Date(),
    };
    await prisma.keyword.upsert({ where: { keyword_locale_country: { keyword: kw, locale, country: m.country } }, create: { keyword: kw, locale, country: m.country, ...data }, update: data });
    saved++;
  }
  return saved;
}

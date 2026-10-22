import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getSettings } from "../settings";
import { t } from "../text";
import { writePage, writerReady, type WrittenPage } from "./ai";
import { brandProducts, guideFacts, hubBrands, hubFacts, serviceFacts, toolFacts } from "./facts";
import { keywordsReady, MARKETS, researchSeed } from "./dataforseo";

export type PageContent = Record<string, WrittenPage>;

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "page";
}

async function freeSlug(base: string) {
  let slug = base;
  for (let n = 2; await prisma.contentPage.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
  return slug;
}

async function save(data: { kind: string; slug: string; keyword: string; reason: string; productId?: string; brand?: string; dataHash?: string; facts: string }) {
  const { contentMachine } = await getSettings();
  const w = await writePage({ kind: data.kind, keyword: data.keyword, facts: data.facts, languages: contentMachine.languages });
  return prisma.contentPage.create({
    data: {
      kind: data.kind,
      slug: await freeSlug(data.slug),
      keyword: data.keyword,
      reason: data.reason,
      productId: data.productId ?? null,
      brand: data.brand ?? null,
      dataHash: data.dataHash ?? null,
      content: w.pages as unknown as Prisma.InputJsonValue,
      costMicros: Math.round(w.costMicros),
      model: w.model,
    },
  });
}

/** Service page draft from the product's real data. `refreshOf` = the published page it will replace on approval. */
export async function draftService(productId: string, reason: string, refreshOf?: string) {
  const f = await serviceFacts(productId);
  if (!f) throw new Error("This service is hidden, unpublished or marked “Hide from Google”");
  const keyword = f.name.toLowerCase();
  return save({ kind: "service", slug: refreshOf ? `${refreshOf}--refresh` : `svc-${f.slug}`, keyword, reason: refreshOf ? `refresh:${refreshOf}` : reason, productId, dataHash: f.hash, facts: f.facts });
}

export async function draftHub(brand: string, reason = "brand hub") {
  const facts = await hubFacts(brand);
  if (!facts) throw new Error(`No public services for ${brand}`);
  const keyword = `${brand} unlock and imei check`.toLowerCase();
  return save({ kind: "hub", slug: slugify(`${brand}-unlock-imei-check`), keyword, reason, brand, facts });
}

export async function draftGuide(keyword: string, reason = "keyword idea") {
  const d = await save({ kind: "guide", slug: slugify(keyword), keyword, reason, facts: await guideFacts(keyword) });
  await prisma.keyword.updateMany({ where: { keyword }, data: { status: "drafted" } });
  return d;
}

export async function draftTool(input: { toolName: string; version: string; notes: string }) {
  return save({ kind: "tool", slug: slugify(`${input.toolName}-${input.version}`), keyword: `${input.toolName} ${input.version}`.toLowerCase(), reason: "tool update", brand: input.toolName, facts: await toolFacts(input) });
}

/** Staff approve a draft: it goes live (a refresh replaces the page it was written for; a tool post becomes a news post). */
export async function approvePage(id: string, staffId: string) {
  const d = await prisma.contentPage.findUniqueOrThrow({ where: { id } });
  if (d.status !== "DRAFT") throw new Error("Already handled");
  const now = new Date();
  const refreshOf = d.reason?.startsWith("refresh:") ? d.reason.slice(8) : null;
  if (refreshOf) {
    await prisma.$transaction([
      prisma.contentPage.update({ where: { slug: refreshOf }, data: { content: d.content as Prisma.InputJsonValue, dataHash: d.dataHash, costMicros: { increment: d.costMicros }, reviewedById: staffId, updatedAt: now } }),
      prisma.contentPage.delete({ where: { id } }),
    ]);
    return { slug: refreshOf };
  }
  if (d.kind === "service" && d.productId) {
    await prisma.contentPage.updateMany({ where: { kind: "service", productId: d.productId, status: "PUBLISHED" }, data: { status: "REJECTED" } });
  }
  if (d.kind === "tool") {
    const c = d.content as unknown as PageContent;
    const pick = (f: (p: WrittenPage) => string) => Object.fromEntries(Object.entries(c).map(([l, p]) => [l, f(p)]));
    const [toolName, ...rest] = (d.brand ?? d.keyword).split(" ");
    const article = await prisma.newsArticle.create({
      data: {
        slug: d.slug,
        kind: "tool",
        toolName: d.brand ?? toolName,
        version: d.keyword.replace((d.brand ?? "").toLowerCase(), "").trim() || rest.join(" ") || null,
        title: pick((p) => p.title),
        excerpt: pick((p) => p.description),
        body: pick((p) => [p.intro, ...p.sections.map((s) => `${s.heading}\n\n${s.body}`)].join("\n\n")),
        isPublished: true,
        publishedAt: now,
      },
    });
    const { announceToolUpdate } = await import("../marketing");
    await announceToolUpdate(article.id).catch(() => {});
    await prisma.contentPage.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: now, reviewedById: staffId, newsArticleId: article.id } });
    return { slug: d.slug, news: true };
  }
  await prisma.contentPage.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: now, reviewedById: staffId } });
  return { slug: d.slug };
}

/** Pages written today by the machine itself (the daily limit; drafts staff ask for are not counted). */
async function writtenToday() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return prisma.contentPage.count({ where: { createdAt: { gte: start }, reason: { in: ["new service", "brand hub", "keyword idea"] } } });
}

/** Seeds for keyword research from the catalog: brands, tools and the main service words. */
async function seeds(): Promise<string[]> {
  const brands = await hubBrands(1);
  const tools = await prisma.category.findMany({ where: { isTool: true, isVisible: true }, select: { name: true } });
  return [
    ...brands.flatMap((b) => [`unlock ${b}`, `${b} imei check`]),
    ...tools.map((c) => t(c.name, "en")).filter(Boolean),
    "imei check", "check if phone is blacklisted", "carrier unlock", "frp bypass tool",
  ].slice(0, 25);
}

/** Score = volume × chance to rank; ideas that match a public service get its margin as a bonus. */
async function scoreIdeas() {
  const ideas = await prisma.keyword.findMany({ where: { status: "idea", volume: { gt: 0 } }, take: 2000 });
  const products = await prisma.product.findMany({ where: { isPublished: true, hideFromGoogle: false }, select: { id: true, slug: true, variants: { select: { priceUsd: true, costUsd: true } } } });
  for (const k of ideas) {
    const words = k.keyword.split(/\s+/).filter((w) => w.length > 2);
    const match = products.find((p) => words.filter((w) => p.slug.includes(w)).length >= 2);
    const margin = match?.variants[0]?.costUsd != null ? Math.max(0.1, 1 - match.variants[0].costUsd / Math.max(1, match.variants[0].priceUsd)) : 0.3;
    const chance = (100 - (k.difficulty ?? 50)) / 100;
    const isQuestion = /^(how|what|why|can|is|does|comment|como|qué|que|pourquoi|kijan|kòman)\b/.test(k.keyword) || /check if|find/.test(k.keyword);
    const target = match ? match.id : isQuestion ? "guide" : null;
    await prisma.keyword.update({ where: { id: k.id }, data: { score: Math.round((k.volume ?? 0) * chance * margin), target } });
  }
}

/** Weekly keyword research (Mondays, or when staff press "Fetch ideas now"). */
export async function research() {
  if (!keywordsReady()) return { saved: 0 };
  let saved = 0;
  for (const seed of await seeds()) for (const locale of Object.keys(MARKETS) as (keyof typeof MARKETS)[]) saved += await researchSeed(seed, locale, 30).catch(() => 0);
  await scoreIdeas();
  return { saved };
}

/** Once a day (cron): drafts for new services, brand hubs, guides from the best ideas, and refreshes. Never publishes. */
export async function runDaily(now = new Date()) {
  const { contentMachine: cm } = await getSettings();
  const out = { drafted: 0, refreshes: 0, research: 0, errors: [] as string[] };
  if (!writerReady()) return out;
  let room = Math.max(0, cm.perDay - (await writtenToday()));
  const attempt = async (f: () => Promise<unknown>) => {
    try {
      await f();
      return true;
    } catch (e) {
      out.errors.push(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  if (cm.onNewService && room > 0) {
    const missing = await prisma.product.findMany({
      where: { isPublished: true, hideFromGoogle: false, seoPage: true },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const have = new Set((await prisma.contentPage.findMany({ where: { kind: "service", productId: { in: missing.map((m) => m.id) }, status: { in: ["DRAFT", "PUBLISHED"] } }, select: { productId: true } })).map((p) => p.productId));
    for (const p of missing.filter((m) => !have.has(m.id))) {
      if (room <= 0) break;
      if (await attempt(() => draftService(p.id, "new service"))) { out.drafted++; room--; }
    }
  }
  if (cm.hubs && room > 0) {
    for (const brand of await hubBrands(3)) {
      if (room <= 0) break;
      if (await prisma.contentPage.findFirst({ where: { kind: "hub", brand, status: { in: ["DRAFT", "PUBLISHED"] } } })) continue;
      if ((await brandProducts(brand)).length < 3) continue;
      if (await attempt(() => draftHub(brand))) { out.drafted++; room--; }
    }
  }
  if (cm.guides) {
    if (now.getUTCDay() === 1) out.research = (await research().catch(() => ({ saved: 0 }))).saved;
    const ideas = await prisma.keyword.findMany({ where: { status: "idea", target: "guide" }, orderBy: { score: "desc" }, take: room });
    for (const k of ideas) {
      if (room <= 0) break;
      if (await attempt(() => draftGuide(k.keyword))) { out.drafted++; room--; }
    }
  }
  if (cm.refresh) {
    const live = await prisma.contentPage.findMany({ where: { kind: "service", status: "PUBLISHED", productId: { not: null } }, take: 200 });
    for (const page of live) {
      const f = await serviceFacts(page.productId!);
      if (!f || f.hash === page.dataHash) continue;
      if (await prisma.contentPage.findFirst({ where: { reason: `refresh:${page.slug}`, status: "DRAFT" } })) continue;
      if (await attempt(() => draftService(page.productId!, "refresh", page.slug))) out.refreshes++;
    }
  }
  return out;
}

/** The published service page text for a product page, in the visitor's language (falls back to English). */
export async function servicePageContent(productId: string, locale: string): Promise<WrittenPage | null> {
  const page = await prisma.contentPage.findFirst({ where: { kind: "service", productId, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
  if (!page) return null;
  const c = page.content as unknown as PageContent;
  return c[locale] ?? c.en ?? Object.values(c)[0] ?? null;
}

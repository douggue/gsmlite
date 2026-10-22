export const HOME_SECTIONS = ["slider", "quickActions", "deals", "promos", "topTools", "shopByTool", "toolUpdates", "howItWorks", "reviews", "aboutFaq", "support"] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  slider: "Offer slider with top categories and quick links (phones: search, service tiles)",
  quickActions: "Quick actions: Add funds, Place order, My orders, Track order",
  deals: "Deal of the day (services marked Featured; phones: Popular list)",
  promos: "Two banners: server credits and free IMEI check",
  topTools: "Top tools (categories marked Tool, with their licenses)",
  shopByTool: "Shop by tool",
  toolUpdates: "Latest tool updates (News posts of type Tool update)",
  howItWorks: "How it works, with real numbers",
  reviews: "Customer reviews (Admin → Trust; hidden until one is approved)",
  aboutFaq: "About us and FAQ",
  support: "Support band (WhatsApp, Telegram)",
};

export type HomepageConfig = {
  sections: { id: HomeSectionId; visible: boolean }[];
  /** Optional per-language overrides of the hero text; empty = default wording */
  hero: { eyebrow: Record<string, string>; title: Record<string, string>; subtitle: Record<string, string> };
  ctaHref: string;
};

export const DEFAULT_HOMEPAGE: HomepageConfig = {
  sections: HOME_SECTIONS.map((id) => ({ id, visible: true })),
  hero: { eyebrow: {}, title: {}, subtitle: {} },
  ctaHref: "/store",
};

/** Accepts stored JSON of any age and returns a complete, valid config (unknown sections dropped, new ones placed after their usual neighbour). */
export function normalizeHomepage(raw: unknown): HomepageConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<HomepageConfig>;
  const seen = new Set<string>();
  const sections = (Array.isArray(r.sections) ? r.sections : [])
    .filter((x) => x && HOME_SECTIONS.includes(x.id as HomeSectionId) && !seen.has(x.id) && seen.add(x.id))
    .map((x) => ({ id: x.id as HomeSectionId, visible: x.visible !== false }));
  HOME_SECTIONS.forEach((id, i) => {
    if (seen.has(id)) return;
    const after = i > 0 ? sections.findIndex((x) => x.id === HOME_SECTIONS[i - 1]) : -1;
    sections.splice(after >= 0 ? after + 1 : sections.length, 0, { id, visible: true });
    seen.add(id);
  });
  return {
    sections,
    hero: { eyebrow: r.hero?.eyebrow ?? {}, title: r.hero?.title ?? {}, subtitle: r.hero?.subtitle ?? {} },
    ctaHref: typeof r.ctaHref === "string" && r.ctaHref.startsWith("/") ? r.ctaHref : "/store",
  };
}

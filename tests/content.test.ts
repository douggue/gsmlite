import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approvePage } from "@/lib/content/machine";
import { maskResult } from "@/lib/content/facts";

afterAll(() => prisma.$disconnect());
const rand = () => Math.random().toString(36).slice(2, 10);
const page = (title: string) => ({ en: { title, description: "d", intro: "i", steps: ["a"], sections: [], faq: [{ q: "q", a: "a" }] } });

describe("content machine", () => {
  it("masks IMEIs and serials in sample results", () => {
    expect(maskResult("IMEI 356789012345678 Find My: OFF")).toBe("IMEI 35•••••••••5678 Find My: OFF");
    expect(maskResult("Serial F2LXK1ABCDEF")).toBe("Serial F2••••••EF");
  });

  it("publishes a draft, then a refresh replaces its text without a second page", async () => {
    const slug = `svc-${rand()}`;
    const live = await prisma.contentPage.create({ data: { kind: "guide", slug, keyword: "k", content: page("v1") } });
    await approvePage(live.id, "staff");
    expect((await prisma.contentPage.findUniqueOrThrow({ where: { id: live.id } })).status).toBe("PUBLISHED");
    await expect(approvePage(live.id, "staff")).rejects.toThrow("Already handled");

    const refresh = await prisma.contentPage.create({ data: { kind: "guide", slug: `${slug}--refresh`, keyword: "k", reason: `refresh:${slug}`, content: page("v2"), dataHash: "h2" } });
    await approvePage(refresh.id, "staff");
    const after = await prisma.contentPage.findUniqueOrThrow({ where: { id: live.id } });
    expect((after.content as ReturnType<typeof page>).en.title).toBe("v2");
    expect(after.dataHash).toBe("h2");
    expect(await prisma.contentPage.findUnique({ where: { id: refresh.id } })).toBeNull();
  });

  it("turns an approved tool update into a published news post", async () => {
    const slug = `tool-${rand()}`;
    const d = await prisma.contentPage.create({ data: { kind: "tool", slug, keyword: "unlocktool 2026.10", brand: "UnlockTool", content: page("UnlockTool 2026.10 is out") } });
    await approvePage(d.id, "staff");
    const news = await prisma.newsArticle.findUniqueOrThrow({ where: { slug } });
    expect(news).toMatchObject({ kind: "tool", toolName: "UnlockTool", version: "2026.10", isPublished: true });
  });
});

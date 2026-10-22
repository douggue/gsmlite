"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertStaff } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getSettings, setSetting } from "@/lib/settings";
import { approvePage, draftGuide, draftHub, draftService, draftTool, research, type PageContent } from "@/lib/content/machine";
import { WRITER_MODELS } from "@/lib/content/ai";

type R = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (e: unknown): R => ({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
const done = () => revalidatePath("/admin/content", "layout");

/** "+ Write a page": a service, a brand hub, a guide for a search, or a tool update post. Always a draft. */
export async function writeNow(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    const kind = String(form.get("kind"));
    let d;
    if (kind === "service") d = await draftService(String(form.get("productId")), "asked by staff");
    else if (kind === "hub") d = await draftHub(String(form.get("brand") ?? "").trim().slice(0, 40), "asked by staff");
    else if (kind === "guide") {
      const kw = String(form.get("keyword") ?? "").trim().toLowerCase().slice(0, 120);
      if (kw.length < 4) return { ok: false, error: "Type the search the guide should answer" };
      d = await draftGuide(kw, "asked by staff");
    } else if (kind === "tool") {
      const toolName = String(form.get("toolName") ?? "").trim().slice(0, 60);
      const version = String(form.get("version") ?? "").trim().slice(0, 30);
      const notes = String(form.get("notes") ?? "").trim().slice(0, 3000);
      if (!toolName || notes.length < 10) return { ok: false, error: "Tool name and what changed are needed" };
      d = await draftTool({ toolName, version, notes });
    } else return { ok: false, error: "Pick what to write" };
    await audit(staff.id, "content.write", "ContentPage", d.id, { kind, slug: d.slug });
    done();
    return { ok: true, id: d.id, message: "Draft written: review it below" };
  } catch (e) {
    return fail(e);
  }
}

export async function approveDraft(id: string): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    const r = await approvePage(id, staff.id);
    await audit(staff.id, "content.approve", "ContentPage", id, r);
    done();
    revalidatePath("/", "layout");
    return { ok: true, message: "Published" };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectDraft(id: string): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    await prisma.contentPage.update({ where: { id }, data: { status: "REJECTED", reviewedById: staff.id } });
    await audit(staff.id, "content.reject", "ContentPage", id);
    done();
    return { ok: true, message: "Rejected" };
  } catch (e) {
    return fail(e);
  }
}

/** Unpublish a live page (it stops showing; the service page keeps its normal text). */
export async function unpublishPage(id: string): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    await prisma.contentPage.update({ where: { id }, data: { status: "REJECTED" } });
    await audit(staff.id, "content.unpublish", "ContentPage", id);
    done();
    revalidatePath("/", "layout");
    return { ok: true, message: "Taken down" };
  } catch (e) {
    return fail(e);
  }
}

/** Staff edit the written text (JSON per language) before approving. */
export async function editDraft(id: string, json: string): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    let c: PageContent;
    try {
      c = JSON.parse(json);
    } catch {
      return { ok: false, error: "The text is not valid JSON" };
    }
    for (const [l, p] of Object.entries(c)) {
      if (!/^[a-z]{2}$/.test(l) || typeof p?.title !== "string" || typeof p?.intro !== "string" || !Array.isArray(p?.faq)) return { ok: false, error: `Language “${l}” is missing title, intro or faq` };
    }
    await prisma.contentPage.update({ where: { id }, data: { content: c as unknown as Prisma.InputJsonValue } });
    await audit(staff.id, "content.edit", "ContentPage", id);
    done();
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveMachine(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    const s = await getSettings();
    const langs = ["en", "ht", "fr", "es"].filter((l) => form.get(`lang_${l}`) === "on");
    if (!langs.length) return { ok: false, error: "Pick at least one language" };
    const model = String(form.get("model") ?? "");
    await setSetting("contentMachine", {
      ...s.contentMachine,
      onNewService: form.get("onNewService") === "on",
      hubs: form.get("hubs") === "on",
      toolPosts: form.get("toolPosts") === "on",
      guides: form.get("guides") === "on",
      refresh: form.get("refresh") === "on",
      perDay: Math.max(0, Math.min(20, Math.round(Number(form.get("perDay")) || 0))),
      budgetUsd: Math.max(0, Math.min(5000, Number(String(form.get("budgetUsd") ?? "").replace(",", ".")) || 0)),
      languages: langs,
      model: WRITER_MODELS.includes(model) ? model : s.contentMachine.model,
      tone: String(form.get("tone") ?? "").trim().slice(0, 500) || s.contentMachine.tone,
    });
    await audit(staff.id, "settings.content", "Settings", null, Object.fromEntries(form));
    done();
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function fetchIdeas(): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    const r = await research();
    await audit(staff.id, "content.research", "Keyword", null, r);
    done();
    return { ok: true, message: `${r.saved} keywords saved` };
  } catch (e) {
    return fail(e);
  }
}

export async function ignoreKeyword(id: string): Promise<R> {
  try {
    await assertStaff("content.manage");
    await prisma.keyword.update({ where: { id }, data: { status: "ignored" } });
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function draftFromKeyword(id: string): Promise<R> {
  try {
    const staff = await assertStaff("content.manage");
    const k = await prisma.keyword.findUniqueOrThrow({ where: { id } });
    const d = k.target && k.target !== "guide" ? await draftService(k.target, `keyword: ${k.keyword}`) : await draftGuide(k.keyword, "keyword idea");
    await prisma.keyword.update({ where: { id }, data: { status: "drafted" } });
    await audit(staff.id, "content.write", "ContentPage", d.id, { keyword: k.keyword });
    done();
    return { ok: true, message: "Draft written" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveGscSite(form: FormData): Promise<R> {
  try {
    const staff = await assertStaff("settings.manage");
    const s = await getSettings();
    const site = String(form.get("site") ?? "").trim().slice(0, 200);
    await setSetting("gsc", { ...s.gsc, site });
    await audit(staff.id, "settings.gsc", "Settings", null, { site });
    done();
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

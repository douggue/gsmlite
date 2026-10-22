"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteNews, saveNews } from "@/actions/content";
import { LocalizedInputs } from "./LocalizedInputs";
import { ImageField } from "./ImageField";

type A = { id: string; slug: string; kind: string; toolName: string | null; version: string | null; image: string | null; isPublished: boolean; publishedAt: string; title: Record<string, string>; excerpt: Record<string, string>; body: Record<string, string> };

const KINDS = { post: "News", tool: "Tool update", feature: "New on the site", security: "Security", howto: "How-to" } as const;

export function NewsForm({ article, presetKind }: { article?: A; presetKind?: string }) {
  const [kind, setKind] = useState(article?.kind ?? (presetKind && presetKind in KINDS ? presetKind : "post"));
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveNews(fd);
          if (!r.ok) return setMsg({ ok: false, text: r.error });
          setMsg({ ok: true, text: "Saved" });
          if (!article && r.id) router.push(`/admin/news/${r.id}`);
          else router.refresh();
        });
      }}
    >
      {article && <input type="hidden" name="id" value={article.id} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <label><span className="label">Slug (URL)</span><input name="slug" defaultValue={article?.slug} required className="input" placeholder="new-iphone-unlocks-october" /></label>
        <label><span className="label">Publish date (empty = now when published)</span><input name="publishedAt" type="datetime-local" defaultValue={article?.publishedAt} className="input" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label><span className="label">Kind</span>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input">
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {kind === "tool" && <>
          <label><span className="label">Tool name</span><input name="toolName" defaultValue={article?.toolName ?? ""} required placeholder="UnlockTool" className="input" /></label>
          <label><span className="label">Version</span><input name="version" defaultValue={article?.version ?? ""} placeholder="2026.10.22" className="input" /></label>
        </>}
      </div>
      {kind === "tool" && <p className="text-xs text-muted">When first published, it is posted to the Telegram channel if “Tool updates to Telegram” is on in Marketing.</p>}
      <ImageField name="image" label="Cover image" value={article?.image} folder="products" aspect="aspect-[16/9]" />
      <LocalizedInputs prefix="title" label="Title" value={article?.title} required />
      <LocalizedInputs prefix="excerpt" label="Short summary" value={article?.excerpt} textarea />
      <LocalizedInputs prefix="body" label="Article text (blank line = new paragraph)" value={article?.body} textarea />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={article?.isPublished} /> Published</label>
      {msg && <p className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save article"}</button>
        {article && (
          <button type="button" className="btn-ghost text-danger" onClick={() => { if (window.confirm("Delete this article?")) start(async () => { await deleteNews(article.id); router.push("/admin/news"); }); }}>Delete</button>
        )}
      </div>
    </form>
  );
}

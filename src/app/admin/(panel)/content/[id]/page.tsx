import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import type { PageContent } from "@/lib/content/machine";
import { approveDraft, editDraftForm, rejectDraft, unpublishPage } from "@/actions/content-machine";
import { ActionButton, ActionForm } from "@/components/admin/ActionButton";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Review page" };

/** Review a draft: the text in every language, where it will appear, and approve / edit / reject. */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("content.manage");
  const { id } = await params;
  const d = await prisma.contentPage.findUnique({ where: { id } });
  if (!d) notFound();
  const product = d.productId ? await prisma.product.findUnique({ where: { id: d.productId }, select: { slug: true } }) : null;
  const where = d.kind === "service" ? (product ? `/en/products/${product.slug}` : null) : d.kind === "hub" ? `/en/brand/${d.slug}` : d.kind === "guide" ? `/en/guides/${d.slug}` : d.newsArticleId ? `/en/news/${d.slug}` : null;
  const c = d.content as unknown as PageContent;
  const refresh = d.reason?.startsWith("refresh:");

  return (
    <>
      <Link href="/admin/content" className="text-sm font-semibold text-primary">← Content machine</Link>
      <PageTitle
        title={c.en?.title ?? Object.values(c)[0]?.title ?? "Page"}
        sub={`${d.kind}${refresh ? " (refresh: replaces the live text)" : ""} · keyword “${d.keyword}” · ${d.reason ?? ""} · written by ${d.model ?? "?"} for $${(d.costMicros / 1_000_000).toFixed(2)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {d.status === "DRAFT" && <ActionButton label={d.kind === "tool" ? "Approve, publish & post to Telegram" : "Approve & publish"} className="btn-primary min-h-10 px-4" action={approveDraft.bind(null, d.id)} />}
            {d.status === "DRAFT" && <ActionButton label="Reject" className="btn-secondary min-h-10 px-4" action={rejectDraft.bind(null, d.id)} />}
            {d.status === "PUBLISHED" && <ActionButton label="Take down" className="btn-secondary min-h-10 px-4" action={unpublishPage.bind(null, d.id)} />}
            {d.status === "PUBLISHED" && where && <a href={where} target="_blank" className="btn-secondary min-h-10 px-4">View ↗</a>}
          </div>
        }
      />
      <p className="mb-4 text-sm text-muted">Status: <b>{d.status.toLowerCase()}</b>{where && <> · appears at <span className="font-mono">{where}</span></>}. Check prices, times and claims against the service before approving.</p>
      <div className="grid gap-5 xl:grid-cols-2">
        {Object.entries(c).map(([lang, p]) => (
          <article key={lang} className="card space-y-3 p-5" lang={lang}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{lang}</p>
            <h2 className="text-xl font-bold">{p.title}</h2>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{p.description} <span className="text-xs">({p.description.length} chars)</span></p>
            <div className="space-y-2 whitespace-pre-line text-sm">{p.intro}</div>
            {p.steps.length > 0 && <ol className="list-inside list-decimal space-y-1 text-sm">{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
            {p.sections.map((s, i) => <section key={i} className="space-y-1"><h3 className="font-semibold">{s.heading}</h3><p className="whitespace-pre-line text-sm">{s.body}</p></section>)}
            {p.faq.length > 0 && <dl className="space-y-2 text-sm">{p.faq.map((f, i) => <div key={i}><dt className="font-semibold">{f.q}</dt><dd className="text-muted">{f.a}</dd></div>)}</dl>}
          </article>
        ))}
      </div>
      {d.status === "DRAFT" && (
        <ActionForm action={editDraftForm} className="card mt-5 space-y-3 p-5">
          <input type="hidden" name="id" value={d.id} />
          <h2 className="font-semibold">Edit the text</h2>
          <p className="text-sm text-muted">Every language with title, description, intro, steps, sections and faq.</p>
          <textarea name="json" rows={18} defaultValue={JSON.stringify(c, null, 2)} className="input py-2 font-mono text-xs" />
          <button className="btn-secondary min-h-10 px-4">Save changes</button>
        </ActionForm>
      )}
    </>
  );
}

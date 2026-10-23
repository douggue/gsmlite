import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { PageTitle, Table, Empty } from "@/components/admin/ui";

export const metadata = { title: "News" };

const KINDS: Record<string, string> = { post: "News", tool: "Tool update", feature: "New on the site", security: "Security", howto: "How-to" };

export default async function NewsAdmin({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const filter = kind && kind in KINDS ? kind : undefined;
  await requireStaff("content.manage");
  const articles = await prisma.newsArticle.findMany({ where: filter ? { kind: filter } : {}, orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }] });
  const now = new Date();
  return (
    <>
      <PageTitle title="News" sub="Articles appear on /news and in the homepage's latest-news section. A future publish date schedules the article." actions={<><Link href="/admin/news/new?kind=tool" className="btn-secondary">New tool update</Link><Link href={`/admin/news/new${filter ? `?kind=${filter}` : ""}`} className="btn-primary">New article</Link></>} />
      <nav className="mb-3 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/news" className={`rounded-xl px-3 py-2 font-semibold ${!filter ? "bg-[#111418] text-white" : "border border-border"}`}>All</Link>
        {Object.entries(KINDS).map(([k, v]) => <Link key={k} href={`/admin/news?kind=${k}`} className={`rounded-xl px-3 py-2 font-semibold ${filter === k ? "bg-[#111418] text-white" : "border border-border"}`}>{v}</Link>)}
      </nav>
      <Table head={["Title", "Kind", "Status", "Publish date"]} empty={articles.length === 0} emptyText={<Empty title="No posts yet" hint="Post tool updates and service changes so customers know what is new." />}>
        {articles.map((a) => (
          <tr key={a.id} className="hover:bg-surface-2">
            <td className="px-4 py-3"><Link href={`/admin/news/${a.id}`} className="font-semibold text-primary">{t(a.title, "en") || t(a.title, "ht")}</Link><br /><span className="text-xs text-muted">/news/{a.slug}</span></td>
            <td className="px-4 py-3 text-xs">{KINDS[a.kind] ?? a.kind}{a.toolName ? ` · ${a.toolName} ${a.version ?? ""}` : ""}</td>
            <td className="px-4 py-3 text-xs">{!a.isPublished ? "Draft" : a.publishedAt && a.publishedAt > now ? "Scheduled" : "Published"}</td>
            <td className="px-4 py-3 text-muted">{a.publishedAt?.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

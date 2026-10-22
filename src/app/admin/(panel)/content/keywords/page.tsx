import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { keywordsReady } from "@/lib/content/dataforseo";
import { draftFromKeyword, fetchIdeas, ignoreKeyword } from "@/actions/content-machine";
import { ActionButton } from "@/components/admin/ActionButton";
import { PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Keyword ideas" };

/** Keyword ideas with real numbers (DataForSEO), best first: score = volume × chance to rank × margin. */
export default async function KeywordIdeas({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  await requireStaff("content.manage");
  const { locale } = await searchParams;
  const [ideas, products] = await Promise.all([
    prisma.keyword.findMany({ where: { status: "idea", ...(locale ? { locale } : {}) }, orderBy: [{ score: "desc" }, { volume: "desc" }], take: 200 }),
    prisma.product.findMany({ select: { id: true, name: true } }),
  ]);
  const name = new Map(products.map((p) => [p.id, t(p.name, "en")]));
  return (
    <>
      <Link href="/admin/content" className="text-sm font-semibold text-primary">← Content machine</Link>
      <PageTitle title="Keyword ideas" sub="Real search numbers, refreshed weekly. Services marked “Hide from Google” are never targeted." actions={keywordsReady() ? <ActionButton label="Fetch ideas now" action={fetchIdeas} /> : <span className="text-sm text-warning">Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the hosting environment</span>} />
      <nav className="mb-3 flex gap-2 text-sm">{["", "en", "fr", "es"].map((l) => <Link key={l} href={l ? `?locale=${l}` : "?"} className={`rounded-xl px-3 py-2 font-semibold ${(locale ?? "") === l ? "bg-[#111418] text-white" : "border border-border"}`}>{l ? l.toUpperCase() : "All"}</Link>)}</nav>
      <Table head={["Keyword", "Market", "Searches / month", "Difficulty", "Score", "Becomes", ""]} empty={ideas.length === 0}>
        {ideas.map((k) => (
          <tr key={k.id}>
            <td className="px-4 py-2.5 font-medium">{k.keyword}</td>
            <td className="px-4 py-2.5 text-xs">{k.locale.toUpperCase()} · {k.country}</td>
            <td className="px-4 py-2.5 tabular-nums">{k.volume ?? "—"}</td>
            <td className="px-4 py-2.5 tabular-nums">{k.difficulty ?? "—"}</td>
            <td className="px-4 py-2.5 tabular-nums font-semibold">{k.score}</td>
            <td className="px-4 py-2.5 text-xs">{k.target === "guide" ? "Guide" : k.target ? `Service: ${name.get(k.target) ?? "?"}` : "—"}</td>
            <td className="px-4 py-2.5"><div className="flex gap-2">{k.target && <ActionButton label="Write" action={draftFromKeyword.bind(null, k.id)} />}<ActionButton label="Ignore" className="btn-ghost min-h-9 px-2 text-xs" action={ignoreKeyword.bind(null, k.id)} /></div></td>
          </tr>
        ))}
      </Table>
    </>
  );
}

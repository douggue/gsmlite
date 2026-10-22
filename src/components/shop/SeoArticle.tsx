import type { WrittenPage } from "@/lib/content/ai";

/** Text from the content machine (approved by staff): intro, steps, sections and FAQ with FAQPage rich results. */
export function SeoArticle({ page, stepsTitle, faqTitle, showIntro = true }: { page: WrittenPage; stepsTitle: string; faqTitle: string; showIntro?: boolean }) {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <article className="space-y-6 text-[15px] leading-relaxed">
      {page.faq.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq).replace(/</g, "\\u003c") }} />}
      {showIntro && <div className="space-y-3 whitespace-pre-line">{page.intro}</div>}
      {page.steps.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">{stepsTitle}</h2>
          <ol className="mt-3 space-y-2.5">
            {page.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#111418] text-sm font-bold text-white dark:bg-primary">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {page.sections.map((s, i) => (
        <section key={i}>
          <h2 className="text-lg font-bold">{s.heading}</h2>
          <p className="mt-2 whitespace-pre-line text-muted">{s.body}</p>
        </section>
      ))}
      {page.faq.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">{faqTitle}</h2>
          <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {page.faq.map((f, i) => (
              <details key={i} className="group p-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">{f.q}</summary>
                <p className="mt-2 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

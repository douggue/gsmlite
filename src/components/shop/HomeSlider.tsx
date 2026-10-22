"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

export type Slide = { id: string; tag: string; label: string; title: string; bullets: string[]; buttonText: string; buttonHref: string; button2Text?: string; button2Href?: string | null; image?: string | null };

/** Offer slider: changes every 7 s (not for visitors who ask for less motion), dots and "01 / 04" counter. */
export function HomeSlider({ slides, prevLabel, nextLabel }: { slides: Slide[]; prevLabel: string; nextLabel: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [slides.length, paused]);
  const s = slides[i];
  if (!s) return null;
  const external = (h: string) => h.startsWith("http");
  return (
    <section
      aria-roledescription="carousel"
      className="relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-[20px] bg-[#111418] p-10 text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {s.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      )}
      <div key={s.id} className="animate-rise relative" aria-live="polite">
        <p className="flex flex-wrap items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.12em]">
          {s.tag && <span className="rounded-md bg-[#7ce0a8] px-2 py-0.5 text-[#0b2a1a]">{s.tag}</span>}
          {s.label && <span className="text-[#7ce0a8]">{s.label}</span>}
        </p>
        <h1 className="display mt-4 max-w-[15ch] text-5xl leading-[1.02] tracking-tight">{s.title}</h1>
        {s.bullets.length > 0 && (
          <ul className="mt-5 space-y-1.5 text-base text-[#dfe4dc]">
            {s.bullets.map((b) => <li key={b}>✓ {b}</li>)}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-2.5">
          {s.buttonText && (external(s.buttonHref)
            ? <a href={s.buttonHref} className="inline-flex min-h-[50px] items-center rounded-xl bg-[#7ce0a8] px-5 font-semibold text-[#0b2a1a]">{s.buttonText} <span className="inline-block rtl:-scale-x-100">→</span></a>
            : <Link href={s.buttonHref} className="inline-flex min-h-[50px] items-center rounded-xl bg-[#7ce0a8] px-5 font-semibold text-[#0b2a1a]">{s.buttonText} <span className="inline-block rtl:-scale-x-100">→</span></Link>)}
          {s.button2Text && s.button2Href && (external(s.button2Href)
            ? <a href={s.button2Href} target="_blank" rel="noopener" className="inline-flex min-h-[50px] items-center rounded-xl border border-white/25 px-5 font-semibold">{s.button2Text}</a>
            : <Link href={s.button2Href} className="inline-flex min-h-[50px] items-center rounded-xl border border-white/25 px-5 font-semibold">{s.button2Text}</Link>)}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="relative mt-8 flex items-center justify-between">
          <div className="flex gap-1.5">
            {slides.map((x, n) => (
              <button key={x.id} type="button" aria-label={`${n + 1} / ${slides.length}`} aria-current={n === i} onClick={() => setI(n)}
                className={`h-1 w-9 rounded-full ${n === i ? "bg-[#7ce0a8]" : "bg-white/20"}`} />
            ))}
          </div>
          <div className="flex items-center gap-3 text-[13px] text-[#b9c0b6]">
            <button type="button" aria-label={prevLabel} onClick={() => setI((i - 1 + slides.length) % slides.length)} className="grid h-9 w-9 place-items-center rounded-full border border-white/20">‹</button>
            <span className="tabular-nums">{String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
            <button type="button" aria-label={nextLabel} onClick={() => setI((i + 1) % slides.length)} className="grid h-9 w-9 place-items-center rounded-full border border-white/20">›</button>
          </div>
        </div>
      )}
    </section>
  );
}

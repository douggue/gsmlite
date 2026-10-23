"use client";
import { useEffect, useState } from "react";

/** Tabs for a long editor: every panel stays on the page (forms keep what was typed), only one is shown. */
export function EditorTabs({ tabs }: { tabs: { key: string; label: string; badge?: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (tabs.some((t) => t.key === h)) setActive(h);
  }, [tabs]);
  const pick = (k: string) => {
    setActive(k);
    history.replaceState(null, "", `#${k}`);
  };
  return (
    <div>
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => pick(t.key)}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${active === t.key ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}>
            {t.label}
            {t.badge && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] text-warning">{t.badge}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => <div key={t.key} role="tabpanel" className={active === t.key ? "" : "hidden"}>{t.content}</div>)}
    </div>
  );
}

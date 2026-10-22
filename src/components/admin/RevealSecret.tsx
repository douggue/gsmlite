"use client";
import { useState, useTransition } from "react";

/** "Show password" for a remote job: the server logs who looked. */
export function RevealSecret({ action }: { action: () => Promise<{ ok: true; value: string } | { ok: false; error: string }> }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (value) return <span className="font-mono font-semibold select-all">{value}</span>;
  return (
    <>
      <button type="button" disabled={pending} className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold"
        onClick={() => start(async () => { const r = await action(); if (r.ok) setValue(r.value); else setError(r.error); })}>
        {pending ? "…" : "Show (logged)"}
      </button>
      {error && <span className="ml-2 text-xs text-danger">{error}</span>}
    </>
  );
}

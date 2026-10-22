"use client";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { SearchIcon } from "../Icons";

/** Searches services, or opens the IMEI check when the visitor pastes an IMEI (14–17 digits, spaces allowed). */
export function SearchBox({ placeholder, label, buttonLabel, variant = "light", defaultValue = "", id = "q" }: {
  placeholder: string; label?: string; buttonLabel: string; variant?: "light" | "dark"; defaultValue?: string; id?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const go = () => {
    const v = q.trim();
    if (!v) return;
    const digits = v.replace(/[\s-]/g, "");
    if (/^\d{14,17}$/.test(digits)) router.push(`/check?imei=${digits}`);
    else router.push(`/store?q=${encodeURIComponent(v)}`);
  };
  const dark = variant === "dark";
  return (
    <form role="search" className="min-w-0" onSubmit={(e) => { e.preventDefault(); go(); }}>
      {label && <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold">{label}</label>}
      <div className="flex gap-2">
        <input
          id={id}
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={label ? undefined : placeholder}
          className={dark
            ? "h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-[#9aa197] focus:border-[#7ce0a8] focus:outline-none"
            : "h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-[#111418] bg-white px-3.5 text-base text-[#111418] placeholder:text-[#7a8077] focus:outline-none focus:ring-2 focus:ring-primary dark:border-border dark:bg-surface dark:text-text"}
        />
        {!dark && (
          <button type="submit" aria-label={buttonLabel} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#111418] text-white dark:bg-primary">
            <SearchIcon width={20} height={20} />
          </button>
        )}
      </div>
    </form>
  );
}

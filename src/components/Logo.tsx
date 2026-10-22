/** Uploaded logo (Settings → Brand images) or the built-in GSMLite logo (open-lock mark + wordmark). */
export function Logo({ className = "", src, darkSrc, alt = "GSMLite" }: { className?: string; src?: string; darkSrc?: string; alt?: string }) {
  if (src) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={`h-8 w-auto max-w-[160px] object-contain ${darkSrc ? "dark:hidden" : ""}`} />
        {darkSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={darkSrc} alt={alt} className="hidden h-8 w-auto max-w-[160px] object-contain dark:block" />
        )}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="img" aria-label={alt}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span aria-hidden className="font-display text-[1.35rem] font-extrabold leading-none tracking-tight max-[349px]:hidden">
        GSM<span className="text-[#1F7A4D] dark:text-[#7CE0A8]">Lite</span>
      </span>
    </span>
  );
}

/** The open lock on its ink tile (also the app icon, public/icon.svg). */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="24" fill="#111418" />
      <path d="M36 46V36a14 14 0 0 1 26.5-6.3" fill="none" stroke="#7CE0A8" strokeWidth="8" strokeLinecap="round" />
      <rect x="26" y="46" width="48" height="34" rx="8" fill="#7CE0A8" />
      <circle cx="50" cy="60" r="5" fill="#111418" />
      <rect x="47.5" y="61" width="5" height="10" rx="2.5" fill="#111418" />
    </svg>
  );
}

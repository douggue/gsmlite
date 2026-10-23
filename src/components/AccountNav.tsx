"use client";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { SignOutButton } from "./HeaderClient";
import { BagIcon, BellIcon, ChatIcon, GiftIcon, HomeIcon, MenuIcon, PlusIcon, ReceiptIcon, ShieldIcon, StoreIcon, UserIcon, WalletIcon, CheckListIcon, KeyIcon } from "./Icons";

const ICONS = { home: HomeIcon, orders: ReceiptIcon, store: StoreIcon, wallet: WalletIcon, add: PlusIcon, gift: GiftIcon, user: UserIcon, kyc: CheckListIcon, bell: BellIcon, chat: ChatIcon, security: KeyIcon, privacy: ShieldIcon };
export type AccountNavGroup = { label: string; items: { href: string; label: string; icon: keyof typeof ICONS }[] };

const FOLD = "gl_account_nav_folded";

/**
 * Account menu. Laptop: dark sidebar (Place an order on top, Store / Wallet / Account groups, user at the bottom) that folds to icons.
 * Phone: a scrollable row of links under the site header; the site's bottom bar stays.
 */
export function AccountNav({ groups, user, placeOrder, foldLabel }: { groups: AccountNavGroup[]; user: { name: string; email: string }; placeOrder: string; foldLabel: string }) {
  const pathname = usePathname();
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try { setFolded(localStorage.getItem(FOLD) === "1"); } catch {}
  }, []);
  const fold = () => {
    setFolded((f) => {
      try { localStorage.setItem(FOLD, f ? "0" : "1"); } catch {}
      return !f;
    });
  };
  const all = groups.flatMap((g) => g.items);
  // Longest matching link wins, so /account/wallet/deposit lights "Add credit", not "Wallet".
  const current = all.filter((i) => (i.href === "/account" ? pathname === "/account" : pathname === i.href || pathname.startsWith(i.href + "/"))).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <nav aria-label="Account" className="-mx-4 min-w-0 lg:hidden">
        <ul className="flex gap-1.5 overflow-x-auto px-4 pb-1">
          {all.map((i) => (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} aria-current={current === i.href ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-xl px-3.5 text-sm font-semibold ${current === i.href ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface text-muted"}`}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <aside aria-label="Account" className={`sticky top-20 hidden h-[calc(100dvh-6rem)] shrink-0 flex-col gap-3 overflow-y-auto rounded-3xl bg-[#111418] p-3 text-white transition-[width] lg:flex ${folded ? "w-[72px]" : "w-60"}`}>
        <div className={`flex items-center ${folded ? "justify-center" : "justify-end"}`}>
          <button type="button" onClick={fold} aria-label={foldLabel} aria-pressed={folded} title={foldLabel} className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
            <MenuIcon width={18} height={18} />
          </button>
        </div>
        <Link href="/store" title={placeOrder} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#7ce0a8] font-bold text-[#0b2a1b] hover:bg-[#9aeabd] ${folded ? "px-0" : "px-4"}`}>
          <BagIcon width={18} height={18} />{!folded && placeOrder}
        </Link>
        {groups.map((g) => (
          <div key={g.label}>
            {!folded && <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-white/40">{g.label}</p>}
            {folded && <hr className="mx-2 my-2 border-white/10" />}
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const Icon = ICONS[i.icon];
                const on = current === i.href;
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={on ? "page" : undefined} title={folded ? i.label : undefined}
                      className={`flex min-h-10 items-center gap-3 rounded-xl text-sm font-medium ${folded ? "justify-center" : "px-3"} ${on ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
                      <span className={on ? "text-[#7ce0a8]" : ""}><Icon width={18} height={18} /></span>
                      {!folded && <span className="truncate">{i.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className={`mt-auto flex items-center gap-2 rounded-2xl bg-white/5 p-2 ${folded ? "flex-col" : ""}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#7ce0a8]/20 text-sm font-bold text-[#7ce0a8]">{user.name.charAt(0).toUpperCase()}</span>
          {!folded && <span className="min-w-0 flex-1"><b className="block truncate text-sm">{user.name}</b><span className="block truncate text-xs text-white/50">{user.email}</span></span>}
          <SignOutButton className="grid h-9 min-h-0 w-9 place-items-center rounded-lg p-0 text-white/60 hover:bg-white/10 hover:text-white" iconOnly />
        </div>
      </aside>
    </>
  );
}

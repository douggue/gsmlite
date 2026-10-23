"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { activeItem, type MenuGroup } from "@/lib/admin-menu";
import { AdminIcon } from "./AdminIcons";

export type ShellGroup = Omit<MenuGroup, "items"> & { items: (MenuGroup["items"][number] & { badge?: number })[] };
export type ShellTodo = { label: string; href: string; count: number; alert?: boolean };
type Props = {
  groups: ShellGroup[];
  user: { name: string; role: string };
  todo: ShellTodo[];
  suppliers: { name: string; balance: number | null; currency: string | null; low: boolean }[];
  quick: { label: string; href: string }[];
  children: React.ReactNode;
};

const usd = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function usePersisted(key: string, initial: boolean) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s != null) setV(s === "1");
    } catch {}
  }, [key]);
  const set = (next: boolean) => {
    setV(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {}
  };
  return [v, set] as const;
}

/** Closes a popover when clicking elsewhere or pressing Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  return { open, setOpen, ref };
}

/**
 * Admin layout: dark menu on the left in 10 groups (folds to icons), a top bar with search, to-do bell,
 * supplier balances and quick actions, tabs for the pages of the current group, and a bottom bar + menu sheet on phones.
 */
export function AdminShell({ groups, user, todo, suppliers, quick, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const current = activeItem(pathname, groups);
  const [folded, setFolded] = usePersisted("gl_admin_nav_folded", false);
  const [sheet, setSheet] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  useEffect(() => setSheet(false), [pathname]);
  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("gl_admin_theme", next ? "dark" : "light");
    } catch {}
  };
  const signOut = async () => {
    await authClient.signOut();
    router.push("/admin/login");
  };
  const isOpen = (g: ShellGroup) => openGroups[g.key] ?? current?.group.key === g.key;
  const groupBadge = (g: ShellGroup) => g.items.reduce((n, i) => n + (i.badge ?? 0), 0);
  const groupAlert = (g: ShellGroup) => g.items.some((i) => i.alert && i.badge);
  const todoTotal = todo.reduce((n, t) => n + t.count, 0);
  const initials = user.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "GL";
  const lowSupplier = suppliers.some((s) => s.low);

  const badge = (n: number, alert?: boolean) =>
    n > 0 ? <span className={`ml-auto rounded-full px-2 py-px text-[11px] font-bold ${alert ? "bg-[#fcebdd] text-[#8a3607]" : "bg-[#7ce0a8] text-[#0b2a1a]"}`}>{n}</span> : null;

  const menu = (mode: "side" | "sheet") => (
    <nav aria-label="Admin" className="flex flex-col gap-0.5">
      {groups.map((g) => {
        const active = current?.group.key === g.key;
        const single = g.items.length === 1;
        const showLabels = mode === "sheet" || !folded;
        const head = (
          <>
            <span className="grid h-8 w-8 shrink-0 place-items-center"><AdminIcon name={g.icon} width={19} height={19} /></span>
            {showLabels && <span className="min-w-0 flex-1 truncate text-left">{g.label}</span>}
            {showLabels ? badge(groupBadge(g), groupAlert(g)) : groupBadge(g) > 0 && <span className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${groupAlert(g) ? "bg-[#f59e3b]" : "bg-[#7ce0a8]"}`} />}
          </>
        );
        const cls = `relative flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-[14px] font-semibold transition-colors ${active ? "bg-[#1f7a4d] text-white" : "text-[#c9cfc6] hover:bg-white/[0.07] hover:text-white"}`;
        return (
          <div key={g.key}>
            {single || (mode === "side" && folded) ? (
              <Link href={g.items[0].href} className={cls} title={folded && mode === "side" ? g.label : undefined} aria-current={active ? "page" : undefined}>{head}</Link>
            ) : (
              <button type="button" className={cls} aria-expanded={isOpen(g)} onClick={() => setOpenGroups({ ...openGroups, [g.key]: !isOpen(g) })}>
                {head}
                <AdminIcon name="chevron" width={15} height={15} className={`shrink-0 transition-transform ${isOpen(g) ? "rotate-90" : ""}`} />
              </button>
            )}
            {!single && isOpen(g) && showLabels && (
              <ul className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                {g.items.map((i) => {
                  const on = current?.item.href === i.href;
                  return (
                    <li key={i.href}>
                      <Link href={i.href} aria-current={on ? "page" : undefined}
                        className={`flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] ${on ? "bg-white/[0.1] font-semibold text-white" : "text-[#aab1a7] hover:text-white"}`}>
                        <span className="min-w-0 flex-1 truncate">{i.label}</span>
                        {badge(i.badge ?? 0, i.alert)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  const quickMenu = usePopover();
  const bell = usePopover();
  const bal = usePopover();
  const userMenu = usePopover();
  const pop = "absolute right-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 text-text shadow-2xl";

  const quickAdd = (
    <div ref={quickMenu.ref} className="relative">
      <button type="button" onClick={() => quickMenu.setOpen(!quickMenu.open)} aria-expanded={quickMenu.open}
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7ce0a8] px-3 text-sm font-bold text-[#0b2a1a] hover:brightness-105 ${folded ? "w-11" : "w-full"}`} title="Quick add">
        <AdminIcon name="plus" width={18} height={18} />{!folded && "Quick add"}
      </button>
      {quickMenu.open && (
        <div className={`${pop} left-0 right-auto`}>
          {quick.map((q) => <Link key={q.href} href={q.href} onClick={() => quickMenu.setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-2">{q.label}</Link>)}
        </div>
      )}
    </div>
  );

  const tabs = current && current.group.items.length > 1 && (
    <div className="-mx-4 -mt-4 mb-6 overflow-x-auto border-b border-border bg-surface px-4 sm:-mx-6 sm:-mt-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8">
      <nav aria-label={current.group.label} className="flex gap-1">
        {current.group.items.map((i) => {
          const on = current.item.href === i.href;
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
              className={`relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold ${on ? "text-text after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary" : "text-muted hover:text-text"}`}>
              {i.label}{!!i.badge && <span className={`rounded-full px-1.5 text-[11px] ${i.alert ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}>{i.badge}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg lg:flex">
      {/* ─── Desktop menu ─── */}
      <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-3 overflow-y-auto bg-[#111418] p-3 text-white transition-[width] lg:flex ${folded ? "w-[76px]" : "w-64"}`}>
        <div className={`flex items-center gap-2 px-1.5 pt-1 ${folded ? "justify-center" : ""}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7ce0a8] text-[13px] font-black text-[#0b2a1a]">GL</span>
          {!folded && <Link href="/admin" className="display text-[17px] font-extrabold leading-tight">GSM<span className="text-[#7ce0a8]">Lite</span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d847a]">Admin</span></Link>}
        </div>
        {quickAdd}
        {menu("side")}
        <div className={`mt-auto flex items-center gap-2.5 border-t border-white/10 px-1 pt-3 ${folded ? "justify-center" : ""}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.1] text-xs font-bold">{initials}</span>
          {!folded && <span className="min-w-0"><b className="block truncate text-sm">{user.name}</b><span className="block text-[11px] uppercase tracking-wider text-[#7d847a]">{user.role.replace(/_/g, " ").toLowerCase()}</span></span>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ─── Top bar ─── */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:px-4 lg:px-6">
          <button type="button" onClick={() => setFolded(!folded)} className="hidden h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 lg:grid" aria-label={folded ? "Open the menu" : "Fold the menu"}>
            <AdminIcon name="panel" width={19} height={19} />
          </button>
          <Link href="/admin" className="display text-lg font-extrabold lg:hidden">GSM<span className="text-primary">Lite</span></Link>
          <form action="/admin/search" className="ml-auto hidden max-w-md flex-1 sm:block lg:ml-0">
            <label className="relative block">
              <span className="sr-only">Search</span>
              <AdminIcon name="search" width={17} height={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input name="q" placeholder="Order #, IMEI, customer, service…" className="input min-h-10 pl-9" autoComplete="off" />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/admin/search" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 sm:hidden" aria-label="Search"><AdminIcon name="search" width={19} height={19} /></Link>
            {suppliers.length > 0 && (
              <div ref={bal.ref} className="relative hidden sm:block">
                <button type="button" onClick={() => bal.setOpen(!bal.open)} className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${lowSupplier ? "border-warning/50 text-warning" : "border-border"}`}>
                  <AdminIcon name="/admin/suppliers" width={16} height={16} />
                  {suppliers.length === 1 ? usd(suppliers[0].balance) : `${suppliers.length} suppliers`}
                  {lowSupplier && <span className="h-2 w-2 rounded-full bg-warning" />}
                </button>
                {bal.open && (
                  <div className={pop}>
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Supplier balances</p>
                    {suppliers.map((s) => (
                      <Link key={s.name} href="/admin/suppliers" onClick={() => bal.setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2">
                        <span className="truncate">{s.name}</span><b className={s.low ? "text-warning" : ""}>{usd(s.balance)}</b>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div ref={bell.ref} className="relative">
              <button type="button" onClick={() => bell.setOpen(!bell.open)} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2" aria-label={`To do: ${todoTotal}`}>
                <AdminIcon name="bell" width={19} height={19} />
                {todoTotal > 0 && <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-warning px-1 text-[10px] font-bold text-[#0b0e10]">{todoTotal}</span>}
              </button>
              {bell.open && (
                <div className={pop}>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Needs you</p>
                  {todoTotal === 0 && <p className="px-3 py-3 text-sm text-muted">Nothing waiting. 👌</p>}
                  {todo.filter((t) => t.count > 0).map((t) => (
                    <Link key={t.href} href={t.href} onClick={() => bell.setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2">
                      <span>{t.label}</span><b className={t.alert ? "text-warning" : "text-primary"}>{t.count}</b>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div ref={userMenu.ref} className="relative">
              <button type="button" onClick={() => userMenu.setOpen(!userMenu.open)} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-xs font-bold" aria-label="Account">{initials}</button>
              {userMenu.open && (
                <div className={pop}>
                  <p className="px-3 pt-2 text-sm font-bold">{user.name}</p>
                  <p className="px-3 pb-2 text-xs text-muted">{user.role.replace(/_/g, " ").toLowerCase()}</p>
                  <button type="button" onClick={toggleTheme} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface-2"><AdminIcon name={dark ? "sun" : "moon"} width={17} height={17} />{dark ? "Light mode" : "Dark mode"}</button>
                  <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2"><AdminIcon name="eye" width={17} height={17} />View the store</a>
                  <button type="button" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-danger-soft"><AdminIcon name="logout" width={17} height={17} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-main min-w-0 flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8">
          {tabs}
          {children}
        </main>
      </div>

      {/* ─── Phone: bottom bar + menu sheet ─── */}
      <nav aria-label="Quick admin navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <ul className="grid h-16 grid-cols-5">
          {(["home", "orders", "money", "customers"] as const).map((k) => {
            const g = groups.find((x) => x.key === k);
            if (!g) return <li key={k} />;
            const on = current?.group.key === k;
            const n = groupBadge(g);
            return (
              <li key={k} className="min-w-0">
                <Link href={g.items[0].href} aria-current={on ? "page" : undefined} className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? "text-primary" : "text-muted"}`}>
                  <span className={`relative grid h-7 w-11 place-items-center rounded-full ${on ? "bg-primary-soft" : ""}`}>
                    <AdminIcon name={g.icon} width={19} height={19} />
                    {n > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-bold text-[#0b0e10]">{n}</span>}
                  </span>
                  <span className="max-w-full truncate px-1">{k === "home" ? "Home" : g.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setSheet(true)} className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted">
              <span className="grid h-7 w-11 place-items-center"><AdminIcon name="/admin/navigation" width={19} height={19} /></span>
              Menu
            </button>
          </li>
        </ul>
      </nav>
      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-[#111418] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-3 grid grid-cols-2 gap-2">
              {quick.slice(0, 4).map((q) => <Link key={q.href} href={q.href} className="flex min-h-11 items-center justify-center rounded-xl bg-white/[0.08] px-2 text-center text-[13px] font-semibold">{q.label}</Link>)}
            </div>
            {menu("sheet")}
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-[12px] font-semibold">
              <button type="button" onClick={toggleTheme} className="min-h-11 rounded-xl bg-white/[0.06]">{dark ? "Light" : "Dark"}</button>
              <a href="/" target="_blank" rel="noreferrer" className="grid min-h-11 place-items-center rounded-xl bg-white/[0.06]">Store</a>
              <button type="button" onClick={signOut} className="min-h-11 rounded-xl bg-white/[0.06] text-[#ff9b8a]">Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

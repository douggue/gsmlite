import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { formatPhone } from "@/lib/phone";
import { Empty, PageTitle, Table } from "@/components/admin/ui";

export const metadata = { title: "Customers" };

const SHOW = { all: "All", groups: "In a price group", restricted: "Restricted or suspended", staff: "Staff" } as const;
type Show = keyof typeof SHOW;

/** Customers: search, quick filters, and the facts staff look for first (group, status, orders). */
export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  await requireStaff("customers.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const show: Show = sp.show && sp.show in SHOW ? (sp.show as Show) : "all";
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    ...(show === "groups" ? { priceGroupId: { not: null } } : show === "restricted" ? { status: { in: ["RESTRICTED", "SUSPENDED", "CLOSED"] } } : show === "staff" ? { role: { not: "CUSTOMER" } } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { orders: true } }, priceGroup: { select: { name: true } } } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
  ]);
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, show: show === "all" ? undefined : show, ...p })) if (v) u.set(k, v);
    return `/admin/customers${u.size ? `?${u}` : ""}`;
  };
  return (
    <>
      <PageTitle title="Customers" sub={`${total} customer account${total === 1 ? "" : "s"}.`} />
      <form className="mb-3 flex max-w-xl gap-2">
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        <input name="q" defaultValue={q} placeholder="Name, email or phone" className="input min-h-11" aria-label="Search customers" />
        <button className="btn-primary min-h-11 px-5">Search</button>
      </form>
      <nav className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
        {(Object.keys(SHOW) as Show[]).map((f) => (
          <Link key={f} href={href({ show: f === "all" ? undefined : f })} className={`inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-sm font-semibold ${show === f ? "bg-[#111418] text-white dark:bg-primary" : "border border-border bg-surface"}`}>{SHOW[f]}</Link>
        ))}
      </nav>
      <Table head={["Customer", "Phone", "Prices", "Status", "Orders", "Joined"]} empty={users.length === 0}
        emptyText={<Empty title={q ? `No one matches “${q}”` : "No customers here yet"} hint={q ? "Try part of the email or the phone number." : "Accounts appear here as soon as people sign up."} />}>
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-surface-2">
            <td className="px-4 py-3"><Link href={`/admin/customers/${u.id}`} className="font-semibold text-primary">{u.name}</Link>{u.role !== "CUSTOMER" && <span className="ml-1.5 rounded-md bg-[#111418] px-1.5 py-0.5 text-[10px] font-bold text-white">STAFF</span>}<span className="block text-xs text-muted">{u.email}</span></td>
            <td className="px-4 py-3">{u.phone ? formatPhone(u.phone) : "—"}</td>
            <td className="px-4 py-3">{u.priceGroup ? <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{u.priceGroup.name}</span> : <span className="text-muted">Retail</span>}</td>
            <td className="px-4 py-3">{u.status === "ACTIVE" ? "Active" : <span className="font-semibold text-warning">{u.status.charAt(0) + u.status.slice(1).toLowerCase()}</span>}</td>
            <td className="px-4 py-3 tabular-nums">{u._count.orders}</td>
            <td className="px-4 py-3 text-muted">{u.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

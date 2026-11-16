import type { Prisma } from "@prisma/client";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/text";
import { StatusBadge } from "@/components/StatusBadge";

const FILTERS = ["all", "working", "done", "refunded"] as const;
type Filter = (typeof FILTERS)[number];
const PAGE = 30;

/** Line-level filter: an order shows under "working" if any IMEI is still waiting, etc. */
function filterWhere(f: Filter): Prisma.OrderWhereInput {
  if (f === "working") return { items: { some: { status: "PENDING" } }, status: { notIn: ["CANCELED", "FAILED", "REFUNDED"] } };
  if (f === "done") return { items: { some: { status: "DELIVERED" } } };
  if (f === "refunded") return { OR: [{ items: { some: { status: "FAILED" } } }, { status: { in: ["REFUNDED", "CANCELED"] } }] };
  return {};
}

/**
 * My orders, built for technicians: search by IMEI, order number or note; filters by line status;
 * each row says how many IMEIs are done / working / refunded; "Order again" and a CSV download.
 */
export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; f?: string; n?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const f: Filter = FILTERS.includes(sp.f as Filter) ? (sp.f as Filter) : "all";
  const take = Math.min(300, Math.max(PAGE, Number(sp.n) || PAGE));
  const digits = q.replace(/\D/g, "");
  const search: Prisma.OrderWhereInput = q
    ? {
        OR: [
          ...(digits && digits.length <= 9 ? [{ number: Number(digits) }] : []),
          ...(digits.length >= 4 ? [{ items: { some: { identifier: { contains: digits } } } }] : []),
          { recipientNote: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const where: Prisma.OrderWhereInput = { userId: user.id, AND: [search, filterWhere(f)] };
  const [tc, to, ta, fmt, orders, total] = await Promise.all([
    getTranslations("common"),
    getTranslations("order"),
    getTranslations("account"),
    getFormatter(),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      include: { items: { select: { id: true, status: true, identifier: true, quantity: true, productName: true, variantName: true, variantId: true, variant: { select: { product: { select: { slug: true } } } } } } },
    }),
    prisma.order.count({ where: { userId: user.id } }),
  ]);
  const more = orders.length > take;
  const list = orders.slice(0, take);
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, f: f === "all" ? undefined : f, ...p })) if (v) u.set(k, v);
    return `/account/orders${u.size ? `?${u}` : ""}`;
  };
  const csv = `/api/account/orders.csv${q || f !== "all" ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(f !== "all" ? { f } : {}) })}` : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ta("myOrders")}</h1>
        {total > 0 && <a href={csv} className="btn-secondary min-h-10 px-3.5 text-sm" download>{ta("exportCsv")}</a>}
      </div>

      {total > 0 && (
        <>
          <form className="mt-4 flex gap-2" role="search">
            {f !== "all" && <input type="hidden" name="f" value={f} />}
            <input name="q" defaultValue={q} placeholder={ta("ordersSearch")} aria-label={ta("ordersSearch")} className="input min-h-11 flex-1" inputMode="search" />
            <button className="btn-primary min-h-11 px-4">{tc("search")}</button>
          </form>
          <nav aria-label={ta("ordersFilter")} className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((x) => (
              <Link key={x} href={href({ f: x === "all" ? undefined : x, n: undefined })} aria-current={f === x ? "page" : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-xl px-3.5 text-sm font-semibold ${f === x ? "bg-[#0f1b3d] text-white dark:bg-primary" : "border border-border bg-surface"}`}>
                {ta(`filter.${x}`)}
              </Link>
            ))}
          </nav>
        </>
      )}

      {list.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-muted">{total === 0 ? ta("noOrders") : ta("noMatch")}</div>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((o) => {
            const done = o.items.filter((i) => i.status === "DELIVERED").length;
            const refunded = o.items.filter((i) => i.status === "FAILED").length;
            const working = o.items.length - done - refunded;
            // "iPhone USA AT&T unlock — Clean × 3" instead of the same title repeated per IMEI.
            const titles = new Map<string, number>();
            for (const i of o.items) {
              const name = [t(i.productName, locale), t(i.variantName, locale)].filter(Boolean).join(" — ");
              titles.set(name, (titles.get(name) ?? 0) + (i.identifier ? 1 : i.quantity));
            }
            const title = [...titles].map(([n, c]) => (c > 1 ? `${n} × ${c}` : n)).join(", ");
            const imeis = o.items.map((i) => i.identifier).filter(Boolean) as string[];
            const first = o.items[0];
            const againIds = imeis.length ? `&ids=${imeis.join(",")}` : "";
            return (
              <li key={o.id} className="card p-4">
                <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-semibold" dir="auto">{title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      #{o.number} · {fmt.dateTime(o.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                      {imeis.length > 0 && <> · <span className="font-mono">…{imeis[0].slice(-6)}{imeis.length > 1 ? ` +${imeis.length - 1}` : ""}</span></>}
                    </span>
                    {o.recipientNote && <span className="mt-1 block truncate text-sm">“{o.recipientNote}”</span>}
                  </span>
                  <span className="text-right">
                    <b className="block tabular-nums">{formatMoney(o.total, o.currency, locale)}</b>
                    {o.items.length > 1 || ["PAID", "PROCESSING", "FULFILLED"].includes(o.status) ? (
                      <span className="mt-1 flex flex-wrap justify-end gap-1">
                        {done > 0 && <span className="badge bg-success-soft text-success">{ta("linesDone", { n: done })}</span>}
                        {working > 0 && <span className="badge bg-primary-soft text-primary">{ta("linesWorking", { n: working })}</span>}
                        {refunded > 0 && <span className="badge bg-surface-2 text-muted">{ta("linesRefunded", { n: refunded })}</span>}
                      </span>
                    ) : (
                      <span className="mt-1 inline-block"><StatusBadge status={o.status} label={to(`status.${o.status}`)} /></span>
                    )}
                  </span>
                </Link>
                {first?.variant && (
                  <div className="mt-3 flex justify-end border-t border-border pt-3">
                    <Link href={`/products/${first.variant.product.slug}?variant=${first.variantId}${againIds}`} className="btn-secondary min-h-10 px-3.5 text-sm">{ta("orderAgain")}</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {more && <Link href={href({ n: String(take + PAGE) })} className="btn-secondary mt-4 min-h-11 w-full" scroll={false}>{ta("showMore")}</Link>}
    </div>
  );
}

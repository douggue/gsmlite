import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import { ago } from "@/lib/ago";
import { ensureKycDefaults, type Requirement } from "@/lib/kyc";
import { approveKyc, decideKyc } from "@/actions/kyc-admin";
import { ActionButton } from "@/components/admin/ActionButton";
import { Empty, PageTitle } from "@/components/admin/ui";

export const metadata = { title: "KYC review" };

/** KYC review (mockup): waiting list on the left, the selected request with its documents on the right. */
export default async function KycPage({ searchParams }: { searchParams: Promise<{ id?: string; show?: string }> }) {
  const staff = await requireStaff("kyc.review");
  await ensureKycDefaults();
  const sp = await searchParams;
  const status = sp.show === "done" ? { in: ["APPROVED", "REJECTED", "NEEDS_MORE"] as ("APPROVED" | "REJECTED" | "NEEDS_MORE")[] } : "PENDING" as const;
  const list = await prisma.kycSubmission.findMany({
    where: { status },
    include: { user: { select: { name: true } }, level: { select: { name: true } } },
    orderBy: { createdAt: sp.show === "done" ? "desc" : "asc" },
    take: 100,
  });
  const selected = sp.id ?? list[0]?.id;
  const s = selected
    ? await prisma.kycSubmission.findUnique({
        where: { id: selected },
        include: {
          level: true,
          user: { select: { id: true, name: true, email: true, phone: true, createdAt: true, _count: { select: { orders: true } } } },
          documents: { where: { deletedAt: null }, include: { views: { where: { staffId: staff.id }, take: 1 } } },
        },
      })
    : null;
  const otherIds = s
    ? (await prisma.deviceSeen.findMany({
        where: { deviceId: { in: (await prisma.deviceSeen.findMany({ where: { userId: s.user.id }, select: { deviceId: true } })).map((d) => d.deviceId) }, userId: { not: s.user.id } },
        select: { userId: true },
        distinct: ["userId"],
        take: 5,
      })).map((d) => d.userId)
    : [];
  const sameDevice = (await prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, name: true } })).map((user) => ({ user }));
  const reqs = s ? ((s.level.requirements as Requirement[]) ?? []) : [];

  return (
    <>
      <PageTitle
        title="KYC review"
        sub="Documents are encrypted. Every time you open one, it is written to the audit log."
        actions={<Link href="/admin/kyc/settings" className="btn-secondary min-h-10 px-4">Levels & rules</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <section className="card h-fit overflow-hidden">
          <div className="flex gap-1 border-b border-border p-2 text-sm">
            <Link href="/admin/kyc" className={`rounded-lg px-3 py-1.5 font-semibold ${sp.show !== "done" ? "bg-[#111418] text-white" : ""}`}>Waiting</Link>
            <Link href="/admin/kyc?show=done" className={`rounded-lg px-3 py-1.5 font-semibold ${sp.show === "done" ? "bg-[#111418] text-white" : ""}`}>Decided</Link>
          </div>
          {list.length === 0 && <Empty title="Nothing waiting" hint="Identity checks customers send show here." />}
          {list.map((x) => (
            <Link key={x.id} href={`/admin/kyc?id=${x.id}${sp.show ? `&show=${sp.show}` : ""}`} className={`block border-b border-border px-4 py-3 text-sm last:border-0 ${x.id === selected ? "bg-primary-soft" : "hover:bg-surface-2"}`}>
              <b className="block">{x.user.name}</b>
              <span className="text-muted">{t(x.level.name, "en")} · {x.status === "PENDING" ? ago(x.createdAt) : x.status.replace("_", " ").toLowerCase()}</span>
            </Link>
          ))}
        </section>

        {s && (
          <section className="card space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">{s.user.name} · asks for {t(s.level.name, "en")}</h2>
              <p className="text-sm text-muted">
                <Link href={`/admin/customers/${s.user.id}`} className="text-primary">{s.user.email}</Link>{s.user.phone ? ` · ${s.user.phone}` : ""} · account {ago(s.user.createdAt).replace(" ago", "")} old · {s.user._count.orders} orders
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {s.documents.map((d) => (
                <figure key={d.id} className="overflow-hidden rounded-xl border border-border">
                  {d.mime.startsWith("image/") ? (
                    <a href={`/api/admin/kyc/doc/${d.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/kyc/doc/${d.id}`} alt={d.kind} className="aspect-[4/3] w-full bg-surface-2 object-contain" loading="lazy" />
                    </a>
                  ) : (
                    <a href={`/api/admin/kyc/doc/${d.id}`} target="_blank" rel="noreferrer" className="grid aspect-[4/3] place-items-center bg-surface-2 text-sm font-semibold text-primary">Open {d.mime.split("/")[1].toUpperCase()}</a>
                  )}
                  <figcaption className="px-3 py-2 text-xs">
                    <b>{reqs.find((r) => r.type === d.kind)?.label.en ?? d.kind}</b>
                    <span className="block text-muted">{d.views.length ? "Opened by you · logged" : "Opening it is logged"}</span>
                  </figcaption>
                </figure>
              ))}
              {s.documents.length === 0 && <p className="text-sm text-muted">No documents.</p>}
            </div>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
              {Object.entries((s.answers ?? {}) as Record<string, string>).map(([i, v]) => (
                <div key={i} className="contents">
                  <dt className="text-muted">{reqs[Number(i)]?.label.en ?? "Answer"}</dt><dd className="whitespace-pre-wrap">{v}</dd>
                </div>
              ))}
              <dt className="text-muted">Same device as</dt>
              <dd>{sameDevice.length ? sameDevice.map((d) => <Link key={d.user.id} href={`/admin/customers/${d.user.id}`} className="mr-2 text-warning">{d.user.name}</Link>) : "No other account"}</dd>
            </dl>
            {s.status === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <ActionButton label={`Approve${s.level.joinsGroupId ? " · join price group" : ""}`} className="btn-primary min-h-11 px-4" action={approveKyc.bind(null, s.id)} />
                <ActionButton label="Ask for a new photo" prompt="What should the customer send again? (they will read this)" className="btn-secondary min-h-11 px-4" action={decideKyc.bind(null, s.id, "NEEDS_MORE")} />
                <ActionButton label="Reject with reason" prompt="Reason shown to the customer" className="btn-secondary min-h-11 px-4 text-danger" action={decideKyc.bind(null, s.id, "REJECTED")} />
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">{s.status.replace("_", " ")}{s.note ? `: ${s.note}` : ""}{s.reviewedAt ? ` · ${s.reviewedAt.toLocaleString("en-US")}` : ""}</p>
            )}
            <p className="text-xs text-muted">The customer gets a notification with your decision. Documents are deleted automatically some months after the account closes (Settings → KYC).</p>
          </section>
        )}
      </div>
    </>
  );
}

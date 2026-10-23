import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { Empty, PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Supplier logs" };

/** Last requests to one supplier (API key removed), to see exactly what they answered. */
export default async function SupplierLogs({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ errors?: string }> }) {
  await requireStaff("suppliers.manage");
  const { id } = await params;
  const onlyErrors = (await searchParams).errors === "1";
  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!supplier) notFound();
  const logs = await prisma.supplierLog.findMany({ where: { supplierId: id, ...(onlyErrors ? { ok: false } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageTitle
        title={`${supplier.name} · logs`}
        sub="The last 100 requests, kept 30 days. The API key is never stored."
        actions={<><Link href={`/admin/suppliers/${id}`} className="btn-secondary min-h-10 px-4">← {supplier.name}</Link><Link href={`/admin/suppliers/${id}/logs${onlyErrors ? "" : "?errors=1"}`} className="btn-secondary min-h-10 px-4">{onlyErrors ? "Show all" : "Only problems"}</Link></>}
      />
      <div className="space-y-2">
        {logs.map((l) => (
          <details key={l.id} className="card p-3 text-sm">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`badge ${l.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{l.ok ? "OK" : "Problem"}</span>
              <b>{l.action}</b>
              <span className="text-muted">{l.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "medium" })} · {l.ms} ms{l.httpStatus ? ` · HTTP ${l.httpStatus}` : ""}</span>
            </summary>
            <p className="mt-3 text-xs font-semibold text-muted">Sent</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-2 text-xs">{l.request}</pre>
            <p className="mt-2 text-xs font-semibold text-muted">Answer</p>
            <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-2 text-xs">{l.response || "—"}</pre>
          </details>
        ))}
        {logs.length === 0 && <div className="card">{onlyErrors
          ? <Empty title="No problems in the last 30 days" hint="Every call this supplier answered was readable." />
          : <Empty title="No calls in the last 30 days" hint="Each call to this supplier shows here: the test button, syncing the service list, sending an order and checking its status. Press Test on the supplier page to make one now." action={<Link href={`/admin/suppliers/${id}`} className="btn-secondary min-h-10 px-4">Open {supplier.name}</Link>} />}</div>}
      </div>
    </>
  );
}

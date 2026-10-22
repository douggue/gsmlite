import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { t } from "@/lib/text";
import type { FieldDef } from "@/lib/order-form";
import { FormBuilder } from "@/components/admin/FormBuilder";

export const metadata = { title: "Order form" };

export default async function OrderFormPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("catalog.manage");
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true, fulfillmentType: true, serviceType: true, fields: true } });
  if (!p) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/admin/products/${p.id}`} className="text-sm font-semibold text-primary">← {t(p.name, "en")} · {p.fulfillmentType === "SUPPLIER_API" ? "from a supplier" : "my own service"}</Link>
      <FormBuilder productId={p.id} initial={(p.fields ?? []) as FieldDef[]} fromSupplier={p.fulfillmentType === "SUPPLIER_API"} serviceType={p.serviceType} />
    </div>
  );
}

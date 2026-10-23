import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { ADMIN_MENU, type BadgeKey } from "@/lib/admin-menu";
import { supplierAttentionCount } from "@/lib/suppliers/attention";
import { AdminShell, type ShellGroup, type ShellTodo } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [payments, risks, processing, approvals, tickets, reviews, supplierIssues, kyc, drafts, suppliers] = await Promise.all([
    prisma.paymentIntent.count({ where: { status: "REVIEW" } }),
    prisma.riskFlag.count({ where: { status: "OPEN" } }),
    prisma.order.count({ where: { status: "PROCESSING" } }),
    prisma.pendingApproval.count({ where: { status: "PENDING" } }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.review.count({ where: { status: "pending" } }),
    supplierAttentionCount(),
    prisma.kycSubmission.count({ where: { status: "PENDING" } }),
    prisma.contentPage.count({ where: { status: "DRAFT" } }),
    can(user, "suppliers.manage") ? prisma.supplier.findMany({ where: { isEnabled: true }, select: { name: true, balance: true, currency: true, lowBalanceAlert: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const counts: Record<BadgeKey, number> = { processing, suppliers: supplierIssues, payments, kyc, tickets, risks, approvals, reviews, drafts };

  const groups: ShellGroup[] = ADMIN_MENU.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(user, i.perm)).map((i) => ({ ...i, badge: i.badgeKey ? counts[i.badgeKey] : undefined })),
  })).filter((g) => g.items.length > 0);

  const todo: ShellTodo[] = [
    { label: "Payments to check", href: "/admin/payments", count: can(user, "payments.review") ? payments : 0 },
    { label: "Supplier orders needing a decision", href: "/admin/suppliers", count: can(user, "suppliers.manage") ? supplierIssues : 0, alert: true },
    { label: "KYC requests", href: "/admin/kyc", count: can(user, "kyc.review") ? kyc : 0 },
    { label: "Orders held for a risk check", href: "/admin/risk", count: can(user, "risk.manage") ? risks : 0, alert: true },
    { label: "Approvals waiting", href: "/admin/approvals", count: can(user, "approvals.decide") ? approvals : 0 },
    { label: "Open support requests", href: "/admin/support", count: can(user, "support.manage") ? tickets : 0 },
    { label: "Content drafts to review", href: "/admin/content", count: can(user, "content.manage") ? drafts : 0 },
    { label: "Reviews to approve", href: "/admin/trust", count: can(user, "catalog.manage") ? reviews : 0 },
  ];

  const quick = [
    can(user, "catalog.manage") && { label: "New service", href: "/admin/products/new" },
    can(user, "suppliers.manage") && { label: "Import from a supplier", href: "/admin/suppliers" },
    can(user, "orders.view") && { label: "Orders to handle", href: "/admin/orders?show=decision" },
    can(user, "content.manage") && { label: "Post a tool update", href: "/admin/news/new?kind=tool" },
    can(user, "customers.view") && { label: "Find a customer", href: "/admin/customers" },
    can(user, "content.manage") && { label: "Start a deal", href: "/admin/marketing#deal" },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <AdminShell
      groups={groups}
      user={{ name: user.name, role: user.role }}
      todo={todo}
      suppliers={suppliers.map((s) => ({ name: s.name, balance: s.balance, currency: s.currency, low: s.balance != null && s.lowBalanceAlert > 0 && s.balance < s.lowBalanceAlert }))}
      quick={quick}
    >
      {children}
    </AdminShell>
  );
}

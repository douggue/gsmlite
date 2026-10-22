import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";
import { AdminNav } from "@/components/admin/AdminNav";
import { getSettings } from "@/lib/settings";
import { supplierAttentionCount } from "@/lib/suppliers/attention";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [settings, reviews, risks, processing, approvals, tickets, newReviews, supplierIssues, kycWaiting] = await Promise.all([
    getSettings(),
    prisma.paymentIntent.count({ where: { status: "REVIEW" } }),
    prisma.riskFlag.count({ where: { status: "OPEN" } }),
    prisma.order.count({ where: { status: "PROCESSING" } }),
    prisma.pendingApproval.count({ where: { status: "PENDING" } }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.review.count({ where: { status: "pending" } }),
    supplierAttentionCount(),
    prisma.kycSubmission.count({ where: { status: "PENDING" } }),
  ]);
  const all: { href: string; label: string; group: string; perm: Permission; badge?: number; alert?: boolean }[] = [
    { href: "/admin", label: "Dashboard", group: "", perm: "dashboard.view" },
    { href: "/admin/orders", label: "Orders", group: "Operations", perm: "orders.view", badge: processing },
    { href: "/admin/suppliers", label: "Suppliers", group: "Operations", perm: "suppliers.manage", badge: supplierIssues, alert: true },
    { href: "/admin/payments", label: "Payments", group: "Operations", perm: "payments.review", badge: reviews },
    { href: "/admin/kyc", label: "KYC review", group: "Operations", perm: "kyc.review", badge: kycWaiting },
    { href: "/admin/support", label: "Support", group: "Operations", perm: "support.manage", badge: tickets },
    { href: "/admin/risk", label: "Risk queue", group: "Operations", perm: "risk.manage", badge: risks, alert: true },
    { href: "/admin/approvals", label: "Approvals", group: "Operations", perm: "approvals.decide", badge: approvals },
    { href: "/admin/reconciliation", label: "Reconciliation", group: "Operations", perm: "payments.review" },
    { href: "/admin/products", label: "Services & prices", group: "Catalog", perm: "catalog.manage" },
    { href: "/admin/price-groups", label: "Price groups", group: "Catalog", perm: "catalog.manage" },
    { href: "/admin/codes", label: "Code inventory", group: "Catalog", perm: "codes.manage" },
    { href: "/admin/media", label: "Media", group: "Catalog", perm: "catalog.manage" },
    { href: "/admin/trust", label: "Reviews", group: "Catalog", perm: "catalog.manage", badge: newReviews },
    { href: "/admin/customers", label: "Customers", group: "Customers", perm: "customers.view" },
    { href: "/admin/wallet", label: "Ledger", group: "Customers", perm: "wallet.view" },
    { href: "/admin/referrals", label: "Referrals", group: "Customers", perm: "referrals.manage" },
    { href: "/admin/analytics", label: "Reports", group: "Customers", perm: "analytics.view" },
    { href: "/admin/marketing", label: "Marketing", group: "Growth", perm: "content.manage" },
    { href: "/admin/content", label: "Content machine", group: "Growth", perm: "seo.manage" },
    { href: "/admin/news", label: "News & tool updates", group: "Growth", perm: "content.manage" },
    { href: "/admin/homepage", label: "Homepage", group: "Growth", perm: "content.manage" },
    { href: "/admin/pages", label: "Pages", group: "Growth", perm: "content.manage" },
    { href: "/admin/navigation", label: "Menus", group: "Growth", perm: "content.manage" },
    { href: "/admin/newsletter", label: "Newsletter", group: "Growth", perm: "content.manage" },
    { href: "/admin/seo", label: "SEO & redirects", group: "Growth", perm: "seo.manage" },
    { href: "/admin/settings", label: "Settings", group: "Settings & staff", perm: "settings.manage" },
    { href: "/admin/payment-methods", label: "Payment methods", group: "Settings & staff", perm: "settings.manage" },
    { href: "/admin/appearance", label: "Appearance", group: "Settings & staff", perm: "content.manage" },
    { href: "/admin/translations", label: "Translations", group: "Settings & staff", perm: "content.manage" },
    { href: "/admin/exchange", label: "Money exchange", group: "Settings & staff", perm: "settings.manage" },
    { href: "/admin/email", label: "Email", group: "Settings & staff", perm: "settings.manage" },
    { href: "/admin/staff", label: "Staff & roles", group: "Settings & staff", perm: "staff.manage" },
    { href: "/admin/security", label: "Security", group: "Settings & staff", perm: "staff.manage" },
    { href: "/admin/audit", label: "Audit log", group: "Settings & staff", perm: "audit.view" },
  ];
  return (
    <div className="lg:flex">
      <AdminNav items={all.filter((i) => can(user, i.perm))} user={{ name: user.name, role: user.role }} logo={settings.logoDarkUrl || settings.logoUrl} />
      <main className="admin-main min-w-0 flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8">{children}</main>
    </div>
  );
}

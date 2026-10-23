import type { Permission } from "./permissions";

export type MenuItem = { href: string; label: string; perm: Permission; badgeKey?: BadgeKey; alert?: boolean };
export type MenuGroup = { key: string; label: string; icon: string; items: MenuItem[] };
export type BadgeKey = "processing" | "suppliers" | "payments" | "kyc" | "tickets" | "risks" | "approvals" | "reviews" | "drafts";

/**
 * The admin in 10 groups. A group with several pages opens in the menu and shows its pages as tabs at the top,
 * so related screens (all the money screens, all the website screens…) live in one place.
 */
export const ADMIN_MENU: MenuGroup[] = [
  { key: "home", label: "Dashboard", icon: "/admin", items: [{ href: "/admin", label: "Dashboard", perm: "dashboard.view" }] },
  { key: "orders", label: "Orders", icon: "/admin/orders", items: [{ href: "/admin/orders", label: "Orders", perm: "orders.view", badgeKey: "processing" }] },
  { key: "suppliers", label: "Suppliers", icon: "/admin/suppliers", items: [{ href: "/admin/suppliers", label: "Suppliers", perm: "suppliers.manage", badgeKey: "suppliers", alert: true }] },
  {
    key: "catalog", label: "Services", icon: "/admin/products", items: [
      { href: "/admin/products", label: "Services & prices", perm: "catalog.manage" },
      { href: "/admin/price-groups", label: "Price groups", perm: "catalog.manage" },
      { href: "/admin/codes", label: "License keys", perm: "codes.manage" },
      { href: "/admin/media", label: "Images", perm: "catalog.manage" },
    ],
  },
  {
    key: "customers", label: "Customers", icon: "/admin/customers", items: [
      { href: "/admin/customers", label: "Customers", perm: "customers.view" },
      { href: "/admin/kyc", label: "KYC review", perm: "kyc.review", badgeKey: "kyc" },
      { href: "/admin/support", label: "Support", perm: "support.manage", badgeKey: "tickets" },
      { href: "/admin/referrals", label: "Referrals", perm: "referrals.manage" },
    ],
  },
  {
    key: "money", label: "Money", icon: "money", items: [
      { href: "/admin/payments", label: "Payments", perm: "payments.review", badgeKey: "payments" },
      { href: "/admin/risk", label: "Risk checks", perm: "risk.manage", badgeKey: "risks", alert: true },
      { href: "/admin/approvals", label: "Approvals", perm: "approvals.decide", badgeKey: "approvals" },
      { href: "/admin/wallet", label: "Ledger", perm: "wallet.view" },
      { href: "/admin/reconciliation", label: "Match a statement", perm: "payments.review" },
      { href: "/admin/payment-methods", label: "Payment methods", perm: "settings.manage" },
    ],
  },
  {
    key: "growth", label: "Marketing", icon: "/admin/marketing", items: [
      { href: "/admin/marketing", label: "Offers & deals", perm: "content.manage" },
      { href: "/admin/content", label: "Content machine", perm: "content.manage", badgeKey: "drafts" },
      { href: "/admin/news", label: "News & tool updates", perm: "content.manage" },
      { href: "/admin/trust", label: "Reviews", perm: "catalog.manage", badgeKey: "reviews" },
      { href: "/admin/newsletter", label: "Newsletter", perm: "content.manage" },
    ],
  },
  {
    key: "site", label: "Website", icon: "website", items: [
      { href: "/admin/homepage", label: "Homepage", perm: "content.manage" },
      { href: "/admin/pages", label: "Pages", perm: "content.manage" },
      { href: "/admin/navigation", label: "Menus", perm: "content.manage" },
      { href: "/admin/seo", label: "SEO & redirects", perm: "seo.manage" },
      { href: "/admin/appearance", label: "Look & colors", perm: "content.manage" },
      { href: "/admin/translations", label: "Wording", perm: "content.manage" },
    ],
  },
  {
    key: "reports", label: "Reports", icon: "/admin/analytics", items: [
      { href: "/admin/analytics", label: "Sales & profit", perm: "analytics.view" },
      { href: "/admin/audit", label: "Audit log", perm: "audit.view" },
    ],
  },
  {
    key: "settings", label: "Settings", icon: "/admin/settings", items: [
      { href: "/admin/settings", label: "Store settings", perm: "settings.manage" },
      { href: "/admin/staff", label: "Staff & roles", perm: "staff.manage" },
      { href: "/admin/security", label: "Security", perm: "staff.manage" },
      { href: "/admin/email", label: "Email", perm: "settings.manage" },
    ],
  },
];

/** The menu entry a path belongs to (longest matching address wins: /admin/content/keywords → Content machine). */
export function activeItem<G extends MenuGroup>(pathname: string, groups: G[]): { group: G; item: G["items"][number] } | null {
  let best: { group: G; item: G["items"][number] } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const hit = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (hit && (!best || item.href.length > best.item.href.length)) best = { group, item };
    }
  }
  return best;
}

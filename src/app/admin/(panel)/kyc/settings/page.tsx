import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { ensureKycDefaults, KYC_FIELDS, type Requirement } from "@/lib/kyc";
import { testKyc } from "@/actions/kyc-admin";
import { ActionForm } from "@/components/admin/ActionButton";
import { PageTitle } from "@/components/admin/ui";
import { KycLevelsEditor, KycRulesEditor } from "@/components/admin/KycEditors";

export const metadata = { title: "KYC levels & rules" };

/** The owner's own KYC: levels (what each asks for) and rules ("When … → …", checked in order). Saving asks for 2FA. */
export default async function KycSettingsPage() {
  await requireStaff("settings.manage");
  await ensureKycDefaults();
  const [levels, rules, groups] = await Promise.all([
    prisma.kycLevel.findMany({ orderBy: { rank: "asc" } }),
    prisma.kycRule.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.priceGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <Link href="/admin/kyc" className="text-sm text-primary">← KYC review</Link>
      <PageTitle title="KYC levels & rules" sub="Your levels and when they are needed. Customers only see the message of the rule that stops them, in their language." />
      <h2 className="mb-2 font-semibold">Levels</h2>
      <KycLevelsEditor
        groups={groups}
        levels={levels.map((l) => ({ id: l.id, key: l.key, name: l.name as Record<string, string>, description: l.description as Record<string, string>, rank: l.rank, validMonths: l.validMonths, joinsGroupId: l.joinsGroupId, isActive: l.isActive, requirements: l.requirements as Requirement[] }))}
      />
      <h2 className="mb-2 mt-8 font-semibold">Rules (checked from top to bottom)</h2>
      <KycRulesEditor
        fields={KYC_FIELDS}
        levels={levels.map((l) => ({ id: l.id, name: (l.name as Record<string, string>).en ?? l.key }))}
        rules={rules.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sortOrder, isEnabled: r.isEnabled, conditions: r.conditions as { field: string; op: string; value?: string | number }[], action: r.action, levelId: r.levelId, message: r.message as Record<string, string> }))}
      />
      <h2 className="mb-2 mt-8 font-semibold">Test a rule</h2>
      <ActionForm action={testKyc} className="card grid gap-3 p-4 sm:grid-cols-5 sm:items-end">
        <label className="sm:col-span-2"><span className="label">Customer email</span><input name="email" type="email" required className="input" /></label>
        <label><span className="label">Doing</span><select name="action" className="input"><option value="order">Order</option><option value="topup">Top-up</option><option value="technician">Technician prices</option></select></label>
        <label><span className="label">Amount USD</span><input name="amount" inputMode="decimal" className="input" placeholder="150" /></label>
        <label><span className="label">Method</span><input name="method" className="input" placeholder="CARD, MONCASH…" /></label>
        <button className="btn-primary min-h-11 sm:col-span-5 sm:justify-self-start">Test</button>
      </ActionForm>
    </>
  );
}

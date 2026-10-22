import type { Supplier } from "@prisma/client";
import { saveSupplier } from "@/actions/suppliers";
import { ActionForm } from "./ActionButton";

/** Add or edit a supplier. The API key field is always empty: the saved key is never sent back to the browser. */
export function SupplierForm({ s }: { s?: Supplier }) {
  return (
    <ActionForm action={saveSupplier} className="card space-y-3 p-5" resetOnSuccess={!s}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Name (only you see it)</span><input name="name" defaultValue={s?.name} required className="input" placeholder="e.g. UnlockBase" /></label>
        <label><span className="label">Site address</span><input name="baseUrl" defaultValue={s?.baseUrl} required className="input" placeholder="https://supplier.com" inputMode="url" autoCapitalize="off" spellCheck={false} /></label>
        <label><span className="label">Username (your account email or login there)</span><input name="username" defaultValue={s?.username} required className="input" autoCapitalize="off" autoComplete="off" spellCheck={false} /></label>
        <label>
          <span className="label">API access key</span>
          <input name="apiKey" type="password" required={!s} className="input font-mono" autoComplete="new-password" spellCheck={false} placeholder={s ? "•••••••• saved · paste a new one to replace it" : "From your account → API access on their site"} />
        </label>
        <label>
          <span className="label">Parameter format</span>
          <select name="paramFormat" defaultValue={s?.paramFormat ?? "xml"} className="input">
            <option value="xml">XML (works with most Dhru sites)</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <label><span className="label">Low balance alert (USD, 0 = off)</span><input name="lowBalanceAlert" defaultValue={s ? (s.lowBalanceAlert / 100).toFixed(2) : "50.00"} className="input" inputMode="decimal" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isEnabled" defaultChecked={s?.isEnabled ?? true} /> Send orders to this supplier (off = paid orders wait here)</label>
      <p className="text-xs text-muted">On the supplier&apos;s site, allow this server&apos;s IP address for API access if they ask for one. The key is stored encrypted and is never shown again.</p>
      <button className="btn-primary min-h-10">{s ? "Save" : "Add and test"}</button>
    </ActionForm>
  );
}

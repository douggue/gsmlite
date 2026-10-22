import { t } from "@/lib/text";
import { displayValue, type FieldDef } from "@/lib/order-form";
import { revealFieldSecret } from "@/actions/admin";
import { RevealSecret } from "./RevealSecret";

const AMOUNT_LABELS: Record<string, string> = { amountUsd: "Amount to send (USD)", feeUsd: "Fee charged (USD)", rate: "Rate used (HTG per USD)" };

/** What the customer filled in, for staff: labels from the form, passwords behind a logged reveal, files as downloads. */
export function FieldAnswers({ itemId, values, defs }: { itemId: string; values: Record<string, string>; defs: FieldDef[] }) {
  const entries = Object.entries(values ?? {});
  if (!entries.length) return null;
  return (
    <dl className="space-y-1 text-sm">
      {entries.map(([k, v]) => {
        const d = defs.find((x) => x.key === k);
        return (
          <div key={k} className="flex flex-wrap gap-x-1.5">
            <dt className="text-muted">{d ? t(d.label, "en") : AMOUNT_LABELS[k] ?? k}:</dt>
            <dd className="font-mono font-semibold">
              {v.startsWith("enc:") ? <RevealSecret action={revealFieldSecret.bind(null, itemId, k)} />
                : d?.type === "file" && v !== "(removed)" ? <a href={`/api/admin/order-file/${v}`} target="_blank" className="text-primary underline">Open file</a>
                : displayValue(d, v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

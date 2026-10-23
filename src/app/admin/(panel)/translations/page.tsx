import en from "@/messages/en.json";
import ht from "@/messages/ht.json";
import fr from "@/messages/fr.json";
import es from "@/messages/es.json";
import pt from "@/messages/pt.json";
import ar from "@/messages/ar.json";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { TranslationEditor } from "@/components/admin/TranslationEditor";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Translations" };

function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (typeof obj === "string") out[prefix] = obj;
  return out;
}

export default async function TranslationsPage() {
  await requireStaff("content.manage");
  const base = { en: flatten(en), ht: flatten(ht), fr: flatten(fr), es: flatten(es), pt: flatten(pt), ar: flatten(ar) };
  const overrides = await prisma.translationOverride.findMany();
  const keys = Object.keys(base.en).sort();
  return (
    <>
      <PageTitle title="Translations" sub={`Change any interface wording without a developer. ${overrides.length} custom edit${overrides.length === 1 ? "" : "s"}. Changes save when you leave a box; clearing a box restores the standard wording.`} />
      <TranslationEditor keys={keys} base={base} overrides={overrides.map((o) => ({ locale: o.locale, key: o.key, value: o.value }))} />
    </>
  );
}

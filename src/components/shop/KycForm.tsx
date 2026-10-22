"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { submitKyc } from "@/actions/kyc";
import { compressImage } from "@/lib/compress-image";

type Req = { i: number; type: string; label: string; required: boolean };

/** One file box per document (photos are shrunk on the phone first), one text box per question. */
export function KycForm({ levelId, requirements, next }: { levelId: string; requirements: Req[]; next: string | null }) {
  const g = useTranslations("gl.kyc");
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-3 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">{g("sent")}{next && <> <button type="button" className="font-semibold underline" onClick={() => router.push(next)}>{g("backTo")}</button></>}</p>;
  return (
    <form
      className="mt-3 space-y-3"
      action={(fd) =>
        start(async () => {
          setError("");
          // Photos are resized before upload (iPhone photos are often 4–8 MB); PDFs and videos go as they are.
          for (const r of requirements) {
            const files = fd.getAll(`doc_${r.i}`).filter((f): f is File => f instanceof File && f.size > 0);
            if (!files.length) continue;
            fd.delete(`doc_${r.i}`);
            for (const f of files) fd.append(`doc_${r.i}`, f.type.startsWith("image/") ? await compressImage(f).catch(() => f) : f);
          }
          fd.set("levelId", levelId);
          const res = await submitKyc(fd);
          if (!res.ok) return setError(g(`err.${res.error}`, { field: res.field != null ? requirements.find((r) => r.i === res.field)?.label ?? "" : "" }));
          setDone(true);
          router.refresh();
        })
      }
    >
      {requirements.map((r) => (
        <div key={r.i}>
          <label htmlFor={`k${r.i}`} className="block text-sm font-semibold">{r.label} {r.required && <span className="text-danger">*</span>}</label>
          {r.type === "question" ? (
            <textarea id={`k${r.i}`} name={`answer_${r.i}`} rows={2} maxLength={1000} className="input mt-1 py-2" />
          ) : (
            <input id={`k${r.i}`} name={`doc_${r.i}`} type="file" accept={r.type === "video_selfie" ? "video/*" : "image/*,application/pdf"} capture={r.type === "selfie" || r.type === "video_selfie" ? "user" : undefined}
              className="mt-1 block w-full rounded-xl border border-border bg-surface p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-white" />
          )}
        </div>
      ))}
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      <button disabled={pending} className="btn-primary min-h-12 w-full">{pending ? g("sending") : g("send")}</button>
    </form>
  );
}

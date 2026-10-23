"use client";
import { LocalizedField } from "./LocalizedInputs";
import { useState } from "react";
import { ProductArt } from "../ProductArt";
import { ImageField } from "./ImageField";


/** Product image (mockup): the generated card art with its title, ribbon and color, or an uploaded image instead. */
export function CardArtEditor({ name, category, title: t0, tag: g0, style: s0, image }: { name: string; category: string; title: Record<string, string>; tag: Record<string, string>; style: string; image: string | null }) {
  const [title, setTitle] = useState(t0);
  const [tag, setTag] = useState(g0);
  const [style, setStyle] = useState(s0 || "ink");
  const [upload, setUpload] = useState(!!image);
  return (
    <div className="space-y-3">
      <b className="text-sm">Product image</b>
      {!upload && <ProductArt name={name} label={category} title={title.en || name} tag={tag.en} cardStyle={style} />}
      <div className="flex gap-2">
        <button type="button" onClick={() => setUpload(false)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${!upload ? "bg-[#111418] text-white" : "border border-border"}`}>Generated image</button>
        <button type="button" onClick={() => setUpload(true)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${upload ? "bg-[#111418] text-white" : "border border-border"}`}>Upload my own</button>
      </div>
      <input type="hidden" name="cardStyle" value={style} />
      {upload ? (
        <ImageField name="image" label="Image" value={image} folder="products" hint="JPG, PNG or WebP, 4:3 works best." />
      ) : (
        <>
          <input type="hidden" name="image" value="" />
          <div className="flex gap-1.5">
            {(["ink", "green", "mint", "slate"] as const).map((s) => (
              <button key={s} type="button" aria-label={s} onClick={() => setStyle(s)}
                className={`h-8 w-8 rounded-lg border-2 ${style === s ? "border-primary" : "border-transparent"} ${{ ink: "bg-[#111418]", green: "bg-[#1f7a4d]", mint: "bg-[#e4f3ea]", slate: "bg-[#262b2f]" }[s]}`} />
            ))}
          </div>
          <LocalizedField label="Short title on the card" hint="2 lines at most; empty = the service name" name="cardTitle" value={title} onChange={setTitle} />
          <LocalizedField label="Ribbon" hint="e.g. CLEAN IMEI, 12 MONTHS; empty = delivery time" name="cardTag" value={tag} onChange={setTag} />
        </>
      )}
    </div>
  );
}

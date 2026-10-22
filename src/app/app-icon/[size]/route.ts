import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getSettings } from "@/lib/settings";
import { readLocalPublicFile } from "@/lib/storage";

const SIZES: Record<string, { px: number; maskable?: boolean; file: string }> = {
  "48": { px: 48, file: "favicon-48.png" },
  "180": { px: 180, file: "apple-touch-icon.png" },
  "192": { px: 192, file: "icon-192.png" },
  "512": { px: 512, file: "icon-512.png" },
  "maskable-512": { px: 512, maskable: true, file: "icon-maskable-512.png" },
};

/** Favicon and install icons made from the icon uploaded in Settings → Brand (built-in icons until one is set). */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const spec = SIZES[(await params).size.replace(/\.png$/, "")];
  if (!spec) return new NextResponse("Not found", { status: 404 });
  const s = await getSettings();
  let source: Buffer | null = null;
  try {
    if (s.appIconUrl.startsWith("/media/")) source = await readLocalPublicFile(s.appIconUrl.slice("/media/".length));
    else if (s.appIconUrl) source = Buffer.from(await (await fetch(s.appIconUrl)).arrayBuffer());
  } catch {
    source = null;
  }
  let png: Buffer;
  if (source) {
    // Maskable icons need a safe zone: the logo sits in the middle 80 % on the theme colour.
    png = spec.maskable
      ? await sharp({ create: { width: 512, height: 512, channels: 4, background: "#111418" } })
          .composite([{ input: await sharp(source).resize(410, 410, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), gravity: "center" }])
          .png().toBuffer()
      : await sharp(source).resize(spec.px, spec.px, { fit: "cover" }).png().toBuffer();
  } else {
    png = await readFile(path.join(process.cwd(), "public", spec.file));
  }
  return new NextResponse(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } });
}

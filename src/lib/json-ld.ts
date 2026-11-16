/**
 * JSON for a <script type="application/ld+json"> tag. Names and texts can come from supplier imports or the
 * AI writer, so "<", ">" and "&" are escaped: a name containing "</script>" can't close the tag and run code.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

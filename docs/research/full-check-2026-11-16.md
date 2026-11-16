# Full debug and security check, 2026-11-16 (branch preview/everything)

## Results
- Type check clean; 19 test files, 92 tests pass (new: fake supplier end to end, search, JSON-LD escaping).
- 77 pages × phone + laptop = 154 loads (storefront in 6 languages, account, admin): no errors, no broken pages, no sideways scroll.
- Real order in the browser against the fake supplier (`npm run fake-supplier`): 2 IMEIs paid from the wallet, sent,
  one delivered with its unlock result, one refused ("IMEI is blacklisted") and refunded to the wallet; order settled.

## Security fixes
1. **Next.js 15.5.27 → 15.5.28**: published critical flaw (remote code execution through the image optimizer with SVG files) and a server-action denial of service.
2. **Google structured data could run code**: product/news names (supplier imports, AI writer) went into `<script>` tags unescaped. All five places now use `jsonLd()` (escapes `<`, `>`, `&`).
3. **`mediaUsage` was callable by anyone** (which pages use a file; extra database work). Staff only now.
4. **Supplier redirects**: requests to suppliers no longer follow redirects (the API key is in the body; a redirect could aim our server at an internal address). Staff see "the supplier's address moved".
5. **Sign-in redirect**: `/\evil.com`-style links no longer pass the "same site" check.
6. **Newsletter**: rate limit per address (5 per hour) on top of the bot check.

## Checked and fine
- Every server action checks the caller (staff permission or signed-in customer); public ones are by design (newsletter, first setup with the setup code).
- Customers only see their own orders; the public order-status page needs the secret link (compared in constant time).
- Payment callbacks (MonCash, card) always re-check with the provider; a fake callback can't credit anything.
- Security headers: CSP, HSTS, no framing, nosniff, referrer policy, permissions policy.
- Sign-in, sign-up, password reset, 2FA codes, orders, uploads, CSV export: rate limited.
- Uploads: size limits, encrypted at rest, stored per user.
- No keys or passwords in the code.

## Left as notes (low risk, need a bigger change)
- `zod` 3 has a memory issue with huge lists; the fix is zod 4 (a major upgrade). Server actions are already limited to 1 MB bodies.
- `undici` inside `@vercel/blob` (file uploads to Vercel Blob); our own requests use Node's built-in fetch.
- Build/test-only tools flagged by npm audit (postcss, vitest, prisma CLI) don't run on the live site.
- The 15 older browser test files (`e2e/`) still come from the Haiti Gaming copy and need rewriting for GSMLite.

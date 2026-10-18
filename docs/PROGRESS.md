# Progress (paused 2026-10-18)

Phone-unlocking / repair-tool services site, forked from Haiti Gaming.

**Brand: GSMLite · domain: gsmlite.com** (chosen 2026-10-18). Repo name still to be created ("kle" is only the local folder name).
Mockup (7 screens, approved direction): https://claude.ai/artifact/JxwAt4xKjsFcqR1bq2Lv4C (copies in docs/mockup/). Full plan in Kreyòl: docs/GSMLite-Plan-Konple.pdf

## Business model (confirmed)
- The site **buys from suppliers** (Dhru Fusion API) and **resells to its own customers**.
- No reseller API: other sites do not connect to this one. (A Dhru-compatible server was drafted, then removed on request.)
- Services: carrier/network unlocking, IMEI and carrier checks, repair-tool credits and licenses, data/firmware services.
- Keep: 4 languages, wallet + ledger, MonCash/NatCash, auto-refunds, push notifications, installable app, admin.

## Done
- Copied the Haiti Gaming code (commit 1), removed gift links, money-exchange product, sale popup.
- Schema migration `20261018000000_unlock_platform`: USD prices (`priceUsd`), `ServiceType` IMEI/SERVER/REMOTE, IMEI box settings,
  `Supplier`, `SupplierService`, `SupplierOrder` (one live order per line, enforced by a unique index), `SupplierLog`, `PriceGroup`/`GroupPrice`.
- `src/lib/imei.ts`: IMEI Luhn check, serial check, bulk parsing.
- `src/lib/pricing.ts`: group discounts / fixed group prices.
- `src/lib/orders.ts`: one order line per IMEI, per-line refunds (`rejectItem`), `settleOrder`.
- `src/lib/dhru/protocol.ts` + `client.ts`: Dhru Fusion v6.1 client (XML or base64-JSON parameters, tolerant reply parsing, status 0/1/3/4).
- `src/lib/suppliers/dispatch.ts`: send paid lines to the supplier, poll with back-off, deliver on success, refund on rejection,
  never re-send blindly on a timeout (UNKNOWN → staff checks), balance/key problems keep the order waiting instead of refunding.
- `src/lib/suppliers/sync.ts`: balance + catalog sync, import a supplier service as a draft product at cost + markup.
- Admin product editor: service type, IMEI box, USD prices, quantity range, supplier + service ID with margin.

## Decisions
- Any Dhru service the supplier exposes can be imported (IMEI, SERVER, REMOTE). To add: Dhru file-upload services, and model/carrier dropdowns
  from the supplier's lists (modellist/providerlist).
- FRP / iCloud services: imported and sold like any other supplier service. The owner decided (2026-10-18): no extra safeguards for them.

## Approved additions (2026-10-18, from a look at competitor sites)
1. File-upload services (Dhru file actions): competitors list far more file services than IMEI/server ones.
2. Public price list page: every service grouped, price + delivery time, expand/collapse, visible without signing in.
3. IMEI check offered next to every unlock (check first, then buy).
4. Model / carrier dropdowns from the supplier's lists (modellist / providerlist).
5. Telegram notifications (bot), next to push and WhatsApp.

## Marketing plan (chosen 2026-10-18)
Chosen strategies, with what the platform needs for each:
- Shop price group (verified technicians get lower prices) → price groups admin + "I'm a technician" request with staff approval.
- Telegram/WhatsApp channels for new services, price drops and "back online" alerts → Telegram channel posting from admin.
- Real delivery time per service + automatic refund shown as selling points → average delivery time computed from orders.
- Referral rewards (already built) → pay on the referred customer's first orders.
- **Free/cheap IMEI check as the main way in (the "real deal")** → check page on the homepage, result followed by the matching unlock offer.
- One page per model and carrier for Google → generated from the catalog, in every language.
- Guarantee headline: not done = money back to the wallet automatically.
- Follow-up offers (next phone, inactive technicians) → automatic messages.
- Weekly deal → one discounted service per week, announced everywhere.
More languages to go global: add Portuguese and Arabic first (Arabic needs right-to-left layout), then Turkish, Vietnamese, Indonesian, Russian.
Going global also needs card payments (Stripe) and crypto next to MonCash/NatCash.

## Hosting plan (decided 2026-10-18)
Vercel for testing only; production moves to a VPS / DigitalOcean droplet. Build so the app runs on both:
- Fixed outbound IP on the VPS (solves suppliers that lock the API key to an IP).
- Supplier polling: system cron or a small worker every 1–2 min (no Vercel cron limits).
- File storage: replace Vercel Blob with S3-compatible storage (DigitalOcean Spaces) or local disk, chosen by env.
- Database: managed Postgres (DigitalOcean) or Postgres on the droplet with daily backups off-server.
- Country header: x-vercel-ip-country on Vercel, Cloudflare's cf-ipcountry on the VPS; drop the .vercel.app redirect there.
- Deploy: Docker + Caddy (automatic HTTPS) + GitHub Actions on "ship it"; staging subdomain for preview testing.
- Secrets: Vercel env vars while testing, then a root-only env file on the server. Never in code or chat.

## Still to do
1. Fix remaining type errors (storefront pages still use `priceHtg`: product page, ProductPurchase, ProductCard, StoreBrowser, cart, demo catalog, auto-refund test).
2. Admin → Suppliers screen (add supplier, test, sync, browse/import services, needs-attention list for UNKNOWN / account problems, logs).
3. `/api/cron/suppliers` (poll every few minutes; Vercel Hobby only allows daily cron → use an external cron or Pro).
4. Auto-refund-by-time must skip lines that are with a supplier.
5. Storefront redesign per the approved mockup; service page with IMEI box; order page showing supplier progress/results.
6. Price groups admin; rebrand to GSMLite (logo, messages in 4 languages, notify/email sender, CANONICAL_SITE in site-url.ts → https://gsmlite.com).
7. Tests (protocol, IMEI, dispatch with a fake supplier), README/DEPLOY, new GitHub repo, Vercel project, preview branch.

Secrets: supplier API keys are entered in Admin and stored encrypted; platform keys go in Vercel env vars only. Never in code or chat.

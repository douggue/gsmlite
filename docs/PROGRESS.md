# Progress (paused 2026-10-18)

**Standing request from the owner:** always look for new features and propose your own ideas (keep the backlog below up to date).
Working rules: risky changes on a preview branch, wait for "ship it"; API keys never in code or chat.

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

## Remote orders (added 2026-10-18)
Remote services already flow like other supplier services. To add:
1. Remote tool password stored encrypted, hidden once the order is finished.
2. "Get ready" checklist before paying (PC on, drivers, phone connected, AnyDesk/TeamViewer/UltraViewer open).
3. Instructions on the order page: which tool, where to find the ID, stay available.
4. Order page tells the customer to keep the PC and remote tool open while "in process".
5. Technician hours shown per service.

## KYC (required, added 2026-10-18)
- Levels: basic (email + phone verified) → verified (ID document + selfie) → technician/shop (business proof, unlocks technician prices).
- Triggers (set in admin): top-ups over a limit, card payments, technician price, high-value orders, withdrawals of referral rewards if ever added.
- Staff review queue in admin (approve / reject with reason / ask for a new photo), notifications to the customer.
- Documents in private storage, encrypted, visible only to staff with a KYC permission, every view logged; retention period and deletion on account closure.
- Optional later: automatic ID check provider (e.g. Sumsub, Veriff, Didit) behind the same screens.

## Feature ideas backlog (proposed by Claude, not yet approved)
- IMEI history per customer: every IMEI they checked or ordered, with one-tap reorder.
- Supplier auto-routing: the same service linked to 2 suppliers; send to the cheaper or faster one, switch automatically if one is down or out of credit.
- Price-change guard: alert when a supplier raises a cost so a service would sell at a loss; optional auto-reprice to keep the margin.
- Bulk results export (CSV/PDF) for technicians with many IMEIs.
- Printable/shareable result certificate (unlock or check report with QR to verify on gsmlite.com).
- Technician leaderboard / loyalty levels (Bronze, Silver, Gold) based on monthly spend, each level a price group.
- Service favorites and "order again" for technicians.

## Design inspiration (owner likes gsmgenesis.com, 2026-10-21; inspiration only, never copy)
Ideas to adapt in GSMLite's own style (ink + green, not their navy + orange):
- Promo slider at the top of home (offers with dates, e.g. "+1 month free"), managed in admin.
- Quick actions grid under it: Add funds · Place order · My orders · Track order.
- Horizontal chips: Today's deal · Best sellers · New arrivals.
- Section cards with a dark header strip (icon, title, subtitle, "View all") over a light body.
- "Shop by tool" grid with tool logos (UnlockTool, Chimera, Octoplus…) and tabs per brand.
- Product cards with price, favorite (heart) and quick add-to-cart.
- "Latest tool updates" feed (tool, version, what's new, link) — admin-managed news; good for SEO and return visits.
- "How it works" with an animated order flow (Your order → GSMLite → Completed) and "All systems online" badge (real status).
- Live stats only when real (orders delivered, customers, services): never invented numbers.
- Support block: live chat + WhatsApp; trust strip (Instant delivery, Secure payments, Expert support, Refund guarantee).
- Footer: accepted payment badges (MonCash, NatCash, Visa/Mastercard, USDT…), columns for tools, account, customer service.
Avoid their issue: the fixed bottom menu covers page content on phones.
Desktop layout seen in the owner's screenshots (2026-10-21): thin top bar (delivery, wallet currencies, support, currency/language) ·
header with logo, wide search, cart, Sign in / Register · category menu row with "Hot" badges · 3 columns under it:
left "Top categories" list with tool icons, center promo slider (tool update / offer, 05/14 counter), right "Welcome" sign-in card + Quick links
(Today's deal, Best sellers, New arrivals, Trending) · quick actions row (Add funds, Place order, My orders, Track order) ·
Shop by category tiles · Deal of the day carousel (big product art, title, price, heart, add-to-cart) · two promo banners side by side
(Server credits, IMEI check) · Top brands with tabs per tool (license length × new/renewal) · Best sellers tabs (Official, Trending, New, Most demanded).
Product art: each service needs a square image; plan an admin image generator (tool logo + "12 MONTHS" + New/Renewal ribbon) so cards look uniform.

## Supplier service list (import screen, mockup AdminImport, 2026-10-21)
Browse every service of a supplier before importing: search, filters (not imported / already on my site / new since last sync /
price changed / removed by supplier), type chips (IMEI, Server, Remote, File), the supplier's own groups with counts, columns for
time, fields the customer must give, cost, and status on my site. Click a service for its full description and fields.
Select many → choose category, markup %, minimum profit, price rounding → "Import as hidden drafts" or "Import and publish".
Services the supplier removes pause on my site automatically; cost increases are flagged.

## Countries (decided 2026-10-21)
- Own (custom) services: created in admin without a supplier, delivered by hand or from license-key stock.
- Every service: sold Worldwide / Only in these countries / Everywhere except. Hidden and refused at checkout elsewhere.
- Every payment method: same three choices (e.g. MonCash + NatCash only Haiti; card + USDT worldwide; Pix only Brazil).
- Country = visitor location (Cloudflare/Vercel header) + country on the account; enforced on the server, not only hidden.
- Owner rule: customers must see NOTHING about a payment method they can't use: no button, no footer logo, no mention in
  slider, FAQ, guides, emails, notifications, wallet page or price list. Any text listing payment methods uses a placeholder
  filled with the visitor's own methods (e.g. {payment_methods}). Same rule for services not sold in their country.

## Order form builder for custom services (mockup AdminForm, 2026-10-21)
Field types: short text, long text, number, email/phone/link, dropdown, choice buttons, checkbox ("I confirm…"),
IMEI (checked) / serial, phone model list, photo/file upload, remote ID + password (hidden, encrypted, staff only),
date/time slot, info text. Per field: label in every language, help text, allowed format, required, hidden after the order
is done, remember for next order, show only if (another answer). Drag to reorder, live customer preview, templates
(Remote job, IMEI service, Tool account, License key). Imported supplier services fill the form automatically.

## Content machine for Google traffic (decided 2026-10-21; mockup AdminContent)
Goal: free Google traffic. Chosen outputs: (1) a page per service / model / carrier, (2) tool update posts, (5) guides.
Reference the owner likes: sickw.com service pages (/?page=services&service=105): one page per service with price, time,
success rate, sample result, short description, plus brand landing pages (/apple-imei-check, /samsung-imei-check…).
Theirs are thin (~200 words, no FAQ, no schema): GSMLite pages should be richer.
- Written by an AI model (e.g. Claude API) from real site data only (services, prices, real avg time, real success rate).
- Every page: keyword title + meta description, clean localized URL (/en/unlock/iphone-13-att), sample result (IMEI masked),
  steps, how to find IMEI, FAQ with FAQPage schema, Product/Offer schema, related links, brand hub, hreflang across languages.
- Brand hubs (Apple / Samsung / Motorola IMEI check…), tool update posts (also to Telegram), guides ending with a service link.
- Keyword ideas from Google Search Console + autocomplete (paid keyword-volume API optional); never invented volumes.
- Owner approves every draft; at most N new pages a day (Google penalizes mass low-value auto pages); refresh when price/time changes;
  monthly AI budget; dashboard: pages indexed, Google visits, orders from Google.
- "Hide from Google" per service (FRP, iCloud, MDM…): no page written, noindex, not in sitemap / hubs / public price list /
  structured data, visible only to signed-in customers.

## Still to do
1. Fix remaining type errors (storefront pages still use `priceHtg`: product page, ProductPurchase, ProductCard, StoreBrowser, cart, demo catalog, auto-refund test).
2. Admin → Suppliers screen (add supplier, test, sync, browse/import services, needs-attention list for UNKNOWN / account problems, logs).
3. `/api/cron/suppliers` (poll every few minutes; Vercel Hobby only allows daily cron → use an external cron or Pro).
4. Auto-refund-by-time must skip lines that are with a supplier.
5. Storefront redesign per the approved mockup; service page with IMEI box; order page showing supplier progress/results.
6. Price groups admin; rebrand to GSMLite (logo, messages in 4 languages, notify/email sender, CANONICAL_SITE in site-url.ts → https://gsmlite.com).
7. Tests (protocol, IMEI, dispatch with a fake supplier), README/DEPLOY, new GitHub repo, Vercel project, preview branch.

Secrets: supplier API keys are entered in Admin and stored encrypted; platform keys go in Vercel env vars only. Never in code or chat.

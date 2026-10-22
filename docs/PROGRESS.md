# Progress (paused 2026-10-18)

**Standing request from the owner:** always look for new features and propose your own ideas (keep the backlog below up to date).
Working rules: risky changes on a preview branch, wait for "ship it"; API keys never in code or chat.
No more mockups unless the owner asks (said 2026-10-21): record decisions in these notes instead.

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
- Keyword research is automatic (owner request 2026-10-21), weekly:
  1. Seeds from the catalog: brands, models, carriers, tools, problems ("iphone locked to att", "samsung frp", "check blacklist").
  2. Expand with Google suggestions / "People also ask" and related searches, through a keyword-data API (e.g. DataForSEO),
     in every site language and target country.
  3. Real search volume, difficulty and trend from that API (low pay-as-you-go cost, budget in admin) + Google Search Console
     (what we already appear for). Never invented numbers.
  4. Look at which pages rank for each keyword (competitors) to judge difficulty and what a page needs — never copy them.
  5. Group keywords by intent → map each group to: an existing service page, a new service page, a brand hub or a guide.
  6. Skip anything tied to "Hide from Google" services.
  7. Score = volume × chance to rank × service margin → top ideas become drafts in the review queue (owner approves).
  8. Track positions; pages that slip get refreshed; keywords we rank 5–20 for get priority improvements.
  Provider chosen by the owner: DataForSEO (https://docs.dataforseo.com/v3/). Endpoints to use (checked 2026-10-21):
  - Expand: /v3/dataforseo_labs/google/keyword_suggestions/live/, keyword_ideas/live/, related_keywords/live/
  - Numbers: keyword_overview/live/ (or /v3/keywords_data/google_ads/search_volume/ task_post + task_get, cheaper in bulk),
    bulk_keyword_difficulty/live/, search_intent/live/, historical_keyword_data/live/
  - Competitors: serp_competitors/live/, ranked_keywords/live/, competitors_domain/live/ (e.g. sickw.com)
  - Rank tracking: /v3/serp/google/organic/task_post/ + task_get/regular/ (weekly, cheaper than live), plus ranked_keywords for gsmlite.com
  - Develop against their sandbox first (docs appendix /v3/appendix/sandbox/); confirm auth method on /v3/auth/ when building.
  - Credentials only in hosting env vars (e.g. DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD), never in chat/code; cache results in the DB
    so the same keyword is not paid for twice; monthly budget cap in admin.
- Owner approves every draft; at most N new pages a day (Google penalizes mass low-value auto pages); refresh when price/time changes;
  monthly AI budget; dashboard: pages indexed, Google visits, orders from Google.
- Every SEO service page is also a buying page (like sickw service 105): an "Order this service" card near the top with
  price (the visitor's group price when signed in), delivery time, real success rate, and the service's own order form
  (IMEI box with live check, serial, dropdowns, uploads… from the form builder), then "Order now" / "Add to cart".
  On phones the card sits right under the title, with a sticky bar ("Add to cart" + "Order now") while reading. Cart holds several services and IMEIs, paid once, saved across devices. Signed-out visitors can fill
  the form; sign-in/sign-up comes at payment and keeps what they typed.
- Connecting the writer: AI provider chosen in admin (Claude by default; built so another provider can be plugged in).
  The provider's API key goes ONLY in the hosting env vars (Vercel while testing, server env file later), never in chat,
  code or the admin screen; admin shows "Connected", model choice, monthly budget, tone/brand voice, a "Write a test page"
  button. Google Search Console connected by Google sign-in for keyword ideas and traffic numbers. Article text (sample result, steps, FAQ) comes after.
- "Hide from Google" per service (FRP, iCloud, MDM…): no page written, noindex, not in sitemap / hubs / public price list /
  structured data, visible only to signed-in customers.

## KYC levels and rules are the owner's to define (2026-10-21)
- Levels editable in admin: Basic (email + phone code), Verified (ID/passport/licence + selfie, optional proof of address,
  valid N years), Shop/technician (Verified + shop photos + business paper + address/WhatsApp), plus any new level built
  from: ID, selfie, video selfie, proof of address, business paper, phone purchase receipt, custom uploads or questions.
- Rules list, checked in order: "When <condition> [and <condition>] → <action>", each switchable on/off.
  Conditions: top-up amount, order total, monthly spending, payment method, service or category, country, account age,
  price group, number of orders, same device/network, risk flag.
  Actions: require a level, send to manual review, block, no bonuses.
- Customer message per rule, in every language; the blocked top-up/order waits and continues by itself once approved.
- "Test a rule" tool (pick a customer + action, see which rules apply). Saving rules needs the staff 2FA code.

## Success rate (agreed 2026-10-21; inspired by sickw's "99.3%" in their order box)
- Shown in the order card next to price and delivery time, with "based on [N] orders in the last 90 days" underneath.
- = delivered ÷ (delivered + rejected), per service, last 90 days; in-progress orders excluded; one decimal, never rounded up.
- Fewer than ~20 finished orders → show "New service" instead of a percentage. Never a fake or starting value.
- Optional hint with the main rejection reason (e.g. "Most rejections: blacklisted phones. Run an IMEI check first").
- Admin: per service and per supplier; alert below a chosen level; optional auto-pause; later, route to the best supplier.

## Security plan (owner: "this website needs to be well secured", 2026-10-21)
Already in the code base: Argon2id passwords + breached-password check, HttpOnly sessions, mandatory TOTP 2FA for staff + re-confirm
before sensitive actions, two-person approval for big wallet changes, server-side permission checks, audit log, append-only
double-entry ledger with DB constraints (no negative balances, no edits), idempotency keys, rate-limited auth, Turnstile bot check,
one-time payment references, held deposits, multi-account device detection, AES-256-GCM encryption, security headers.
To add / verify:
- Customer accounts: optional→encouraged 2FA (passkeys too), new-device sign-in alert, sign-out everywhere, withdrawals none.
- Orders/wallet: every order/IMEI/result checked against the owner (no reading others' orders by changing an id); row locks on money.
- Secrets: supplier keys + KYC files + remote passwords encrypted; platform keys only in env vars; key rotation guide.
- KYC files: private storage, short-lived signed links, staff permission + logged views, auto-delete.
- Web: strict Content-Security-Policy, CSRF/origin checks, input validation (zod) everywhere, output escaping, upload checks
  (type sniffing, size, re-encode images), no user HTML; supplier results shown as plain text.
- Abuse: rate limits per IP/account on sign-in, checks, orders, top-ups; free-check limits; Cloudflare WAF + DDoS in front.
- Admin: separate admin path, IP allowlist option for admin, staff session timeout, least-privilege roles.
- VPS: SSH keys only (no root/password login), firewall (only 80/443 + SSH), automatic security updates, fail2ban, DB not
  reachable from internet, app runs as non-root in Docker, daily encrypted off-site backups + tested restore, staging separate.
- Process: dependency updates + vulnerability scan in CI, security review on every risky change (preview branch), error
  monitoring, uptime checks, an outside penetration test before launch.

## News / Updates page (inspired by sickw.com/?page=news, 2026-10-21)
- Automatic "Service changes" feed from supplier syncs and admin edits: New service, Price down (old → new), Price up, Removed,
  Back online; counts per type in the header; filters by type and brand. Proposal: show New + Price down + Back online to everyone,
  Price up / Removed only to signed-in customers (owner to confirm). Hidden-from-Google and country-limited services follow their rules.
- Written posts: new site features, tool updates, security notices, how-tos; date + title + short body + label.
- Link to a live Service Status page (online / slow / down per service, from real delivery data).
- Posts can be drafted by the content machine (owner approves), sent to Telegram, RSS feed, indexed by Google.
- Feature ideas seen there worth adding to the backlog: passkey sign-in (already planned), saying the IMEI by voice
  (test on iPhone Safari first), favourites list, bulk check with CSV / Excel export (already in backlog).

## Settings must be complete (owner feedback 2026-10-21: mockup Settings page too vague, e.g. no logo upload)
Settings area with a left list of sections, each its own page:
1. Brand & appearance: site name, logo (light + dark), favicon and app icon (home-screen icon for iPhone), social share image,
   colors, fonts, default light/dark, homepage slider link. (Haiti Gaming already had logo/appearance upload: reuse.)
2. Business info: legal name, address, hours, support WhatsApp, Telegram, email, social links.
3. Languages & countries: languages on/off, default language, sold-to countries, currency per country.
4. Money: USD/HTG rate, rounding, deposit min/max, holds, review thresholds, two-person approval amount.
5. Payment methods: add/edit methods, logo, instructions per language, countries, fees, min/max (connections show "Connected";
   keys only in env).
6. Suppliers defaults: markup, minimum profit, price rounding, check interval, low-balance alerts.
7. Orders: auto-refund rules, success-rate thresholds, auto-pause, order number format.
8. KYC: levels, documents, rules (see KYC section).
9. Notifications: email sender, templates per language, push, WhatsApp, Telegram bot, what staff get alerted about.
10. SEO & content machine: default titles/descriptions, sitemap, Google Search Console, analytics, AI writer, DataForSEO, budgets.
11. Security: customer 2FA policy, staff session timeout, admin IP allowlist, bot check, device limits.
12. Staff & roles, Audit log.
13. Legal pages: terms, privacy, refund policy, cookie notice (editor per language).
14. Maintenance mode, data export, backups status.
Every change logged; sensitive sections ask for the 2FA code again.

## Still to do
0. Known limit: prices are whole cents. Suppliers sometimes price credits below a cent precision (e.g. $0.125 per credit);
   switch per-unit cost/price to tenths of a cent (or price per 10/100 credits) before selling such services.
1. DONE (branch preview/usd-storefront): store pages in USD, IMEI order box, unlock demo catalog; typecheck, 59 tests and production build pass.
   Seen in the iPhone check: old Haiti Gaming logo still shown, and the floating WhatsApp button covers the order total: fix in the redesign.
2. Admin → Suppliers screen (add supplier, test, sync, browse/import services, needs-attention list for UNKNOWN / account problems, logs).
3. `/api/cron/suppliers` (poll every few minutes; Vercel Hobby only allows daily cron → use an external cron or Pro).
4. Auto-refund-by-time must skip lines that are with a supplier.
5. Storefront redesign per the approved mockup; service page with IMEI box; order page showing supplier progress/results.
6. Price groups admin; rebrand to GSMLite (logo, messages in 4 languages, notify/email sender, CANONICAL_SITE in site-url.ts → https://gsmlite.com).
7. Tests (protocol, IMEI, dispatch with a fake supplier), README/DEPLOY, new GitHub repo, Vercel project, preview branch.

Secrets: supplier API keys are entered in Admin and stored encrypted; platform keys go in Vercel env vars only. Never in code or chat.

## Sign-in / accounts (auth) — DECIDED 2026-10-22: email/password + Google only
(Google needs an OAuth client ID/secret from Google Cloud, set only in hosting env vars.) Passkeys/Apple/phone sign-in: not now.
Already in the code (Better Auth): email + password (Argon2id, breached-password check), email verification, forgot/reset
(email, or WhatsApp + one-time staff link), optional 2FA for customers (authenticator app + backup codes), mandatory 2FA for
staff on a separate /admin login, session list with sign-out, rate limits, bot check, suspended accounts refused.
Proposed additions:
- Passkeys (Face ID / Touch ID on iPhone, fingerprint on Android): fastest and phishing-proof.
- "Continue with Google" and "Continue with Apple" (one tap on iPhone).
- Phone number sign-in with a code by WhatsApp or SMS (useful in Haiti; per-message cost).
- New-device / new-country sign-in alert, "sign out everywhere", account recovery with backup codes.
- Sensitive actions (change email/password, big top-up, add payout info) ask for 2FA or passkey again.
- Staff: 2FA required, short sessions, optional admin IP allowlist; owner can force 2FA for technicians/high spenders.
- Sign-up asks only email (or phone) + password; country and language detected; KYC only when a rule needs it.

## USDT payments: keep Haiti Gaming's style (owner, 2026-10-22)
Already in the code (ManualMethod kind "crypto", DepositForm, admin Payment methods): staff add a USDT address + network
(BEP-20, TRC-20, Polygon, ERC-20), optional QR image (otherwise generated from the address), customer copies the address or scans
the QR, sends USDT, pastes the transaction hash, staff check it on the explorer and approve in Payments → USD wallet credited
1 USDT = $1; hash usable once; address changes logged. Keep it as is in GSMLite (worldwide by default, per-country rules apply).

## Next project after GSMLite (owner, 2026-10-21)
An SMM panel. Reuse from GSMLite: wallet/ledger, supplier engine (SMM providers use the common "API v2": action=services/add/status/balance, form posts with a key), auto refunds incl. partial ("Partial" status), price groups, content machine, admin, security.

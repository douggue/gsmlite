# Admin test, 2026-10-23 (to fix on Tuesday)

> **Status: done on branch `preview/admin-v2`, waiting for "ship it".**
> New shell (folding dark menu, search, supplier balances, to-do bell, phone bottom bar + menu sheet), 10 groups with tabs instead of 35 loose pages,
> all money settings in USD (cents) with HTG shown at today's rate, Haiti Gaming wording gone (`CodeItem.costUsd` migration),
> Dashboard / Orders / Order / Service editor / Customers / Reports redone, language tabs instead of 6 boxes per text,
> save bar on long forms, Translations filter for missing texts, form builder fits a laptop, empty states that explain, tables become cards on phone.
> Checked: 42 admin pages × phone + desktop with no errors or sideways scroll; 84 tests pass.
> Supplier logs: the code logs every call; the demo suppliers only have a seeded "last sync" date, so their log is empty.

I opened all 45 admin pages on desktop (1440 px) and iPhone size.
- **Working:** no crashes, no errors in the browser, no broken requests, and no page that scrolls sideways on the phone.
- **Not good:** the problems are design, structure and leftovers from Haiti Gaming.

## 1. Structure (the biggest problem)
- **Menu too long.** About 30 items are listed, and on a laptop screen Marketing, Content machine and Settings sit below the fold, so you have to scroll the menu to find them.
- **Overlapping pages:**
  - Payments / Payment methods / Reconciliation
  - Risk queue / Approvals
  - Ledger / Customers' wallets
  - Reviews ("Trust") / Homepage reviews
  - Media / image fields everywhere
- **Short pages leave the dark menu short.** The menu stops at screen height, so a white strip shows at the bottom when you scroll.
- **No top bar.** There is no search, no quick "new order", and no store-balance or supplier-balance indicator. The GSMVPro layout you liked has all of this.

## 2. Haiti Gaming leftovers (wrong for a phone-unlock store)
- **Prices in gourdes where the store is in USD:**
  - Settings: top-up limits, holds and review thresholds are all in HTG
  - Reports page: everything is in HTG
  - Referrals: "reward 100 HTG after 500 HTG"
  - Code inventory: "Cost per code (HTG)"
  - Customer wallet adjustment: defaults to HTG
- **Appearance preview:** shows "Debloke iPhone AT&T · **310 dyaman** · 450 HTG"; "dyaman" is diamonds, from the game top-ups.
- **Staff role permissions:** "Import gift-card codes", "Reveal delivered codes", "Approve or reject NatCash payments".
- **Order page:** "MANUAL · $25.00 each · **0 code(s) assigned**" on unlock lines, and the delivery prompt still talks about codes.
- **Trust page:** the "Low stock alert" tab is a leftover for gift cards.
- **Security page:** "codes cannot be read without it".

## 3. Page by page
- **Dashboard:** the "−100% vs yesterday" line is noise when both days are $0. The chart is one tall bar. No recent orders list, no supplier balances list.
- **Orders:**
  - With no order selected, the table only uses half the width.
  - "Customer" shows the staff account name ("Owner").
  - On phone the IMEIs and Status columns are cut off.
- **Order detail:** raw tracking link shown as a long URL. Status words are English codes (PROCESSING, AWAITING_PAYMENT). Buttons "Run automatic fulfillment" and "Cancel / refund to wallet…" are unclear.
- **Customers → customer page:** **layout bug**: the badges, "Spent this month", "Lines · success" and price group sit **above** the customer's name. The stat values sit inside grey boxes, unlike the other cards.
- **Services & prices → Edit service:**
  - Every text appears 6 times, once per language, so the form is extremely long, especially on phone.
  - The card-art "short title" and "ribbon" lists have no language labels.
  - Options and prices are far down the page.
- **Order form builder:** on a laptop the field list, editor and preview are squeezed. The preview drops below.
- **KYC rules:** the customer message boxes per language have no labels, and the conditions show raw values ("topup").
- **Homepage editor:** hero text only has 4 languages (no Portuguese or Arabic).
- **Payments:** the provider shows as "MANUAL" (raw code).
- **Settings:** the floating "Save settings" button covers fields while scrolling.
- **Translations:** each language says "1 missing" with no way to jump to it.
- **Supplier logs:** "No requests yet" even though the supplier was synced (logs not recorded for that sync, or demo data).
- **Empty states:** many pages show only "Nothing here." with no hint of what goes there or how to start.

## 4. Look and feel
- **Mixed styles:** cards with plain numbers (Dashboard) next to numbers inside grey boxes (Customers, Reports, Email, Security, Newsletter).
- **Inconsistent buttons:** small pill buttons, big green buttons and plain links all do similar things.
- **Phone:**
  - The admin reuses the store's header and a store-like bottom bar.
  - Tables are squeezed rather than turned into cards.
  - Long forms have no sticky save button.

## Plan for Tuesday (with the hybrid layout)
1. **New admin shell:**
   - left menu cut to about 8–10 groups that fold open;
   - top bar with search, quick actions and balances;
   - full-height menu;
   - phone: our bottom bar plus a menu sheet.
2. **Merge the overlapping pages:**
   - Money: payments, methods, reconciliation, ledger;
   - Reviews: risk and approvals;
   - Content: news, pages, homepage, content machine.
3. **Remove every Haiti Gaming leftover; USD everywhere** in the admin (HTG only where it really is HTG: MonCash, NatCash).
4. **Redo the busiest screens in this order:** Dashboard, Orders, Order detail, Services & prices (editor with language tabs instead of 6 copies), Suppliers, Customers.
5. **One card style, one button style, useful empty states, tables become cards on phone.**
6. **Add the owner's own list of problems** (still to collect) on top of this one.

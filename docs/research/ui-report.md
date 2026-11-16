# GSMLite UI research: does the look fit the GSM / IMEI industry?

## Verdict

Yes. The ink-and-green identity fits the industry and looks better than most competitors. Most GSM sites use generic blue (Chimera, UnlockBase, iUnlocker, UnlockRiver), and many are crowded walls of links and prices (SickW, Chimera). GSMLite already does what the better sites do: delivery time and price on every service card, a "refund if not done" promise, and a free IMEI check as a way in. It is behind in four places:
- **Trust proof.** We have no ratings, review counts or payment logos. Every serious competitor shows them.
- **Price density.** Technicians who order often need a compact price list, not big poster-style tiles.
- **Dark-mode green text.** It is too dark to read.
- **Polish bugs.** A few, listed below.

Keep the palette and adjust two shades.

Important limit: screenshots 06–09 (account, orders, wallet, deposit) all show the same sign-in page, and 10–12 (admin) all show the staff sign-in page. I could not review the signed-in dashboard, wallet card or admin screens. Re-capture them while signed in.

## Industry conventions (sites I actually loaded)

Colors come from each site's live HTML/CSS: I counted the hex codes. Layout notes come from page text.

| Site | URL | Main palette (from CSS) | Density | Notable patterns |
|---|---|---|---|---|
| UnlockBase | unlockbase.com | blue #5488BA + green #45A843 + dark grey #2E2E2E | Medium-high | "Over 10,413,958 phones unlocked" counter, 4.9/5 from 15,681 reviews, McAfee/Comodo seals, row of card and crypto logos, money-back guarantee |
| iUnlocker | iunlocker.com | navy #101828, purple #6B4EFF, blue #1B66FF, Trustpilot green #00B67A | High | Service cards: icon, name, delivery label ("INSTANT", "1-10 minutes"), price, struck-through old price, HOT/TOP badges, success rate; Trustpilot widget; 13 languages; separate Member and Reseller accounts |
| SickW (IMEI checks) | sickw.com | pink/magenta #D04078 accents, blue #2DA5DA | Very high | Prices as one long text run ("1.60$ - APPLE SOLD BY…"), about 100 menu links, IMEI clipboard (last 14), "Save service", group pricing for resellers. No trust marks |
| ChimeraTool (official) | chimeratool.com | blue #2087DE / #14B0D1, grey #424242, gold #EABE42 | High | Three license cards (Basic $99.9 / Pro $149.9 "Most Popular" / Premium $189.9), credit packs sold separately, wall of 100+ brand logos, "Become a reseller" |
| UnlockRiver | unlockriver.com | slate #1E293B/#0A1424, Telegram blue #229ED9, WhatsApp green #25D366, emerald #10B981 | (single-page app; text not readable) | Status colors: green, amber, red, purple; WhatsApp/Telegram used as contact channels |
| SEAGM (digital goods) | seagm.com | purple #6C48F8 / #9078F0 | Very high | Price tiles with "-11%" promo tags, sales counts ("415K"), coupons with a "Claim" button, Trustpilot link, refund policy in footer |
| Codashop (top-ups) | codashop.com | purple #6242FB with orange/yellow presets | High | Top-up by amount, region-specific stores |
| Payoneer (wallet) | payoneer.com | purple #46319B / #715CC6, near-black #15151B | Low | Calm fintech look: lots of white, one brand color |
| MonCash (Digicel, Haiti) | moncashdfs.com | navy #00264C, red #DB121D | Low | The Haitian money brand customers already trust is navy and red, not green |
| NatCash (Natcom, Haiti) | natcash.ht | cyan #20A6D3, yellow #FDE668 | Low | Second Haitian wallet: blue and yellow |

Blocked or unreachable, so not reviewed: GSMVPro, GSM-Server, Official iPhone Unlock (network blocked); DoctorSIM, IMEI.info, IMEIcheck.net, Halabtech (Cloudflare 403); unlocktool.net (403). I found no Haitian phone-service storefront online to compare with.

Mobbin references for patterns we lack:
- **Wallet:** [Lightyear cash](https://mobbin.com/screens/1150f368-86dd-44fa-8033-79e25cadbe07?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) and [X Money](https://mobbin.com/screens/b76e0c9e-6b8c-46f1-8ad1-90e73bcd9acf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The pattern is a big balance number, then one primary "Deposit" button, then a row of small actions.
- **Order lists:** [talabat](https://mobbin.com/screens/dc389c20-f77b-4bb3-9dd8-ae52517fe5b2?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp), [Swiggy](https://mobbin.com/screens/06534016-d854-4961-bd02-10cab55d92f7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) and [Shopify admin](https://mobbin.com/screens/2564839a-b6f9-4767-8e1a-0b70d220efb1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The pattern is a colored status pill at the top of each card, filter chips (All / Pending / Done / Refunded), and a "repeat order" button.

## What we do well (keep)

1. **Delivery time and price on every card** (02-store, 01-home-phone "Popular"). This matches iUnlocker, the most polished competitor. Keep it.
2. **"Refund if not done" shown at the point of choice** (03-service tag row, 01-home footer strip). Every serious competitor promises a money-back guarantee. We show ours right next to the price, which is better.
3. **Free IMEI check as the way in** (04-check, 01-home banner). SickW and iUnlocker sell the same idea ("Free checks"). Ours is cleaner.
4. **Cross-sell: "Not sure the phone qualifies? Run a Full IMEI check first – $1.50"** (03-service). This cuts failed orders. No competitor I saw does it this clearly.
5. **Calm ink + green palette.** Competitors are blue, purple or pink. Green reads as "money, success, unlocked" and makes GSMLite stand out. Keep it.
6. **Phone layout**: a bottom tab bar (Home, Services, Orders, Wallet), a large IMEI search, and a sticky "Total / Order" bar (03-service-phone). This is closer to an app than any competitor.
7. **Clear text and paragraph contrast** in light mode (numbers below).

## Problems, ranked by impact

**1. No outside trust proof (01-home, 02-store, 03-service).**
- What is wrong: The only trust content is our own claims ("Money-back guarantee", "Secure payments: NatCash"). The home stats strip shows "1 orders delivered / 1 customers".
- Why it matters: A one-time phone owner sending money to an unknown unlock site worries about scams. UnlockBase shows 4.9/5 from 15,681 reviews and a counter of phones unlocked. iUnlocker shows Trustpilot.
- Fix:
  - Hide the stats strip until the numbers are real (show it from about 100 orders).
  - Add a row of payment logos (MonCash, NatCash, Visa/Mastercard, USDT) in the footer and under "Order now".
  - Add a "Verified by WhatsApp: +509…" support line.
  - Add a small "Recent results" feed with each IMEI masked (for example "35••••••••4567 – unlocked – 2 h ago").

**2. Dark-mode green text fails contrast.**
- What is wrong: `--primary` #1F7A4D on the dark background #0B0E10 is only 3.64:1. The code uses primary as a text color about 160 times (links, "Add to cart instead", "Forgot your password?").
- Fix: In `.dark`, add `--primary-text: #4FC487` (8.83:1 on the background, 8.06:1 on the surface) and use it for green text. Keep #1F7A4D for button fills, where white text on it is 5.32:1 and passes.

**3. Service tiles are too big for technicians (02-store, 01-home "Deal of the day").**
- What is wrong: Each service is a poster tile with a 130 px dark artwork block. On the phone, only 4 services fit per screen.
- Why it matters: Resellers order often and compare prices. Every industry site (SickW, Dhru-style stores) gives them a dense list.
- Fix: Make the existing list toggle (02-store, icon next to the grid button) the default for signed-in customers who have more than 3 orders, and remember the choice. Each row should be about 56 px tall, with name and delivery time on the left and price (bold) plus a "+" button on the right, like 01-home-phone "Popular".

**4. Overlapping and clipped labels on tiles (02-store, 03-service-phone).**
- What is wrong: The favorite-star button sits on top of the category label ("IER UNLOCK", "CKTOOL", "ERA"). On the phone, tile titles are cut off ("unlock code" is clipped).
- Why it matters: It looks unfinished, and that hurts trust.
- Fix: Move the star to the top-right corner (top: 8px; right: 8px; in RTL, left). Or move the label to start after a 40 px inset. On a narrow phone, cap the title at 2 lines with `line-clamp: 2` and a font about 18 px instead of about 22 px.

**5. "Check now" looks disabled (04-check desktop and phone).**
- What is wrong: The button is faded to 60% opacity green with dark text on a dark card. People read it as greyed out, even though it is the main action.
- Fix: Keep the button fully colored. Use the #7CE0A8 fill with ink #111418 text (11.5:1), the same as the "Create account" button. Show an error message only when the IMEI is invalid.

**6. Mixed currencies on the service page (03-service).**
- What is wrong: The header shows "from $25.00" while the total shows "3,287.50 HTG" because NatCash is selected.
- Why it matters: Customers may think they are being overcharged.
- Fix: Show both amounts in the total, for example "3,287.50 HTG (≈ $25.00)". Put the exchange rate in muted text: "1 USD = 131.50 HTG today".

**7. Home hero carousel looks blank (01-home-desktop).**
- What is wrong: The "+10% on your first top-up" slide is almost invisible: dark-grey text on ink.
- Fix: If this only happened because the screenshot caught a fade-in, start the slide at opacity 1. Otherwise, make the headline #EEF1EC with the green part #7CE0A8.

**8. Too many dark blocks on the light home page (01-home-desktop).**
- What is wrong: There are 7 dark slabs: categories header, hero, deal, credits, top tools, shop by tool, how it works, plus support.
- Why it matters: The page looks heavy and nothing stands out.
- Fix: Keep dark for the hero, the wallet card and the footer only. Give section headers ("Top tools", "Shop by tool", "Deal of the day") a white background, an ink title and a 1 px #DCDFD8 bottom border.

**9. Warning badge just fails contrast (light mode).**
- What is wrong: Warning text #A35F00 on #FFF1D6 is 4.48:1. The minimum is 4.5.
- Fix: Change `--warning` to #8F5300 (5.52:1).

**10. Muted grey #8A9187 ("steel") is too light on light backgrounds.**
- What is wrong: It is 3.24:1 on white and 2.96:1 on the page background. It is fine on the dark footer (5.98:1).
- Fix: Use it only on dark surfaces. On light surfaces use #6B7268 (4.96:1) or `--muted`.

Note: in the phone screenshots, the bottom tab bar appears halfway down the page. This is a side effect of capturing a full-page screenshot with a fixed bar, not a bug.

## Color: contrast check (WCAG 2.1, computed with a script)

AA for normal text needs 4.5:1. Large text and UI parts need 3:1.

| Pair | Ratio | Result |
|---|---|---|
| Green #1F7A4D text on white | 5.32 | Pass |
| White on green button #1F7A4D | 5.32 | Pass |
| Green #1F7A4D on page background #F4F5F2 | 4.86 | Pass |
| Green on soft green #E4F3EA (badges) | 4.64 | Pass (just) |
| Ink #111418 on background | 16.88 | Pass |
| Muted #4A5048 on background | 7.58 | Pass |
| Accent #7CE0A8 on ink #111418 | 11.51 | Pass |
| Ink text on #7CE0A8 button | 11.51 | Pass |
| White text on #7CE0A8 | 1.60 | **Fail**. Never use white on the light green |
| Steel #8A9187 on white | 3.24 | **Fail** for body text |
| Warning #A35F00 on #FFF1D6 | 4.48 | **Fail** (just) |
| Danger #C62F3C on #FDE8EA | 4.62 | Pass |
| Info #2266AA on white | 5.92 | Pass |
| Dark: text #EEF1EC on #0B0E10 | 16.99 | Pass |
| Dark: muted #A3AAA0 on surface | 7.42 | Pass |
| Dark: primary #1F7A4D as text on #0B0E10 | 3.64 | **Fail** for text |
| Dark: success #7CE0A8 on #12291C | 9.62 | Pass |
| Dark: warning #FFB547 on #3A2A0C | 7.88 | Pass |
| Dark: danger #FF6B78 on #3D1419 | 5.81 | Pass |

**Recommended palette changes (small; keep the identity):**
- Dark mode: add `--primary-text: #4FC487` for green links and text.
- Light mode: change `--warning` from #A35F00 to #8F5300.
- Use `--steel` #8A9187 on dark surfaces only. On light surfaces use #6B7268.
- Optionally, for a stronger main button, darken `--primary` to #17663F (white text 6.98:1). This is optional because the current 5.32 passes.

## Color meaning for this audience (judgment)

- **Green.** Green means "money, paid, success, unlocked". That suits a wallet-based unlock service. The darker forest green #1F7A4D reads as bank-like and trustworthy rather than gaming or crypto, because it is not neon. The bright #7CE0A8 on black does lean "crypto/terminal", so keep it to accents: the logo "Lite", hero highlights, and small buttons on dark backgrounds.
- **Overlap with status colors.** WhatsApp is #25D366 and the success status is green too. Make sure the WhatsApp button keeps its own icon so it is not mistaken for a "done" status.
- **Haiti.** The money brands people use every day are MonCash (navy #00264C + red #DB121D) and NatCash (cyan + yellow). Show their own logos and colors only on their payment options, not in our theme, so they read as "official payment partner". Avoid using a lot of red-and-blue together, the colors of the Haitian flag and political parties, in our own UI.
- **Arabic and right-to-left.** Green is widely seen as positive in Arabic-speaking markets. The real right-to-left risk is layout: the favorite star, the arrows ("→") and the price alignment must mirror. Prices and IMEI numbers should stay in Western digits, displayed left-to-right.
- **Phone and data cost.** Most users are on phones and pay for data. The "Data saver" option and the lack of heavy images are a real advantage over the logo walls on Chimera and SickW.

## Verified facts vs judgment

**Verified:** Palettes and patterns in the industry table come from live HTML/CSS fetched on 2026-11-16 (unlockbase.com, iunlocker.com, sickw.com, chimeratool.com, unlockriver.com, seagm.com, codashop.com, payoneer.com, moncashdfs.com, natcash.ht). All contrast ratios were computed from `src/app/globals.css` tokens. Screenshot observations are from the 24 provided files (12 unique; the account and admin screens show only sign-in pages).

**Judgment:** The problem ranking, the trust and density recommendations, the fixes for problems 3, 7 and 8, and the cultural notes are my design opinion, based on the patterns above. They were not tested with GSMLite customers.

## Signed-in screens (account + admin)

These are based on the replaced screenshots 06–12, desktop and phone. Contrast numbers come from the same script; colors were read from `WalletCard.tsx`, `AccountNav.tsx` and `StatusBadge.tsx`.

### What fits the industry (keep)
- **Customer dashboard** (06-account): dark sidebar, a big light-green "Place an order" button, a welcome card, four stat cards and tiles for each kind of service. This is the GSMVPro / Dhru client-area layout the owner wanted, in our own colors. The light green #7CE0A8 button with ink text reads well (11.51:1).
- **Wallet history** (08-wallet): each refund line names the order and the reason ("Refund, order #2: IMEI is blacklisted"). That is better than most Dhru stores, which show only bare amounts.
- **Add money page** (09-deposit): NatCash's own logo, a "Copy" button next to the number, quick amounts (500 / 1,000 / 2,500 / 5,000 HTG), a reference field and an optional screenshot. It matches how people in Haiti already pay by mobile money.
- **Admin** (10–12): a "To do now" list, a supplier balance warning, filter chips with counts (11-admin-orders), and one row per IMEI with its own status and result (12-admin-order). This is ahead of the standard Dhru admin.

### Problems, ranked
1. **The same order shows three different statuses in three colors** (06, 07, 11, 12).
   - What is wrong: The customer sees "Processing" in **green**, because `PROCESSING` uses the primary color, the same green family as "Done". The admin list shows "Working" in blue text. The admin order page shows "Working" as a green pill in the header and as an amber pill on the line. Order #2 also has one IMEI refunded, but the customer list still says only "Processing".
   - Why it matters: Green reads as "finished". A technician will think the unlock is done.
   - Fix: One label and one color per state everywhere.
     - In progress: blue, #1D5FA8 text on #E6EFFA (5.56:1).
     - Waiting on the customer or on a decision: amber, `--warning` #8F5300 on #FFF1D6.
     - Done: green.
     - Refunded: grey.
     - Failed: red.
   - For orders with several IMEIs, show the same summary the admin sees ("1 done · 1 working · 1 refunded") in the customer order list.
2. **Wallet card text is too faint in the top-left corner** (06-account).
   - What is wrong: The gradient starts at #2FA36A, and a 45% #7CE0A8 glow lightens it further, to about #52BE86. Measured on those colors:
     - White text: 3.20:1 on #2FA36A, 2.32:1 on the glow.
     - #D3EEDD labels ("Wallet", "AVAILABLE BALANCE"): 2.60:1 and 1.88:1. Both fail.
     - The "held" amount in #FFD48A: 2.29:1.
   - Why it matters: This is the money screen. It must be the easiest screen to read.
   - Fix:
     - Change the gradient to `linear-gradient(140deg, #1F7A4D 0%, #17603C 50%, #0F3D27 100%)`.
     - Cut the glow from `/45` to `/15`.
     - Change the labels from #D3EEDD to #E9F7EF.
     - Result: white text is at least 5.32:1, labels at least 4.81:1, and the held amount about 4.6:1 or better.
3. **The wallet looks different on two pages** (06 vs 08).
   - What is wrong: The dashboard wallet card is green; the wallet page card is black with a light-green button.
   - Fix: Use the same green WalletCard on 08 and keep the history below it. Users learn that green means "my money".
4. **Account pages still carry the whole store around them** (06, 07, 08, 09).
   - What is wrong: The store header, the category bar and the full footer (about 450 px) surround every account page. On the phone there is also a row of tabs (Dashboard / My orders / Services / Wallet) that repeats the bottom tab bar.
   - Fix:
     - Hide the category bar and the big footer under `/account`; keep only a one-line footer.
     - On the phone, drop the tab row and rely on the bottom bar.
     - Add a fifth bottom tab, "Account", that opens the sidebar menu.
5. **Order rows are hard to scan for technicians** (07-account-orders).
   - What is wrong:
     - Rows show no IMEI.
     - Titles repeat the service three times ("iPhone USA AT&T unlock — Clean IMEI, iPhone USA AT&T…").
     - There are no filter chips.
   - Fix:
     - Title: show "iPhone USA AT&T unlock × 3".
     - Second line: show the IMEIs as "IMEI …8812343" in monospace, 13 px.
     - Add the admin-style filter chips (All / In progress / Done / Refunded).
     - Add a "Repeat order" button, as in talabat/DoorDash on Mobbin.
6. **Emoji icons in "Shop by type"** (06).
   - What is wrong: UnlockTool, Chimera and Octoplus all use the same 🔑 emoji. Emoji also look different on every phone.
   - Fix: Reuse the UT / CH / OP initial tiles from the home page, 36 px ink squares with #7CE0A8 letters, and simple line icons for the other categories.
7. **Sidebar section labels are faint** (06, 07, 08, 09).
   - What is wrong: "STORE / WALLET / ACCOUNT" use white at 40% opacity on #111418, which is 3.82:1. That passes only for large text, and these are 11 px.
   - Fix: Use `text-white/55` (about 5.9:1). The menu items (white/70, 9.32:1) and the active item (14.04:1) are fine.
8. **Admin dashboard puts empty space first** (10-admin-dashboard).
   - What is wrong: The empty 14-day chart takes the prime spot, while "To do now" sits beside it.
   - Fix: When the chart has no data, collapse it to an 80 px sparkline. Make "To do now" full width above it, and color its non-zero counts amber (#8F5300).
9. **Dark-mode "Processing" badge** (not in these screenshots; this is from the code).
   - What is wrong: #1F7A4D on #12291C is 2.90:1.
   - Fix: Problem 1's switch to blue removes this.

### Contrast: signed-in screens

| Pair | Ratio | Result |
|---|---|---|
| Sidebar item white/70 on #111418 | 9.32 | Pass |
| Sidebar active white on white/10 | 14.04 | Pass |
| Sidebar email white/50 | 5.33 | Pass |
| Sidebar section label white/40 | 3.82 | **Fail** (small text) |
| "Place an order" ink on #7CE0A8 | 11.51 | Pass |
| Welcome card date #7CE0A8 on ink | 11.51 | Pass |
| Welcome card subtitle white/70 on ink | 9.32 | Pass |
| Wallet: white on #2FA36A (start) | 3.20 | Large text only |
| Wallet: white on glow area (#52BE86) | 2.32 | **Fail** |
| Wallet: #D3EEDD on #2FA36A | 2.60 | **Fail** |
| Wallet: white on #1F7A4D (middle) | 5.32 | Pass |
| Wallet: #D3EEDD on #1F7A4D | 4.32 | **Fail** (just) |
| Wallet: white on #0F3D27 (end) | 12.23 | Pass |
| Wallet: held #FFD48A on #2FA36A | 2.29 | **Fail** |
| Proposed: #E9F7EF on #1F7A4D | 4.81 | Pass |
| Badge "Processing" #1F7A4D on #E4F3EA | 4.64 | Pass, but wrong meaning |
| Dark mode "Processing" #1F7A4D on #12291C | 2.90 | **Fail** |
| Proposed in-progress #1D5FA8 on #E6EFFA | 5.56 | Pass |
| Admin "Working" #154A80 on white | 9.04 | Pass |
| Refunded #4A5048 on #ECEEE9 | 7.10 | Pass |
| Cancel button white on #C62F3C | 5.42 | Pass |
| Admin active nav white on #1F7A4D | 5.32 | Pass |

Facts vs judgment: the ratios and quoted colors are measured. The ranking and the layout fixes are my judgment.

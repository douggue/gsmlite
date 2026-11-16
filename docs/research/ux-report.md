# GSMLite UX research: ordering, paying and tracking

## Verdict
The structure is right for this industry. The public catalog shows delivery time on each service, and a single order card takes many IMEIs. The account follows the Dhru/GSMVPro client-area pattern technicians know: "Place an order" on top, then Wallet, then Account. The admin opens on "To do now" and a "Needs decision" queue. What holds GSMLite back is **trust and clarity, not navigation**. The homepage shows "1 orders delivered / 1 customers". The wallet says balance "cannot be withdrawn", which is the refund style users complain about most. The customer sees a different order status than staff do. Adding money is manual NatCash only, with no time promise. For technicians, the missing pieces are order search by IMEI, a per-IMEI view, notes and an API. For staff on a phone, the key filter is cut off and the only refund button refunds the whole order.

---

## Industry patterns (sites I actually looked at)
*Verified facts. Some sites were unreachable from this session: gsmvpro.com, gsm-server.com and officialiphoneunlock.co.uk (DNS blocked), and doctorsim.com, halabtech.com, imei.info, imeicheck.net and dhru.com (HTTP 403). For DoctorSIM I used its Trustpilot reviews instead.*

| Site | URL | Ordering | Tracking / results | Trust |
|---|---|---|---|---|
| UnlockBase | https://www.unlockbase.com/ | Brand row, then "Send to us your IMEI"; wholesale price list | "Track your Order"; archive kept 1 year, searchable by IMEI; resellers track per end customer; developer API; employee sub-accounts | "No Hidden Fees – Your quoted price is final"; 4.9/5 from 15,681 reviews; registered company in footer |
| iUnlocker | https://www.iunlocker.com/ | Type IMEI, then "Detecting your device…", then "Choose a check" (Free / Instant paid) | Delivery window on every card ("1–10 minutes", "5–35 days"); "Tracking Order" | "If not delivered within the stated time slot… full refund via the same payment method… no vouchers or partial refunds"; Trustpilot 4.5; since 2012; Telegram; replies "within 1–12 hours" |
| UnlockRiver | https://www.unlockriver.com/ | "Select the country and carrier your phone is locked to", then price and time; confirm the phone is not reported stolen | "Track Order" in the header | "Refund if we can't unlock"; 4.2/5 from 3,300+ Trustpilot reviews |
| Sickw | https://sickw.com/ | "Scan IMEI" (photo recognition), "Clipboard" (last 14 IMEIs), "Save Service"; price shown as "0.06$ – iPHONE CARRIER" | Result on the same page | Telegram bot @imeisn_bot; group pricing |
| iFreeiCloud | https://www.ifreeicloud.co.uk/ | Instant checks "delivered from the SAME page"; bulk tool about 500 checks per minute | CSV/JSON export; "live update about your order, 24/7" | "Two different APIs for DHRU Fusion and for PHP" |
| Dhru-style client area (Service4Mobile help) | https://service4mobile.tawk.help/article/how-to-place-new-imei-order | Pick a service by group, search or brand/model; each shows price, "Delivery time for this service", and whether it supports bulk, cancel and verify; IMEIs one per line; **note field** "to identify the device, such as a customer name or price" | "Quick Place Order List" (https://service4mobile.tawk.help/article/how-to-works-add-to-quick-place-order) | Customer feedback shown per service |
| Dhru Fusion API | https://help.dhru.com/en/articles/10892898-api-integration | The API places IMEI/server orders, lists services, checks status and balance | — | Client wallets and tiered reseller pricing |

---

## What users care about most (sources)
1. **A real refund, actually paid, not credit.** "they still failed to process it. I am still waiting for my refund" (DoctorSIM 1★); "Doctor SIM generously refunded me" (5★). https://uk.trustpilot.com/review/doctorsim.com?page=3. "the initial amount is not refundable" (Expressunlocks 2★). https://www.trustpilot.com/review/expressunlocks.com?page=6. A search summary of Expressunlocks reviews also mentions credit notes given instead of refunds.
2. **Top-ups that show up.** "I do not get the topup on my account." (DoctorSIM 4★)
3. **Speed against the stated time.** "the code came through in about 40 minutes, way faster than the 24 hours" (DoctorSIM 4★).
4. **A human who answers.** "Service response is very slow, no customer service for complaints", on IN GSM, a technician wallet site that promises "If any order is rejected, the amount is automatically refunded to your wallet". https://www.trustpilot.com/review/in-gsm.com (3.5★, 75% one-star).
5. **No surprise fees.** UnlockBase leads with "No Hidden Fees".
6. **Proof the seller is real:** review counts, years in business, a registered company.

---

## What we already do well (keep)
- **The order card** (option, IMEI, pay with, total) under "Price · Delivery time · Success rate", plus "Most refused orders: IMEI is blacklisted. Run an IMEI check first" with a $1.50 shortcut (03-service). No competitor I saw does this pre-sale advice as well.
- **Live per-line IMEI validation**; what you typed is kept through sign-in (`ServiceOrder.tsx`).
- **Account shell:** a green "Place an order" button on top of the sidebar, a balance chip in the header, a wallet card with "Add money / Exchange / Shop", and "Shop by type" tiles (06-account-desktop). This matches GSMVPro and Dhru.
- **Refund lines name the reason:** "Refund, order #2: IMEI is blacklisted" (08-wallet).
- **Add money (NatCash):** numbered steps 1–3, a copy button on the number, presets of 500/1,000/2,500/5,000 HTG, "Where do I find the reference?", and an optional screenshot (09-deposit). It is close to the MoonPay/GoPay patterns on Mobbin.
- **Admin home:** "Handle what needs me", a "To do now" list, supplier balances with "GSM Server Pro balance low" (10-admin-dashboard).
- **Admin order:** one row per IMEI with Done/Working/Refunded and the result text, "Deliver by hand…", "Send waiting lines again", and "Copy link" to the customer's status page (12-admin-order). The admin list shows "1 done · 1 working · 1 refunded · 3 IMEIs" (11-admin-orders).

---

## Problems ranked by impact

**1. "Cannot be withdrawn" undercuts the money-back promise.** *Owner, 08-wallet, 09-deposit.* The footer says "Money-back guarantee". The wallet says "Wallet balance is store credit… It cannot be withdrawn. Large deposits are held for 24 hours." A one-time owner whose IMEI is blacklisted gets $25 they can never use. This is exactly the "credit, not refund" complaint. **Fix:** let a customer ask for a refund of failed-order money back to MonCash/NatCash (even with a small fee or a 48-hour delay), and say so next to "Refund if not done". Explain the 24-hour hold *before* someone deposits, with the amount that triggers it.

**2. The customer sees less, and different things, than staff.** *Technician, 06-account, 07-account-orders vs 11/12-admin.* Order #2 has 1 done, 1 working and 1 refunded. The customer list shows only "Processing" and a truncated "iPhone USA AT&T un…", with no IMEIs. The dashboard says "Delivered 0 · Refunded 0" next to a "+$25.00 Refund" line. Staff say "Working", customers say "Processing". **Fix:** use the admin's line summary in the customer list ("3 IMEIs · 1 done · 1 working · 1 refunded"), count stats per IMEI, use one status vocabulary, and show the IMEI (last 6 digits) on each row.

**3. Social proof that hurts trust.** *Owner, 01-home-desktop.* The page shows "1 orders delivered · 1 customers", and "Some services are slow" twice. **Fix:** hide counters below a threshold. Show real reviews and "since 20XX, Port-au-Prince". Make the "slow" notice name the services it means.

**4. Adding money: one manual method, no time promise, mixed offers.** *Owner paying with MonCash, 08-wallet, 09-deposit, 01-home.* The only method is "NatCash · Checked by staff". There is no MonCash, card or crypto, and nothing says how long staff take. The home page promises "+10% on your first top-up", the wallet says "+3% on $50+", and the history shows "+10%". The minimum reads "131.50 HTG", an odd number converted from $1. **Fix:** show every enabled method, MonCash first for Digicel users. Add "Usually credited in about 15 min, 8am–8pm" plus a pending-deposit row in History. Use one promo rule. Round the minimum (for example 150 HTG). Ask for the phone number before the reference, since people know it.

**5. No fast lane for technicians.** *Technician with 20 IMEIs, 07-account-orders.* The list has no search, no filters and no IMEI column, and stops at 100 orders (`account/orders/page.tsx`). There is no note per order (customer name) and no reorder. **Fix:** add search by IMEI or order number, chips (Working / Done / Refunded), a per-IMEI view with a copy-result button, an optional "customer / note" field, and "order again".

**6. Fixed bars cover the important buttons on phones.** *All, 03-service-phone, 06-account-phone, 08-wallet-phone, 09-deposit-phone, 12-admin-order-phone.* The 4-tab bar sits on the wallet card exactly where "Add money / Exchange / Shop" are on first view. It covers the deposit amount, and on the service page it stacks under the "Total / Order" bar (about 130 px of an 844 px screen). **Fix:** add bottom padding equal to the bar height on every page, hide the tab bar on order, deposit and admin-order pages, and merge the two bars into one.

**7. Admin on a phone: the key filter is hidden and refund is all-or-nothing.** *Staff with a stuck order, 11-admin-orders-phone, 12-admin-order-phone.* The "Needs decision" chip is cut off at the right edge. List rows don't say *why* an order is stuck. In the order, the "Working" line shows no supplier, no time waiting and no error. The only refund is the big red "Cancel and refund to wallet…" for the whole order. There is no button to contact the customer, and the status history skips the per-IMEI events (done, refunded). **Fix:** put "Needs decision" first and show a stuck reason on each row ("Supplier: no reply 3 h"). On each line show supplier, ref, "waiting 3 h", plus "Retry" and "Refund this IMEI". Add a WhatsApp button to the customer. Log each IMEI's events in History.

**8. Prices in two currencies on one screen.** *Owner, 03-service.* The toggle says USD and the price is "$25.00", but NatCash is preselected, so the total shows "3,287.50 HTG". It reads like a hidden fee. **Fix:** follow the toggle and show the other currency as a secondary line ("≈ 3,287 HTG").

**9. Clipped tile labels, low density.** *All, 02-store.* The star covers the labels ("IER UNLOCK"), and only about 4 services fit per phone screen. **Fix:** move the star. Default to list view for signed-in users.

**10. The free check requires an account.** *Owner, 04-check.* The page says "Free with your account". **Fix:** show brand, model and "valid" without sign-up, the way iUnlocker auto-detects the device; ask for an account only for the full report.

**11. Small polish.** The account chip row on phones shows only 4 of about 12 links (06-account-phone); put the rest under "More". The empty 14-day chart takes half a phone screen on the admin home (10-admin-dashboard-phone); collapse it when there are no sales. The hero and login panel are near-invisible on desktop (01-home, the earlier signed-out 06 capture).

---

## Missing features the industry expects

| Feature | Priority | Evidence |
|---|---|---|
| Customer order search by IMEI, plus per-IMEI status | **Must** | UnlockBase archive searchable by IMEI; resellers track per end customer |
| Refund failed-order money to the original method (on request) | **Must** | iUnlocker "full refund via the same payment method"; credit-only and slow-refund complaints on DoctorSIM and Expressunlocks |
| Reviews / rating and business identity | **Must** | UnlockBase 4.9 from 15k reviews and registration; iUnlocker and UnlockRiver Trustpilot counts |
| Note / customer reference per order | **Must** | Dhru-style note field |
| Automatic MonCash / card top-up with a stated credit time | **Must** (Haiti) | Product brief; "I do not get the topup on my account" (DoctorSIM) |
| Per-IMEI retry/refund and a stuck reason in admin | **Must** | Seen missing in 12-admin-order; Dhru exposes order status per IMEI through its API |
| Reseller API (Dhru-compatible) | **Must for resellers; nice for others** | UnlockBase "Developer API"; iFreeiCloud "APIs for DHRU Fusion"; Dhru API help |
| Quick reorder / favorite services | Nice | Dhru-style "Quick Place Order List"; Sickw "Save Service" and last-14-IMEI clipboard |
| CSV export of results and price list | Nice | iFreeiCloud CSV/JSON; UnlockBase wholesale price list |
| Scan IMEI with the camera | Nice | Sickw photo recognition |
| Device auto-detect from the IMEI | Nice (Must for owners) | iUnlocker "Detecting your device…" |
| Staff sub-accounts for a shop | Nice | UnlockBase sub-accounts |
| Telegram notifications | Built (`TelegramConnect`); promote it | Sickw @imeisn_bot |

Mobbin references: top-up with presets and the total shown before paying (MoonPay https://mobbin.com/flows/a7f5b4b0-3efc-43ac-a2e3-d3578050772a); payment-method list (GoPay https://mobbin.com/flows/231e4f86-393a-43b7-b230-c3a2210b0e0e); timestamped order timeline (talabat https://mobbin.com/flows/4e7b08af-e03b-4b10-b6e1-0df2544df3b5). The talabat timeline is the model for a per-IMEI history.

---

## Facts vs. judgment
- **Verified facts:** the quotes in the patterns table and the "users care" list, with URLs; what the screenshots show (06–12 are the new signed-in captures); code behavior where a file is named.
- **My judgment:** the ranking, the fixes, the must/nice labels, and whether the dark hero is an animation-capture artifact. I found no Haiti or Caribbean online seller I could verify, so the MonCash and HTG advice rests on the product brief. Searches surfaced no Reddit or GSMHosting threads, so the user evidence comes from Trustpilot only. Screens show test data (2 orders, "+509 0000 0000"), so empty-state and count issues may look different with real volume.

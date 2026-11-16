# GSMLite: phone usability test as Jean (repair shop, Port-au-Prince, iPhone 13 profile)

Screenshots are in this folder: /tmp/claude-0/-home-user-gsmlite/7fdc1769-23fb-54ac-a067-8b1018995540/scratchpad/tech-test/

## Verdict (Jean)
"Once I'm logged in, it's good: I paste my IMEIs, it catches the bad ones, I pay from my wallet in one tap, and I can see each IMEI's status. That's cleaner than GSMVPro. But as a visitor I don't see MonCash or NatCash anywhere, prices are in dollars, the WhatsApp number doesn't look real, and a refund stays stuck in the wallet, so I can't get it back as cash. I won't move my shop's money here until I can see how I pay in gourdes and how I reach a real person."

## Tasks

| # | Task | Result | Steps | Main problem |
|---|---|---|---|---|
| 1 | Understand the home page and find the iPhone 13 AT&T unlock | Partial | 4 (search failed, then tapped the home card) | Searching "iPhone 13 AT&T", the exact example in the search box, gives **0 results**. The live site says "Peye ak bous ou" and never mentions MonCash or NatCash |
| 2 | Price, time, success rate; total for 6 IMEIs in USD and HTG | Partial | 2 for the price, 4 for HTG | 25 $US, 1–3 jou. Success rate shows "Nouvo sèvis" instead of a number. HTG only appears after Meni → HTG: 6 × 3 287,50 = **19 725 HTG** (150 $US) |
| 3 | Free IMEI check | Partial | 2 taps | Signed out it only says "Valab". Signed in, the model shows "Poko nan lis nou" and the brand shows "—". The install-app sheet covered the result |
| 4 | Order 3 IMEIs from the wallet, then check each one | Success | 3 (paste, tap, done in ~4 s) | Detail page is great. The orders list shows "N ap prepare l" for every order, even one that is partly done and partly refunded |
| 5 | NatCash 1 000 HTG top-up (stopped before submit) | Partial | 5 | Steps are clear, but nothing says how long verification takes or when the money arrives. No USD value is shown for 1 000 HTG |
| 6 | Where refunds show up; can they go back to MonCash/NatCash? | Found / **No** | 2 | Refunds go to the wallet only ("Ou pa ka retire l"). MonCash is not on the site at all |
| 7 | Buy Chimera credits | Success | 3 taps + type username | The page jumps to #order, so the title and price sit under the header |
| 8 | Reach a human fast | Fail (live) | ~6 screens of scrolling | WhatsApp is only at the bottom of the home page and points to wa.me/50900000000. Telegram is promised but not linked anywhere. Neither is in the menu |

## Problems, ranked by lost sales and repeat customers

1. **I can't see how to pay in gourdes (live).** `t1-01-home-ht.png`, `t1-20-faq-payment.png`, `t2-02-product-scroll1.png`. The hero, FAQ and product page only say "Bous". MonCash and NatCash appear nowhere, and prices default to USD even on /ht. HTG is hidden in the hamburger menu (`t2-20-htg-toggle.png`). *Fix:* add "Peye ak MonCash / NatCash" with logos in the hero and next to every price. Make HTG the default on /ht, or show "≈ 3 288 HTG" under each USD price.
2. **Fake or buried contact.** `t8-01-menu.png`, `t8-03-home-whatsapp.png`. The live WhatsApp button points to +509 0000 0000. There is no Telegram link, although "WhatsApp ak Telegram" is promised on every page. Contact is missing from the menu and header. *Fix:* put the real number in. Add a floating WhatsApp button, or put WhatsApp and Telegram at the top of the menu.
3. **Search says "nothing" for a model name.** `t1-11-search-results.png`. "iPhone 13 AT&T" and "iPhone 13" both return 0. "iPhone AT&T" and "att" work. *Fix:* ignore model numbers or map them to the brand. Never show an empty page: show "Debloke iPhone USA AT&T" as the closest match.
4. **Refund money is trapped.** `t5-02-wallet-scroll1.png`, `t6-03-refund-policy.png`. Wallet credit can't be withdrawn. Large deposits are held 24 h, and that is only in small print. The policy says orders with a bad IMEI "may not be refundable", which clashes with "Garanti ranbousman". *Fix:* show all three rules on the top-up page before the customer pays. Offer cash-out of refunds to MonCash/NatCash, even with a fee or delay.
5. **Top-up timing is unknown.** `t5-11-natcash-top.png`, `t5-12-natcash-amount.png`. Nothing says "verified in about X min, open hours…". The wallet shows separate USD and HTG balances (7 $US / 0 G), so it's unclear whether HTG pays for USD-priced orders. *Fix:* add one line with the expected wait and a notification promise. Show "1 000 HTG ≈ 7,60 $US" and say the HTG balance pays orders directly.
6. **No success rate, and the free check is weak.** `t2-01-product.png`, `t3-05-result-local.png`. Every product shows "Nouvo sèvis" instead of a %. The free check can't name an iPhone 13. *Fix:* show a real % or the "done in last 30 days" count. If the model is unknown, still say "Apple iPhone" from the TAC code.
7. **Orders list status is vague.** `t4-06-orders-list.png`. Every row says "N ap prepare l". The titles repeat the product 3 times and get cut off ("Debloke iPhon…"). *Fix:* show "1 fini · 1 ranbouse · 1 ap fèt" on each row.
8. **English, French and English-style dates on /ht.** `t5-02-wallet-scroll1.png` ("Refund, order #2: IMEI is blacklisted", "Top-up bonus +10%"), `t6-02-order2-scroll.png` ("IMEI is blacklisted", "Unlocked successfully…"), `t3-03-result.png` (French "Sur l'écran d'accueil", "Ajouter"), and "Nov 16, 6:59 PM" dates. The amount chips mix "1,000 HTG" with "1 000 HTG". The wallet promises +3% while the history shows +10%. *Fix:* translate system strings, use Kreyòl dates (16 nov.) and one number format.
9. **Phone ergonomics.** The install-app sheet pops over the IMEI result (`t3-03-result.png`). On the product page, the sticky header, order bar and bottom nav take about 190 px, around 23% of the screen (`t2-01-product.png`). Tap targets under 44 px: footer links (18 px tall), "Wè tout sèvis yo ›" (20 px), "Kote pou m jwenn referans lan?" (20 px), "Chanje USD ↔ HTG" (16 px), and the header cart and menu buttons (36–40 px). *Fix:* show the install sheet only after a finished order, enlarge these links to 44 px, and hide the bottom nav while the order bar is visible.

Minor: "Okazyon jodi a" shows normal prices with no visible discount (`t1-03-home-scroll2.png`). Pasting an IMEI in the hero fills the check page but doesn't run it, so one extra tap (`t3-10-hero-imei.png`). The account tab "Sipò" is off-screen in a sideways tab strip. There is no confirm step before spending 75 $US (fast, but risky with 20 IMEIs).

## What Jean liked (keep)
- **Bulk IMEI paste with instant checks in Kreyòl.** It catches wrong length and wrong check digit and drops duplicates. The button says "Kòmande pou 3 telefòn" (`t2-10-six-imeis.png`, `t4-03-before-order.png`).
- **Per-IMEI tracking.** Order detail shows a timeline per IMEI, the Fini/Ap fèt/Ranbouse counters, a copy-result button, and why a refund happened (`t4-05-order-result.png`, `t6-02-order2-scroll.png`).
- One-tap wallet ordering. Chimera credits take 3 taps from home.
- When signed in, the "An goud" line shows the HTG total next to USD.
- NatCash help sheet with a sample SMS showing where the reference is.
- Big main buttons, no sideways scroll, and a light page: about 360 KB and 28 requests. On Slow 3G the hero text and search showed in about 2–3.5 s and the full load took 12.5 s (`t9-slow3g-2s.png`, `t9-slow3g-12s.png`).
- "Mande èd sou WhatsApp" directly on the order page.

## Observed vs suspected
**Observed:**
- Everything in the table and the ranked problems.
- On live there is no NatCash/MonCash text and the default currency is USD.
- The live WhatsApp link is wa.me/50900000000.
- Local (signed in) shows NatCash and HTG and has the same placeholder numbers.
- Order #3 (3 × AT&T, 75 $US) and order #4 (10 Chimera, 6 $US) were placed locally and left the test wallet at 1 $US.

**Suspected (not verified):**
- NatCash, the real phone numbers and the HTG default may just be settings not yet configured on the live deployment.
- An HTG wallet balance may need a manual USD↔HTG exchange before it pays USD-priced orders.
- "Kèk sèvis ap pran reta" (local) vs "Tout sistèm yo ap mache" (live) reflects different data, not a bug.
- On a real iPhone, the keyboard plus the sticky order bar likely leave very little room to see the IMEI box.

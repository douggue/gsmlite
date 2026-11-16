# UI + UX research, 2026-11-16: does GSMLite fit the phone-unlock industry?

Full reports: [ui-report.md](ui-report.md) (look, colors, contrast) and [ux-report.md](ux-report.md) (layout, flows, features).
Compared with: UnlockBase, iUnlocker, UnlockRiver, Sickw, iFreeiCloud, Chimera, Dhru-style client areas, Codashop, SEAGM, plus Trustpilot reviews.
Could not be opened from the research session: GSMVPro, GSM-Server, DoctorSIM site, IMEI.info, IMEIcheck.net, Halabtech. No Haitian online seller found to compare.

## Verdict
- **Colors: keep them.** Ink + green stands out (competitors are blue or pink/purple) and reads as "money, trustworthy service", not gaming/crypto.
- **Layout: right for the industry.** The account matches the GSMVPro / Dhru client area technicians know; the order card, delivery time per service, "refund if not done" and the IMEI-check advice are at or above the best competitor.
- **What holds it back is trust and clarity, not navigation.**

## Fix list (ranked)

### A. Quick fixes (bugs, contrast) — small, low risk
1. One status vocabulary and color everywhere: in progress = blue, waiting = amber, done = green, refunded = grey, failed = red (today the customer sees a green "Processing", staff see "Working").
2. Wallet card: darker gradient (#1F7A4D → #17603C → #0F3D27), softer glow, labels #E9F7EF — labels and "held" amount fail contrast today.
3. Dark mode: lighter green for green text (#4FC487); warning text #8F5300; sidebar section labels white/55.
4. Phone bottom bar covers buttons (wallet card actions, deposit amount, order bar): add padding, hide it on order/deposit pages, one bar instead of two on the service page.
5. Store tiles: favorite star covers the category label; same wallet card on dashboard and wallet page; "Check now" looks disabled.
6. Admin phone: "Needs decision" chip cut off; empty chart / empty "Top services" box take space or misalign.
7. Prices: follow the USD/HTG switch and show the other currency small ("$25.00 ≈ 3,287 HTG").

### B. Trust (biggest impact on first-time buyers)
8. Hide "1 orders / 1 customers" until the numbers are real; show reviews, "since 20XX, Port-au-Prince", payment logos.
9. Payment methods: only NatCash shows today (MonCash and cards appear once their keys are in Vercel). Show every enabled method, with a time promise for manual top-ups ("usually 15 min, 8am–8pm").
10. One top-up promo rule (home says +10% first top-up, wallet says +3% on $50+).
11. **Owner decision:** wallet money "cannot be withdrawn". Credit-only refunds are the top complaint in reviews. Option: allow a refund of failed-order money back to MonCash/NatCash on request (fee or delay allowed).

### C. Technicians (repeat buyers)
12. Customer orders: search by IMEI / order number, filter chips, IMEI on each row, per-IMEI status ("3 IMEIs · 1 done · 1 working · 1 refunded").
13. Note / customer name per order, "order again", list view by default when signed in.
14. Reseller API (Dhru-compatible) — must for shops that resell.
15. Nice to have: CSV export, scan IMEI with camera, device auto-detect before choosing a service, staff sub-accounts.

### D. Staff
16. Order page per line: supplier, waiting time, "Retry" and "Refund this IMEI" (today only whole-order refund), WhatsApp the customer, per-IMEI history.

### E. Free check
17. Show brand/model/valid IMEI without an account; sign-up only for the full report.

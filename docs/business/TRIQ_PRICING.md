# TRIQ pricing (final, 2026-10-27, raised same day)

Source of truth for numbers: `src/lib/pricing.ts`. Site copy (`/`, `/pricing`, FAQ, calculator) reads from it.
Prices below are **before 18% GST**.

## 1. Final prices

### Academies (India, INR per month)

| Plan | Price | Notes |
|---|---|---|
| **Free** | ₹0, forever | Up to 30 active students. AI assistant: 50 actions/month. |
| **Growth** | ₹20 per active student for students 1–100, ₹12 for 101–500, ₹8 above 500 | Minimum ₹699/month. Each band is charged at its own rate, so the bill never drops when a student is added. AI: 1,000 actions/month. |
| **Academy** | Custom | Multi-centre, schools, federations; consolidated reports, branding, account manager. |

- **Annual:** pay 10 months, get 12.
- **Founding offer (unchanged):** first 50 academies, 50% off for 12 months, free migration within 24 hours.
- **Active student** = enrolled in at least one batch that month.

| Active students | Growth / month | With founding offer | First proposal (₹15/10/7, min ₹499) | Original (₹25, min ₹749) |
|---|---|---|---|---|
| 31 | ₹699 | ₹350 | ₹499 | ₹775 |
| 50 | ₹1,000 | ₹500 | ₹750 | ₹1,250 |
| 100 | ₹2,000 | ₹1,000 | ₹1,500 | ₹2,500 |
| 200 | ₹3,200 | ₹1,600 | ₹2,500 | ₹5,000 |
| 500 | ₹6,800 | ₹3,400 | ₹5,500 | ₹12,500 |
| 1,000 | ₹10,800 | ₹5,400 | ₹9,000 | ₹25,000 |

**Founder decision (2026-10-27):** rates raised from the first proposal to ₹20/₹12/₹8 with a ₹699 minimum. This puts Growth at about 1.7× ArenaFlow and 2.9× ScoreUp at 100 students; the founding offer brings early academies to roughly ArenaFlow's level. The price has to be carried by features competitors lack (parent and coach apps, GST invoices, calendar, business report, AI).

### Outside India (USD per month)
Same Free tier (30 students). Growth **US$1 per active student, minimum US$49**. Local taxes may apply.

### Other verticals
| Area | Price | Why |
|---|---|---|
| Court and venue bookings (Spaces) | **0% commission** | Hudle advertises 0%; venues compare on this. Revenue comes from the subscription. |
| Fee and booking payments | **0% markup** | Money goes to the academy's own Razorpay/UPI account; the academy pays only its gateway's fees. |
| Kit store, Careers, Wellness, Creators, Brand Studio, Education | **No charge during launch** | No commercial model is defined in the master plan; adding fees needs a payments flow and a founder decision. |
| AI | Included (allowance above) | Claude Haiku 5.5 costs a fraction of a rupee per action; platform-wide cap ₹5,000/month (`AI_MONTHLY_BUDGET_INR`). |

## 2. Research (what the market charges)

| Product | Market | Pricing | 100 students | 500 students |
|---|---|---|---|---|
| ScoreUp | India | Flat bands, from ₹150 (≤20) | ₹700 | ₹2,400 |
| ArenaFlow | India | Flat bands, from ₹289 (≤20); add-ons (WhatsApp ₹399, payroll ₹599…); GST extra | ₹1,149 | ₹4,500 |
| Sportia | India | Flat, ₹999–₹12,999/month; 14-day trial | — | — |
| SharePlay Pro | India | Per user + 1% of transactions + ₹5,000 setup | — | — |
| Sportzy, spynPRO, TurfBox | India | Quote only | — | — |
| ClassCard | Global | US$99 / 199 / 349 per month, unlimited students; card fees 2.9% + 30¢ | US$99 | US$99+ |
| Hudle (venues) | India | 0% commission advertised | — | — |
| Playo (venues) | India | ~2% convenience fee to players (per a third-party analysis) | — | — |
| Razorpay | India | 2% + 18% GST per transaction (UPI, cards, netbanking); UPI AutoPay +0.99% | — | — |

**Reading:** India is priced at ₹5–12 per student per month for operations software. TRIQ's original ₹25 was 2–5× the market. TRIQ does more (parent app, coach app, GST invoices, calendar, business report, AI, venues), so Growth is priced at a premium (₹20 for the first 100 students), and the founding offer halves it for early academies. The free tier (30 students) is TRIQ's wedge: none of the Indian products above has a permanent free plan of that size.

## 3. Not built yet (must be done before charging)
1. **Subscription billing is not automated.** No code charges academies. Until it exists, invoice manually.
2. **Plan names in the database are legacy** (`FREE_TRIAL`, `STARTER`, `PRO`). Code maps them; the cleanup migration awaits approval (`docs/migrations/pending/plan-vocabulary-reconciliation.md`).
3. **International prices are not on a currency-aware page**; they are stated in text on `/pricing` and the FAQ.
4. **Student limits on Growth** remain soft caps in `PLAN_LIMITS`.

## 4. Sources (checked 2026-10-27)
- ScoreUp — https://www.scoreup.in/promo
- ArenaFlow — https://arenaflow.in/
- Sportia comparison (vendor blog, lists Sportia, SharePlay Pro, Sportzy, spynPRO) — https://sportia.app/blog/best-sports-academy-software-india-2026
- TurfBox — https://turfbox.in/sports-academy-management-software.html
- ClassCard — https://www.classcardapp.com/pricing
- Hudle — https://www.hudle.in/list-your-sports-venue
- Playo monetisation analysis (third party) — https://growthx.club/proof-of-work/health-wellness-and-fitness/playo/monetization-project-----playo%7C67d91570685d52e5b28d82de
- Razorpay pricing explained — https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/
- Claude pricing — https://platform.claude.com/docs/en/about-claude/pricing

# TRIQ pricing (final, founder decision 2026-10-29)

Source of truth for numbers: `src/lib/pricing.ts`. Site copy (`/`, `/pricing`, FAQ, calculator) reads from it.
Prices below are **before 18% GST**.

## 1. Final prices

### Academies (India, INR per month)

| Plan | Price | Notes |
|---|---|---|
| **Free** | ₹0, forever | Up to 30 active students. AI assistant: 50 actions/month. |
| **Growth** | **₹150 per active student per month**, the same rate for every student | Minimum ₹699/month, before 18% GST. Applies once the academy goes above 30 active students; every active student is then billed at ₹150. AI: 1,000 actions/month. |
| **Academy** | Custom | Multi-centre, schools, federations; consolidated reports, branding, account manager. |

- **Annual:** pay 10 months, get 12.
- **Founding offer:** first 50 academies, 50% off for 12 months, free migration within 24 hours.
- **Active student** = enrolled in at least one batch that month.
- The ₹699 minimum is a floor only; at ₹150 per student any paid academy (31+ students) is already above it.

| Active students | Growth / month (before GST) | With founding offer | With 18% GST (no offer) | Previous (₹20/12/8, min ₹699) |
|---|---|---|---|---|
| 30 | ₹0 (Free) | ₹0 | ₹0 | ₹0 |
| 31 | ₹4,650 | ₹2,325 | ₹5,487 | ₹699 |
| 50 | ₹7,500 | ₹3,750 | ₹8,850 | ₹1,000 |
| 100 | ₹15,000 | ₹7,500 | ₹17,700 | ₹2,000 |
| 200 | ₹30,000 | ₹15,000 | ₹35,400 | ₹3,200 |
| 500 | ₹75,000 | ₹37,500 | ₹88,500 | ₹6,800 |
| 1,000 | ₹1,50,000 | ₹75,000 | ₹1,77,000 | ₹10,800 |

**Founder decision (2026-10-29):** Growth is ₹150 per active student per month, the same rate for every student (no volume bands), minimum ₹699/month before 18% GST, free up to 30 students. Founding offer: 50% off for 12 months for the first 50 academies. International pricing is unchanged (US$1 per student, minimum US$49).

History: 2026-10-27 first proposal ₹15/₹10/₹7 (min ₹499), raised the same day to ₹20/₹12/₹8 (min ₹699); replaced by the flat ₹150 rate on 2026-10-29.

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

**Reading:** comparable Indian operations software works out to roughly ₹5–20 per student per month. TRIQ does more (parent app, coach app, GST invoices, calendar, business report, AI, venues), and the founding offer halves the price for early academies.

> **Note (2026-10-29):** the founder-approved ₹150 per student is well above the ₹5–20 per-student band seen in the comparables above (about 13× ArenaFlow and 21× ScoreUp at 100 students; ₹75 with the founding offer is still several times higher). The competitor table is kept as-is for reference. The free tier (30 students) is TRIQ's wedge: none of the Indian products above has a permanent free plan of that size.

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

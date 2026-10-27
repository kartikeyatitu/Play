# TRIQ — Market-fit audit and refinement priorities

**Date:** 2026-10-27 · **Base:** `main` @ `76755fc`+ · **Method:** repository evidence (grep counts, route and flag inventory) compared with the feature sets that sports-academy products advertise.

Status: **Strong** = built and wired · **Partial** = present but incomplete · **Missing** = not in the product · **Unverified** = present in code, not tested end to end.

## Competitor baseline (what buyers now expect)

Read from one vendor-published comparison (ClassCard, 2026) and Capterra listings. The comparison is written by a vendor, so treat it as a checklist, not a neutral benchmark.

- Online enrolment, registration forms and waivers.
- Automated monthly billing with failed-payment retries.
- Lead pipeline from enquiry to trial to enrolment.
- Family accounts: several children under one login, sibling discounts.
- Attendance and session notes on a mobile app.
- Online self-booking for families.
- Automated email campaigns, promotions and memberships.
- Video feedback and clip annotation (CoachNow, Hudl).
- Scholarship and subsidy management; league and tournament administration.

Sources: [ClassCard — best sports coaching software for academies 2026](https://www.classcardapp.com/blog/best-sports-coaching-software-for-academies-in-2026), [Capterra — AcademyPro](https://www.capterra.com/p/198997/AcademyPRO/), [Capterra — Saas for Sports Academy](https://www.capterra.com/p/10049773/Saas-For-Sports-Academy/).

## TRIQ against the baseline

| Expectation | Status | Evidence / gap |
|---|---|---|
| Attendance and session notes | Strong | Coach app and attendance modules; parent updates |
| Fees, receipts, concessions | Strong | Fee records, receipts, fee plans, concessions and scholarships |
| Scholarships / subsidies | Partial | Scholarship and concession code exists (15 files); no subsidy workflow review yet |
| Enrolment and trials | Partial | Trials, join and register pages; no full enrolment-with-waiver flow verified |
| Waivers | Unverified | Referenced in 8 files; no signed-waiver record found in the audit |
| Failed-payment retries | Unverified | Retry logic in 7 files; AutoPay retries not tested with real Razorpay |
| UPI AutoPay | Unverified | Shipped flag on, tables live; no live payment test yet |
| GST invoices | Partial | Shipped flag on; needs a real-invoice review by a tax adviser |
| Lead pipeline | Partial | Leads pages and trial flow exist; stage automation not verified |
| Family accounts, sibling discounts | Partial | Sibling discount logic in 2 files; multi-child family login not confirmed |
| Self-booking for families | Partial | Public booking page `/book/[slug]` exists; availability and payment path not verified end to end |
| Email / WhatsApp campaigns | Partial | WhatsApp deep links and templates; no automated campaign engine found |
| Push notifications | Missing | Service worker and manifest exist; no push subscription or VAPID code |
| Video feedback / clips | Missing | Coach highlight links only (YouTube, Drive); no upload, player or annotation |
| League / tournament admin | Partial | Competition and fixture models; results entry not verified for coaches |
| Mobile app | Partial | Responsive web and PWA shell; no native app |

## Refinement priorities

1. **Verify before adding** (no new code): test AutoPay, retries and GST end to end on a test academy, then record the results in this file.
2. **Family accounts and sibling discounts:** one login for several children, with the discount applied automatically. This is the most common gap for academies with siblings.
3. **Self-booking polish:** the public booking flow needs a real availability check and a clear payment step before we advertise it.
4. **Push notifications:** wire web push through the existing service worker so parents get attendance and fee alerts.
5. **Waivers at enrolment:** store a signed waiver record per child, linked to the enrolment.
6. **Campaigns (later):** only after the lead pipeline and WhatsApp templates are verified.
7. **Video (later):** upload and playback first; annotation is a separate, larger project.

## Not in scope for this audit

- Pricing decisions (founder).
- Competitor feature claims beyond the sources above.
- Any change to production data or schema.

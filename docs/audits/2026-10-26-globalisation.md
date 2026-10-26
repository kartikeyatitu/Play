# TRIQ globalisation audit

- **Repo:** `/home/claude/triq`, branch `main` @ `d7f2fef` (= `origin/main`, all verticals merged, clean tree)
- **Date:** 2026-10-26
- **Mode:** read-only. No files edited; tsc, vitest and next build were not run.
- **Line numbers:** taken at `d7f2fef`. The tree changed once during the audit, and every number below was re-taken afterwards.

---

## 0. Executive summary

TRIQ already has a **good globalisation foundation**:
- `Organization.country/currency/timezone/locale/phoneCountry`
- `src/lib/i18n.ts` (Intl-based money, date and phone helpers)
- `OrgLocaleProvider` wired into `/org`, `/coach` and `/parent` layouts
- `lib/phone.ts`, which handles `+cc` numbers
- New vertical tables store integer minor units plus `currency`

**Adoption is very low.** The helpers are used by 6 files. The other ~260 components still hardcode India.

### Counts at d7f2fef (src/, tests excluded)

| Signal | Count |
|---|---|
| `₹` literals | **142 in 53 files** |
| `"en-IN"` literals | **65** |
| `Asia/Kolkata` literals | **28** |
| Hard `+05:30` / `5.5h` arithmetic | **16** |
| `ist*()` helper calls with no timezone (now silently **UTC**, see P0-1) | **35** |
| `"INR"` hardcoded in payment/booking paths | **20** |
| `"91"` prefixed onto 10-digit numbers outside `lib/phone.ts` | **16 sites** |
| Bare `toLocaleString()` / `toLocaleDateString()` (server/browser mismatch) | **53** |
| Hardcoded English UI strings (JSX text ≈1.2k, attributes ≈460, object-literal labels/errors ≈1k) | **≈2.5–3k** |
| i18n message framework | **none** (no next-intl, i18next or react-intl in `node_modules`) |
| Email provider | **none** (no Resend, SES, SMTP or similar) |

### Top 6 problems, in order

1. **P0 (already hurting India): the 2026-10-19 "globalise" commit `7a2ee26` broke "today".** `istToday()`, `istMonthString()` and `istWeekday()` in `src/lib/fees.ts:68-93` changed their default from `Asia/Kolkata` to `tz = "UTC"`. None of the 35 call sites pass a timezone.
   - Between 00:00 and 05:29 IST, "today" is yesterday. Early-morning attendance (5–5:30 am cricket and swimming batches), staff check-in, auto-sessions and fee "overdue days" go to the wrong day.
   - Other code still uses hard `+05:30` (`payroll.ts:30`, `today.ts:17`, `turf.ts`). The two conventions disagree, so month windows and day windows are now inconsistent.
   - Fix this first.
2. **Receipts are legally wrong outside India.** `src/app/api/receipts/[token]/image/route.tsx:170` prints `Rs. {amount}`. Lines 47–59 spell the amount in words with Lakh/Crore plus "Only". A London academy issues a "Rs. 50 … Fifty Only" receipt for £50.
3. **Online fee collection is India-only.**
   - The Razorpay order, payment-link and turf-booking paths hardcode `currency: "INR"`.
   - Stripe is platform-account only, card-only, and gated behind `PLATFORM_COLLECTS_FEES`. There is no Stripe Connect. Its currency comes from the env var `STRIPE_CURRENCY`, not from the org.
   - Minor units are always `×100`, which is wrong for JPY/KRW (0 decimals) and KWD/BHD/OMR (3 decimals).
4. **The data-deletion portal is fake.** `src/app/delete-account/page.tsx:16-24` runs `setTimeout` and then tells the user "in accordance with DPDP … purged within 7 business days". Nothing is recorded. This is a compliance liability under DPDP, GDPR and CCPA, and with Google Play's Data Safety policy. Its validation also rejects phone numbers shorter than 10 digits (line 18).
5. **Signup never asks for country.** `app/actions/onboarding.ts` sets `state = ""` and leaves country unset, so every new org is created as IN/INR/Asia/Kolkata/en-IN/+91, even if the city typed is "London". Fixing it later in Settings is risky: `FeeRecord` has no `currency` column, so a currency change silently re-labels all historical amounts.
6. **No i18n, no RTL, no consent.**
   - Every string is English and `<html lang="en">` is hardcoded.
   - 193 physical-direction Tailwind classes vs 2 logical ones.
   - PostHog defaults to the US host and has no cookie/consent banner.
   - The privacy policy is DPDP-only, with no GDPR/CCPA basis, transfer or sub-processor sections. It also says "Location: contact@triq.app".
   - Data sits in Mumbai only: Supabase `ap-south-1` and Vercel `bom1`.

---

## 1. Detailed findings (file:line)

Severity: **P0** = wrong data or legal exposure now. **P1** = blocks a non-India academy. **P2** = degrades the experience. **P3** = polish.

### 1.1 Timezone and "today" (P0/P1)

| # | Location | Problem |
|---|---|---|
| T1 | `src/lib/fees.ts:68,76,84,92` | `istDateString`, `istMonthString`, `istToday` and `istWeekday` default to `tz="UTC"`. Before `7a2ee26` they used `Asia/Kolkata`. The `@deprecated` tags point to `orgToday()`, but no caller migrated. |
| T2 | 35 no-tz call sites: `app/actions/attendance.ts:34,58` · `coach-session.ts:51,81,96` · `auto-sessions.ts:11,12` · `team.ts:51,248,279,296,310` · `payroll.ts:53,117,209,270,328,330` · `fees.ts:185` · `auto-fees.ts:21` · `export.ts:23` · `import.ts:139` · `app/org/page.tsx:42,234` · `app/coach/page.tsx:48,49,51` · `app/parent/page.tsx:29` · `components/shell/TodayScreen.tsx:86,113` · `components/org/BulkWhatsApp.tsx:79` · `components/coach/CoachMePanel.tsx:21` · `lib/today.ts:12,14` · `app/api/cron/monthly-fees/route.ts:25` | All compute "today" or "this month" in UTC. **IST academies:** attendance, staff check-in, session generation and payroll days are wrong from 00:00 to 05:29 IST. **US academies:** evening sessions after 8 pm ET land on tomorrow. |
| T3 | `app/api/cron/monthly-fees/route.ts:1-25` + `vercel.json` (`0 2 1 * *`, a single global run) | Fees for the "current month" are generated at 02:00 UTC on the 1st for every org. For America/Los_Angeles that is 19:00 on the last day of the previous month, but UTC is already in the new month, so the new month's fees are created a day early. The job needs to be per-org timezone-aware: run hourly and generate for orgs whose local date has become the 1st. |
| T4 | Hard IST offset: `lib/turf.ts:6,16,22,33,44,49,63-64` (`IST_OFFSET`, `todayIstStr`, `istHourOf`, `istDateOf`) · `app/book/actions.ts:100,260` · `app/actions/turf-bookings.ts:61` · `components/org/TurfBoard.tsx:141` · `lib/competition.ts:553-559` · `lib/wellness.ts:152-160` (`parseIstDateTime`) · `components/org/CompetitionManager.tsx:46-48` · `app/actions/payroll.ts:30` (`monthInstantRange`) · `lib/today.ts:17` · `components/shell/TodayScreen.tsx:130` | The whole turf/court booking engine, fixtures, wellness appointments and payroll windows assume UTC+5:30 with no DST. Wrong for every non-IST org, including half-hour and DST zones. |
| T5 | `Asia/Kolkata` literals in display code: `components/team/CheckInCard.tsx:15` · `team/StaffHome.tsx:17,63,66` · `coach/BatchBroadcast.tsx:61` · `verticals/ui.tsx:83,87` · `org/PayrollPanel.tsx:37,504` · `org/TeamPanel.tsx:49` · `shell/TodayScreen.tsx:59,73` · `app/coach/page.tsx:25,320` · `app/actions/coach-session.ts:175` · `app/actions/business-report.ts:20` | Display times are in IST regardless of the org. "Good morning" greetings and check-in times are wrong abroad. |
| T6 | `prisma/schema.prisma` Facility `openHour`/`closeHour` ("IST, 0-23") · StaffAttendance `date` ("IST calendar day") · Expense `date` | The schema comments encode IST. The column semantics should become "org-local calendar day". No migration is needed, only a reinterpretation, but existing IST rows stay valid only if the org stays IST. |
| T7 | `components/org/AcademySettings.tsx:208-217` | Timezone is a free-text `<Input>` ("Timezone (IANA)"). `app/actions/academy.ts:93-104` only checks length, so a typo like "Asia/Calcutta " is accepted. Multi-zone countries get a single default (US → New_York, AU → Sydney, CA → Toronto; `lib/i18n.ts:206-224`). |

### 1.2 Currency and money (P0/P1)

| # | Location | Problem |
|---|---|---|
| M1 | `₹` in 53 files. Hotspots: `components/org/FeePricingAnalyzer.tsx` (10) · `parent/FamilyDashboard.tsx:71,132,177,193-197` (7) · `parent/CheckoutModal.tsx:113` (6) · `org/RevenueForecast.tsx` (6) · `coach/CoachFeeKhata.tsx` (6) · `org/PayNowButton.tsx` (5) · `shell/TodayScreen.tsx` (4) · `org/TurfBoard.tsx` (4) · `org/RevenueProjection.tsx` · `org/ReferralProgram.tsx` · `org/PaymentPlans.tsx` · `org/FeePlans.tsx` · `org/BrandStudioPanel.tsx:42,292` · `app/login/page.tsx` | Parent-facing amounts show ₹ for AED, GBP and USD academies. Only 6 files use `useFormatMoney`/`formatMoney`/`formatCurrency`. |
| M2 | `src/app/api/receipts/[token]/image/route.tsx:5,47-59,82-85,170` | `Rs.` literal, Indian Lakh/Crore amount-in-words, `toLocaleString()` with no locale, English month names. Receipts are the most legally sensitive document the product issues. |
| M3 | `lib/turf.ts` `rupees()` (used across `components/org/TurfBoard.tsx:34,159,269-270,316,482,576,594-596,614,627`) | All turf money is printed as rupees. Schema comments say "whole rupees" (`TurfBooking.amount/advancePaid/onlineDue`, `Facility.hourlyRate/advanceAmount`). |
| M4 | `lib/store.ts:31,61-67` (`toPaise`, `formatPaise(…, symbol="₹")`) · `lib/brand-studio.ts:95,101,122` · `lib/careers.ts:256-257` (`payBand` default INR) · `lib/concessions.ts:89,146` · schema `StoreOrderDetail.*Paise`, `SponsorshipCampaign.budgetPaise`, `SponsorshipProposal.askPaise`, `ScholarshipProgram.monthlyBudgetPaise`, `FeeConcession.amountOff` ("whole ₹") | The new verticals store minor units plus `currency` (good), but name the columns `*Paise`, default `currency` to `"INR"` at the DB level, and format with ₹. `app/actions/store.ts` and `brand-studio.ts` never set `currency` from the org, so every order and campaign is INR. |
| M5 | `lib/pricing.ts:7,63-67,88-91,113-160` (`CURRENCY="₹"`, `formatINR`, `GROWTH_PLAN` 25/749 INR) · `/pricing` · `components/marketing/sections.tsx:4,200` (`BadgeIndianRupee`) · `product-mock.tsx:1,134` (`IndianRupee`) | The pricing page and marketing site are INR-only. There is no per-currency price book or geo/locale switch. |
| M6 | `lib/i18n.ts:84-90` `formatMoneyCompact` | INR → L/Cr is correct for India. Other currencies use Intl compact (good). Note: `en-IN` locale with USD will also print lakh grouping ("$1,00,000"). Locale and currency need to be chosen together. |
| M7 | `lib/currency.ts` (whole file) vs `lib/i18n.ts` | Two parallel helper sets (`formatCurrency`, `getOrgDateString` default `Asia/Kolkata`, `cleanInternationalPhone` default `"91"`). Pick one (`i18n.ts`) and delete the other. |
| M8 | Float money columns: `FeeRecord.amount` (schema:582) · `Product.price` (660) · `Referral.discount` (795) · `Coupon.discount` (848) · `FeePlan.amount` (883) · `Receipt.amount` (1055) | Float money. `docs/ARCHITECTURE.md:39` already states that new tables use Int minor units. This is the legacy debt, and **converting it needs migration approval**. |
| M9 | `FeeRecord`, `Receipt`, `FeePlan`, `Product`, `Facility`, `TurfBooking`, `Expense`, `StaffPayout`, `OrgMembership.payAmount` have **no `currency` column** | The currency is implied by `Organization.currency`. If an org changes currency, or a multi-country org (Branch model) bills in two currencies, history is re-labelled. Add `currency` columns: additive, with a backfill from the org. |
| M10 | Minor-unit conversion `×100`: `app/actions/online-payments.ts:128` · `payment-links.ts:48` · `app/book/actions.ts:201,212,255` · `lib/turf-engine.ts:112,118` · `lib/store.ts:63,111` | Wrong for 0-decimal currencies (JPY, KRW, VND, CLP…) and 3-decimal ones (KWD, BHD, OMR, JOD, TND). KWD, BHD and OMR are already in `COUNTRY_OPTIONS`, so this is a live bug for Gulf academies. |
| M11 | No FX or multi-currency reporting | `components/org/BusinessReport.tsx:23` defaults to INR. There is no consolidated view for multi-country orgs. Needed only for the "Academy/Enterprise" multi-branch tier, but it should be designed with M9. |

### 1.3 Payments (P1)

| # | Location | Problem |
|---|---|---|
| P1 | `app/actions/online-payments.ts:117-165` | The academy-owned Razorpay path hardcodes `currency = "INR"` (133). Razorpay supports international currencies, but the org's currency is ignored. |
| P2 | `app/actions/online-payments.ts:168-172` + `lib/gateways/stripe.ts:20-23,58-84` | Stripe checkout has five problems. **(a)** It runs only if `PLATFORM_COLLECTS_FEES`, so academy money would land in **Triq's** Stripe account. That is the same aggregator problem the code avoids for RBI, and it applies under EU PSD2, UK FCA and US money-transmitter rules. **(b)** `payment_method_types[0]=card` only: no SEPA, BACS, ACH, iDEAL, Apple Pay or Google Pay via automatic methods. **(c)** Currency comes from the env `STRIPE_CURRENCY`, defaulting to INR, not from `org.currency`. **(d)** No `Idempotency-Key` header. **(e)** No Stripe Connect, so there is **no way for a non-Indian academy to collect fees online**. |
| P3 | `app/api/webhooks/stripe/route.ts` | Correct signature verification, idempotent finalise, handles completed/async_succeeded/async_failed/expired. **Missing:** `charge.refunded`, `charge.dispute.created`/`closed`, `payment_intent.payment_failed`, and Connect `account.updated`. Verdict: about 40% complete for global use. Fine as a reconciliation stub, not as a product. |
| P4 | `app/actions/payment-links.ts:79,90,137` · `app/book/actions.ts:202` · `app/book/[slug]/BookClient.tsx:143` · `app/api/webhooks/razorpay/[orgId]/route.ts:72` · `lib/gateways/razorpay.ts:90` · `lib/razorpay.ts:5` · `lib/payments.ts:31` | Payment links and public turf booking are Razorpay plus INR only. Payment-link `contact` is `+91${phone}` only for 10-digit numbers (90). |
| P5 | `lib/fees.ts:47` (`cu=INR`), 48 files reference UPI · `Organization.upiId` · `FeeRecord.paymentMethod` values `PARENT_REPORTED_UPI`/`ADMIN_CONFIRMED_UPI` · `Receipt.paymentMode @default("UPI")` · `lib/receipt-service.ts:19` default `"UPI"` · `StaffPayout.paymentMode` CASH/UPI/BANK | The manual "pay via UPI" flow is the main fee-collection UX. It needs a per-country manual method instead: bank transfer with IBAN/sort code, PayNow (SG), Interac e-Transfer (CA), M-Pesa (KE), cash, and so on. |
| P6 | `app/api/webhooks/razorpay/billing/route.ts:113-114` · `Subscription.razorpaySubscriptionId` · `BillingInvoice.amount // In INR` | Triq's own SaaS billing is Razorpay subscriptions in INR only. A UK academy cannot pay Triq. |
| P7 | `lib/payments.ts:72-90` `getPaymentMethods()` | A static marketing list (e-NACH, Apple Pay…), unrelated to the real gateway capability. |

### 1.4 Tax and invoicing (P1)

- **Academy receipts:** no GST, VAT or sales-tax concept anywhere (`Receipt` model at schema ~1037). There is no seller legal name, tax ID (GSTIN, VAT no., ABN, TRN), tax rate or line, invoice vs receipt distinction, or sequential per-org numbering rules.
  - India: GST-registered academies above threshold must issue tax invoices.
  - UK/EU: VAT invoices need specific fields, and some sports instruction is exempt for eligible bodies.
  - UAE: 5% VAT, and invoices need the TRN.
  - US: sales tax on youth sports instruction varies by state and is mostly exempt.
- **Triq's own invoices:** `TRIQ-INV-${year}-${seq}` (billing webhook ~106). No GSTIN, no reverse-charge text for B2B exports, no VAT handling for EU/UK customers, and no `pdfUrl` is generated.
- **Payroll:** `StaffPayout` has no tax/withholding fields. There is a commented-out `tdsDeduction` (schema:390). PAYE, US 1099/W-2 and India TDS are out of scope for now, but say so in the UI ("Triq does not calculate tax").

### 1.5 Phone numbers and messaging (P1)

| # | Location | Problem |
|---|---|---|
| PH1 | `"91"` glued onto 10-digit numbers: `components/parent/CarpoolMatcher.tsx:44` · `coach/CoachFeeKhata.tsx:77` · `org/TurfBoard.tsx:38` · `org/CollectFees.tsx:28` · `org/LoginLinkButton.tsx:38` · `org/PayrollPanel.tsx:41` · `org/PayNowButton.tsx:166` · `org/WhatsAppReminder.tsx:61` · `org/StudentDetailDrawer.tsx:112` · `shell/TodayScreen.tsx:68` · `app/book/[slug]/BookClient.tsx:114` | WhatsApp deep links go to the wrong country for US/CA numbers, which are 10 digits (`1` + 10). `lib/i18n.ts waLink()` already does this per org and should be used instead. |
| PH2 | `lib/phone.ts:11,29-57` (`PhoneCountry = "IN"` only) · `lib/i18n.ts:111-117` (`normalizePhoneForOrg` treats any 10 digits as national) | Parsing only understands India. Use `libphonenumber-js` with the org's country as the default region. **Storage convention:** Indian users are stored as bare 10 digits and everyone else as international digits. A US 10-digit number entered without `+1` is stored as `"2125551234"`, which collides with the Indian key space. Moving to E.164 storage everywhere is a **data migration (approval needed)**. |
| PH3 | Hard `+91` in UI: `components/marketing/demo-form.tsx:118` · `components/directory/form-fields.tsx:53` · `app/register/page.tsx:174` (placeholder) · `app/academies/actions.ts:164` ("We'll WhatsApp you on +91 …") · `app/actions/sales-leads.ts:19-22,129` · `app/actions/register-academy.ts:64` · `app/join/actions.ts:77` · `components/org/WhatsAppRosterImport.tsx:49` (regex `[6-9]\d{9}`, India-only) · `components/org/InstagramGenerator.tsx:27` · `app/actions/auth.ts:17` ("valid 10-digit mobile number") | Hard India assumptions in forms, copy and import. |
| PH4 | OTP: `app/actions/auth.ts:24-101` | Routing order: WhatsApp auth template, then MSG91 (India, DLT), then Twilio (non-India). This is sound. Twilio sends English-only text from one `TWILIO_PHONE_NUMBER`. Many countries need a registered sender ID or a local number (US 10DLC/toll-free verification, UAE/SA sender registration). Twilio Verify would handle this and is cheaper to operate. |
| PH5 | WhatsApp templates `lib/whatsapp.ts:26-80` | English only, with emoji. Meta templates are approved **per language**, so `hi`, `ar` and `es` variants must be submitted. Pricing is per-country and the comment assumes India. |
| PH6 | Email | **No transactional email provider.** In UK, EU, US and AU, parents expect email for receipts, invoices and login. Add Resend or Postmark (EU region available) or SES. |

### 1.6 Dates, numbers and formats (P1/P2)

| # | Location | Problem |
|---|---|---|
| D1 | `lib/import-utils.ts:25-33` + `components/org/ExcelImport.tsx:47` + `app/actions/import.ts:64` | DOB import assumes DD/MM. A US roster "03/04/2014" becomes 3 April. "12/25/2014" has month 25 → `Date.UTC` overflows to 2016-01-12, which passes the 2–70 age check, so the **wrong DOB is saved silently**. Needs an org-locale-driven order, a `month ≤ 12` check, and ambiguity flagging. |
| D2 | 53 bare `toLocaleString()`/`toLocaleDateString()` (e.g. `components/parent/FamilyDashboard.tsx:71…`, `parent/MediaFeed.tsx:26`, `ui/animated-counter.tsx:28`, `ui/count-up.tsx:15`, receipt route:82) | Server renders en-US and the browser renders its own locale, so grouping and dates differ and hydration warnings appear. Inconsistent with the org locale. |
| D3 | 65 `"en-IN"` literals (`CoachFeeKhata.tsx` ×5, `StaffHome.tsx` ×4, `PaymentPlans.tsx` ×3, `student/[id]/report/page.tsx` ×3, `lib/progress-report.ts`, `lib/directory.ts`, `lib/payroll.ts`, `lib/pricing.ts`, `RazorpayConnect.tsx`, `StudentDetailDrawer.tsx`, `OpportunitiesCard.tsx`…) | Lakh grouping (1,00,000) and day-first dates are shown to everyone. |
| D4 | `components/parent/AttendanceCalendar.tsx:21,39` | English month names hardcoded. Week starts on Sunday (`getDay()`). |
| D5 | Week start: `components/parent/WeeklyTimetable.tsx:20`, `coach/CoachMePanel.tsx:11`, `app/actions/facility-allocation.ts:157` (Monday) vs `AttendanceCalendar` (Sunday) vs `ParentClient.tsx:144-150` | Inconsistent inside the app. Should follow the org (`Intl.Locale.prototype.getWeekInfo` / `weekInfo` where available, plus an org override). GCC weekends are Fri–Sat or Sat–Sun. |
| D6 | `lib/fees.ts:94-140` free-text schedule parser ("Mon/Wed/Fri 4:00 PM") | English day tokens and 12h clock only. 24h ("16:00") and localised day names won't parse. |
| D7 | Fee model is monthly-only (`FeeRecord @@unique([studentId, month])`, `month "YYYY-MM"`) | US, UK and AU clubs bill per season, term or session pack. Needs a `billingPeriod` abstraction (additive). |
| D8 | School-year and age-group cut-offs | `lib/competition.ts:414-432` `ageOn()` takes an `ageCutoffDate` rule (good). There is no org-level "season start" or "age-group cut-off" setting (e.g. US Soccer uses birth year, UK football uses 1 Sept, Indian cricket boards use 1 Sept). Education vertical: no academic-year concept. |

### 1.7 Locale content: cities, sports, names, addresses, units (P2)

- **Cities:** `src/lib/cities.ts:15-~95`
  - About 45 Indian cities against about 37 global ones.
  - Suggestions only; free text is allowed (fine).
  - **Real problem:** onboarding (`app/actions/onboarding.ts:~30-80`) never derives country from the chosen city or the browser timezone. `CITY_STATE` (onboarding.ts:15-21) has only 5 NCR cities, and `state = ""` otherwise. `lib/directory.ts:20-22` lists only Gurgaon and Noida.
  - Fix: pick the country first, then filter cities with `matchCities(q, country)`.
- **Sports:** five duplicated lists:
  - `app/actions/onboarding.ts:11`
  - `app/register/page.tsx:24`
  - `app/onboarding/page.tsx:13`
  - `components/marketing/sections.tsx:28`
  - `components/marketing/demo-form.tsx:7`

  Plus `lib/sport-metrics.ts` and `lib/directory.ts:36`. Cricket and Football come first, which is fine for India. Missing global staples: gymnastics, hockey, volleyball, rugby, baseball/softball, golf, table tennis, squash, padel, pickleball, netball, ice skating, ice hockey, American football, lacrosse, dance, climbing. "Football" needs a "Soccer" label in en-US. Use one source of truth with stable keys and localised labels.
- **Names:** `User.name`, `Student.name` and `Lead.parentName` are single strings. That is fine as a display name, and better than forcing first/last. Add optional `givenName`/`familyName`/`preferredName` (additive) for sorting, school/federation exports and formal letters. Do not split existing data automatically.
- **Address and postal codes:**
  - `Organization.city` and `state` are required and `address` is a single line.
  - `AcademySettings.tsx:269-270` labels the field "PIN Code" with `maxLength={6}`, placeholder `560001`. This blocks UK ("SW1A 1AA", 8 characters), Canada ("K1A 0B6") and Netherlands ("1234 AB") postcodes.
  - Fix: rename to "Postal code", allow up to 10–12 characters, validate per country or not at all.
  - `academy/[slug]/page.tsx:58` renders "city, state - pincode", which is an India-specific order.
- **Units:** no height, weight or distance fields exist yet (`AthleteGoal.metric` is free text, `baseline`/`target` are Float). When fitness tests arrive (40 m sprint, beep test, height/weight), store SI units and display per org (`measurementSystem` metric|imperial; the US uses imperial).
- **Hinglish in the English UI:** 38 hits (`CoachFeeKhata`, `FeeKhataSheet`, "Kabir papa", etc.). Charming for India, confusing abroad. Move them into the `hi`/`en-IN` message catalog.

### 1.8 i18n framework and RTL (P1)

- **No message framework.** `lib/i18n.ts` handles formatting only. `lib/toast-messages.ts` has 15 English constants with emoji.
- **Server-action error strings** (≈800 `error:` / `toast.*` literals) are English sentences returned to the client. They need to become codes or be translated server-side.
- **`<html lang="en">` is hardcoded** (`src/app/layout.tsx:56`) and OpenGraph `locale: "en"` (layout ~33).
- **RTL:**
  - `COUNTRY_OPTIONS` offers `ar-SA`, `ar-QA`, `ar-KW`, `ar-BH` and `ar-OM` locales (`lib/i18n.ts:214-218`). Choosing them makes Intl print Arabic-Indic digits inside an LTR English UI, which is worse than either option. Default the Gulf to `en-AE`-style locales until Arabic UI exists.
  - 193 physical utilities (`ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`) vs 2 logical (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`).
  - No `dir` attribute.
  - Icons such as ArrowLeft and chevrons need mirroring.
  - Tailwind 3.4 supports `rtl:` variants and logical utilities natively.
- **PDF and OG images** use the default font (no ₹ glyph, no Devanagari or Arabic). The receipt route comment at line 5 confirms this. Hindi and Arabic receipts need Noto Sans Devanagari and Noto Sans Arabic loaded in `ImageResponse`.

### 1.9 Privacy and compliance (P0/P1)

| # | Location | Problem |
|---|---|---|
| C1 | `src/app/delete-account/page.tsx:16-24,56` | **Fake deletion:** `setTimeout` with no server call, while promising a DPDP purge in 7 business days. P0. |
| C2 | `src/app/privacy/page.tsx` (82 lines) | DPDP-only. Missing: controller vs processor roles (Triq is the academy's processor for roster data), lawful bases (GDPR Art. 6), special-category health data (`Student.medicalInfo`, `bloodGroup`, MedicalForm, WellnessAppointment notes = GDPR Art. 9 "explicit consent"), the sub-processor list (Supabase, Vercel, PostHog, Sentry, Twilio, MSG91, Meta WhatsApp, Razorpay, Stripe, Google OAuth/Places), international transfer mechanism (data stored in India), retention periods, CCPA/CPRA notice, and children's sections per COPPA and GDPR Art. 8. "Location: contact@triq.app" is a copy bug. The UPI-only payment statement is now false (Razorpay and Stripe exist). |
| C3 | `src/app/terms/page.tsx`, `refund-policy/page.tsx` | No governing law, jurisdiction or entity named. No DPA for academies (B2B). |
| C4 | `lib/analytics.ts:22` (PostHog host defaults to `us.i.posthog.com`), no consent UI anywhere | ePrivacy, UK PECR and GDPR need opt-in before non-essential analytics storage. India's DPDP (consent and notice) and the DPDP Rules also apply. Masking and no session recording (analytics.ts:6) help, but are not a substitute. |
| C5 | Children's data | Parents create child records (good: verifiable parent channel). No age gate exists for athlete or student self-login. The Athlete and Opportunities verticals give minors profiles. Only `OpportunityApplication.guardianConsent` (schema ~1305) records consent, and there is no general parental-consent record with timestamp, version and scope. DPDP §9 requires verifiable parental consent for under-18s and bans tracking and behavioural monitoring of children (relevant to PostHog on parent and athlete pages). COPPA: under 13. GDPR Art. 8: 13–16 depending on member state. |
| C6 | No data export ("download my data") | Required by GDPR Art. 15/20 and CCPA. `app/actions/export.ts` is an admin roster CSV, not a subject access export. |
| C7 | Cookie inventory | Session cookie (HMAC), PostHog, Sentry. A banner is needed only for PostHog and any marketing pixels. Essential cookies can be listed in a cookie notice. |

### 1.10 Infrastructure and data residency (P1)

- **Supabase primary:** `ap-south-1` Mumbai (`docs/ARCHITECTURE.md:5`, production-audit:252).
- **Vercel functions:** `bom1` only (`vercel.json`).
- **Others:**
  - Vercel Blob for photos has an unset region.
  - Sentry and PostHog run US by default.
  - Twilio is US.
  - MSG91 is India.
- **Implications:**
  - EU and UK customers: lawful transfer to India needs SCCs or the UK IDTA plus a transfer risk assessment. Many EU schools and clubs will require EU hosting in procurement.
  - GCC: Saudi PDPL has cross-border transfer restrictions, and UAE PDPL requires adequate-protection jurisdictions. Government-adjacent sports bodies may require in-country hosting.
  - US: no residency law, but latency from Mumbai to the US is about 250 ms per DB round trip. Server actions making 5–10 sequential queries will feel slow. Functions are co-located with the DB, which is correct, but the browser→bom1 hop is far.
- **No `Organization.dataRegion`** concept, and a single global cron.

---

## 2. Staged plan

**Effort:** S ≤ 1 day · M = 2–5 days · L = 1–3 weeks · XL = more than 3 weeks.

**Type:** **A** = additive (code only, or new nullable columns/tables with defaults; safe under the current additive-SQL convention in `prisma/sql/`). **MIG** = changes existing columns or data; needs founder migration approval (`docs/migrations/pending`).

### Stage 1: Quick wins this week (fix wrong behaviour, stop the bleeding)

| # | Item | Effort | Type |
|---|---|---|---|
| 1.1 | **Fix P0-1:** add `orgDayDate(org)`, `orgMonth(org)` and `orgWeekday(org)` to `lib/i18n.ts`. Thread `org.timezone` (already selected on the session org in most actions) through the 35 `ist*()` calls. As a one-line stop-gap today, set the `ist*` default back to `"Asia/Kolkata"` so India is correct while call sites migrate. Add a vitest case at 23:45 and 00:15 UTC, plus a US zone. | S (stop-gap) + M (thread tz) | A |
| 1.2 | Receipts: replace `Rs.` with `formatMoney(amount, org)`. Use the Indian amount-in-words only when `currency==="INR"`; otherwise Intl number words or omit. Load Noto fonts. | S | A |
| 1.3 | **Make `/delete-account` real:** a server action that writes a `DataRequest` row (new table: type DELETE/EXPORT, phone/email, status, timestamps) and notifies ops, with honest copy ("we'll confirm by WhatsApp/email within N days"). Accept international numbers. | S | A (new table) |
| 1.4 | Replace the 16 `"91"`-prefix sites with `waLink()`/`normalizePhoneForOrg()` from `useOrgLocale()`. Remove `+91` adornments in forms or make them org/country-driven. | S | A |
| 1.5 | Onboarding: add a country select (default from `Intl.DateTimeFormat().resolvedOptions().timeZone` and `navigator.language`). Write country, currency, timezone, locale and phoneCountry at org creation. Filter city suggestions by country. Drop the hard "PIN Code" (`maxLength 6`) and rename it "Postal code". | M | A |
| 1.6 | Settings: replace the free-text timezone with a select (`Intl.supportedValuesOf('timeZone')` filtered by country). Validate currency against an ISO 4217 list. **Lock currency changes once any FeeRecord exists** (until M9 lands). Change Gulf defaults from `ar-*` to `en-*` locales until Arabic UI exists. | S | A |
| 1.7 | Payments: use `org.currency` in Razorpay orders and links, and Stripe in place of `STRIPE_CURRENCY`. Add `toMinorUnits(amount, currency)` / `fromMinorUnits` using `Intl.NumberFormat(…).resolvedOptions().maximumFractionDigits` (0/2/3). Replace the 8 `×100` sites. Add an `Idempotency-Key` to Stripe POSTs. | S | A |
| 1.8 | Bulk ₹ sweep: codemod the 142 `₹` and 65 `"en-IN"` sites to `useFormatMoney()`/`useFormatDate()` (client) or `formatMoney(x, org)` (server). `ts-morph` is already a devDependency. Then ban `₹`, `"en-IN"`, `Asia/Kolkata` and `+05:30` outside `lib/i18n.ts` with an ESLint `no-restricted-syntax` rule. | M | A |
| 1.9 | Import: make DOB parsing locale-aware (MDY for US/PH/CA-en orgs, DMY otherwise), reject month > 12, and flag ambiguous rows (both parts ≤ 12) for confirmation. Make the template header "Date of birth (YYYY-MM-DD recommended)". | S | A |
| 1.10 | Privacy page: fix the "Location:" bug, add a sub-processor list and storage location, and remove the "UPI only" claim. Add a minimal cookie notice. Set `NEXT_PUBLIC_POSTHOG_HOST` to EU for EU orgs later. For now, **do not init PostHog for parent/athlete roles** (children's data, DPDP no-tracking). | S | A |
| 1.11 | Unify sports into `lib/sports.ts` (key, label, emoji, aliases, metrics) and add ~12 global sports, plus a "Soccer" label for en-US. | S | A |

### Stage 2: Proper i18n framework

**Recommendation: `next-intl` (v4)** for Next.js 15 App Router.

**Why next-intl:**
- First-class RSC support (`getTranslations` in Server Components and **server actions**, `useTranslations` in client components).
- ICU MessageFormat (plurals, gender, select).
- Typed message keys via TS module augmentation.
- Integrates with the existing `Intl` formatting (`useFormatter` can replace parts of `lib/i18n.ts`).
- Small client bundle (only the namespaces a client component uses are serialised).
- Works without locale URL prefixes, which matters because app routes are `/org`, `/coach` and `/parent`, behind auth.

Alternatives considered:
- `i18next`/`react-i18next`: weaker RSC story.
- Lingui: excellent extraction, but macro and SWC plugin friction with Next 15.
- Paraglide: smallest bundles but newer; a reasonable second choice.

**Locale resolution (two layers):**
1. **UI language**, per user: `User.uiLanguage` (new nullable column, additive), falling back to the org default, then to `Accept-Language`. Stored in a cookie and read in `i18n/request.ts`. No URL prefix for app routes.
2. **Formatting locale**, per org (currency, timezone, number style): the existing `Organization.locale`. A Hindi-speaking parent at a Dubai academy sees a Hindi UI with AED amounts. Keep these two layers separate.
3. **Marketing pages** (`/`, `/pricing`, `/academies`, `/academy/[slug]`): use `[locale]` prefix routing (`/hi`, `/ar`, `/es`) plus `hreflang` alternates in `sitemap.ts` for SEO.

**Message extraction strategy (≈2.5–3k strings, 267 .tsx files):**

1. **Codemod first pass** with `ts-morph` (already installed):
   - Walk JSX text nodes and string-literal props (`placeholder`, `title`, `aria-label`, `alt`, `label`).
   - Generate keys as `<namespace>.<slug>`, where the namespace is the route segment or component (`org.fees.markPaid`).
   - Replace with `t('…')` and write `messages/en.json`.
   - Strings with `${…}` become ICU placeholders.
   - Run it per directory (`components/parent` first, since parents are the largest non-English audience), with human review per PR.
2. **Server actions:** return `{ error: { code: 'FEE_ALREADY_PAID', params } }` in place of English sentences, and translate on the client. This also stops leaking server wording. Start with `action-result.ts` and the top ~100 messages.
3. **Guardrails:** ESLint `react/jsx-no-literals` (warn, then error per migrated directory), a CI check that every key in `en.json` exists in all shipped locales (missing keys fall back to en), and a pseudo-locale (`en-XA`, accented and +30% length) to find unextracted strings and layout overflow.
4. **Translation workflow:** JSON in repo → Tolgee, Crowdin or Lokalise (all have next-intl JSON support), with machine translation pre-fill and native review for parent-facing flows (fees, login, receipts, WhatsApp copy).
5. **Out-of-band content:** Meta WhatsApp templates per language (`hi`, `ar`, `es`) need separate submission and approval. OTP SMS text needs a localised MSG91 DLT template for Hindi. Receipts, PDFs and OG images need fonts.

**First languages (in order):**
1. **English variants (en-IN, en-GB, en-US, en-AU):** done mostly by formatting, plus a few spelling and term overrides ("Soccer", "Enrol/Enroll", "Fees/Tuition").
2. **Hindi (hi):** the current market. Parents in NCR and tier-2 cities, and coaches and ground staff are often more comfortable in Hindi. It also replaces the Hinglish-in-English strings. Devanagari is LTR, so no RTL work is needed. It also validates the pipeline cheaply.
3. **Arabic (ar):** the GCC (UAE, Saudi, Qatar, Kuwait, Bahrain, Oman) is already six of the 17 entries in `COUNTRY_OPTIONS`. The region has large private youth-sports academy markets (football, swimming, cricket among South Asian expats) and heavy state investment in sport (e.g. Saudi Vision 2030). Forces RTL work, which is best done once while the UI is still young. In the UAE, English UI is often acceptable, so ship Arabic for parent-facing screens first.
4. **Spanish (es):** one language covers Spain's football-academy culture, Latin America, and US Hispanic families in youth soccer and baseball, the largest non-English parent group in the US.
5. **Next wave (demand-driven):** Portuguese (pt-BR, football), French (fr: France plus francophone Africa), Bahasa (ms/id), and Indian regional languages (Marathi, Tamil, Telugu, Bengali, Kannada) once Hindi proves adoption.

**RTL work (needed for Arabic):**
- Set `<html lang dir>` from the UI language.
- Codemod 193 physical utilities to logical ones (`ml-`→`ms-`, `pl-`→`ps-`, `left-`→`start-`, `text-left`→`text-start`).
- Use `rtl:rotate-180` for directional icons.
- Check framer-motion x-translations and Vaul drawer direction.
- Charts (recharts) keep LTR axes.

| Item | Effort | Type |
|---|---|---|
| next-intl setup, providers, `User.uiLanguage`, language switcher, `lang`/`dir` | M | A (nullable column) |
| Codemod plus manual extraction of all ~2.5–3k strings, done incrementally by directory | L–XL (spread over sprints) | A |
| Server-action error codes | M | A |
| Hindi translation and review | M | A |
| RTL pass and Arabic | L | A |
| Spanish | M | A |
| Per-language WhatsApp templates and DLT SMS template | S (eng.) + Meta approval lead time | A |

### Stage 3: Payments per region

**Principle (already in the code for India and correct globally): the academy is the merchant of record and money never sits in Triq's account.**

| Region | Academy fee collection | Local methods | Triq SaaS billing |
|---|---|---|---|
| **India** | Keep the per-academy Razorpay keys (exists). Add Razorpay **UPI Autopay / e-mandate** for recurring monthly fees, and fix the INR handling above. Consider Razorpay Route only if a marketplace model is ever wanted (needs a PA licence decision). | UPI, cards, netbanking, UPI Autopay; manual UPI QR stays as the free tier | Razorpay Subscriptions, GST tax invoice from Triq's GSTIN, INR price book |
| **UK, EU, US, CA, AU, NZ, SG, UAE, HK, JP, MY…** | **Stripe Connect** (Standard or Express accounts, **direct charges** so the academy is merchant of record; `application_fee_amount` optional). Replace the platform-account `PLATFORM_COLLECTS_FEES` path. Use Checkout with **automatic payment methods** (remove `payment_method_types=card`). | Cards, Apple Pay, Google Pay; SEPA Direct Debit, iDEAL, Bancontact (EU); BACS Direct Debit (UK); ACH (US); PAD (CA); BECS (AU); PayNow (SG); Link | **Stripe Billing** + **Stripe Tax** (EU/UK VAT incl. reverse charge, US sales tax, AU GST), per-currency price book |
| **Saudi Arabia, wider GCC** | Stripe coverage of KSA should be verified at build time. Plan a pluggable local PSP (e.g. Tap Payments, HyperPay, or Checkout.com, which support **mada** and Apple Pay) behind the gateway interface. | mada, Apple Pay, STC Pay | Stripe or local PSP |
| **Nigeria, Ghana, Kenya, South Africa** | **Paystack** (NG, GH, KE, ZA) or Flutterwave, with per-academy subaccounts | Cards, bank transfer, USSD; **M-Pesa** (KE) | Paystack |
| **Everywhere (free tier)** | Manual: generalise the "UPI" flow into a **per-country manual method** (UPI ID, IBAN + reference, UK sort code/account, PayNow UEN, Interac e-mail, M-Pesa till, cash), with parent "I've paid" plus admin confirm (exists) | n/a | n/a |

**Engineering work:**
- `lib/gateways/` → a `PaymentGateway` interface: `createCheckout`, `createLink`, `verifyWebhook`, `parseEvent`, `refund`. Implementations: Razorpay (exists), StripeConnect, Paystack, LocalPSP. Choose via `org.paymentProvider` (new column) and the connected-account record.
- New table `OrgPaymentAccount` (provider, accountId, status, capabilities, connectedAt) instead of more provider columns on Organization. Keep the existing `razorpayKey*` columns; no migration.
- Stripe webhook: add `account.updated`, `charge.refunded`, `charge.dispute.*`, `payment_intent.payment_failed`, and the Connect-event `account` header routing.
- Refund and dispute states on `Payment` (status values only; the column is a String, so additive).
- Multi-currency: `currency` on FeeRecord, Receipt, FeePlan, Facility, TurfBooking, Expense and StaffPayout (additive, backfilled from the org). Do **not** convert currency at charge time; academies price locally. FX only for consolidated multi-branch reports, using daily rates (ECB or openexchangerates) stored in a `FxRate` table and labelled "approximate".
- **Pricing page:** per-currency price book in `lib/pricing.ts` (INR, USD, GBP, EUR, AED, AUD, SGD), set as local-market prices, not FX-converted (₹25/student is about $0.30, which is not a viable US price). Choose the currency by geo (`x-vercel-ip-country`) with a manual switcher. **Founder approval required** (`pricing.ts:4`: "do not overwrite current pricing").
- **Tax on academy receipts:** optional `Organization.taxRegistration` (type GSTIN/VAT/TRN/ABN, number, legal name, registered address), and `taxRate`/`taxInclusive` on FeePlan or org. The receipt shows tax lines when set, plus per-org sequential numbering. Templates differ: India GST invoice vs UK/EU VAT invoice vs plain receipt. Get advice from a CA (India) and an accountant (UK/EU) on SAC codes and exemptions before shipping.

| Item | Effort | Type |
|---|---|---|
| Currency-correct minor units and per-org currency (Stage 1.7) | S | A |
| Gateway interface refactor | M | A |
| Stripe Connect onboarding (Express), checkout, links, webhooks, refunds | L | A (new table) |
| Per-country manual payment methods | M | A |
| `currency` columns on legacy money tables + backfill | M | **MIG** (backfill on existing rows) |
| Float → Int minor units (FeeRecord.amount, Receipt.amount, FeePlan.amount, Product.price, Coupon/Referral.discount) | L | **MIG** |
| Rename `*Paise` → `*Minor` | S | **MIG** (optional; or just document that "Paise" means minor units) |
| Triq SaaS billing on Stripe Billing + Tax, multi-currency price book | L | A, plus **founder pricing approval** |
| Paystack / local PSP adapters | M each | A |
| Receipt tax fields and invoice templates | M | A |

### Stage 4: Compliance per region

Common foundation (build once, serves every region):
- **Consent ledger** (new table `ConsentRecord`: subject, guardianUserId, scope [TERMS, PRIVACY, HEALTH_DATA, MARKETING, ANALYTICS, PHOTO_MEDIA, OPPORTUNITY_SHARE], policyVersion, method, ip, timestamp, withdrawnAt).
- **Data-subject requests** (the `DataRequest` table from 1.3): export as JSON/CSV of user plus children, and deletion with a real purge or anonymise job and audit trail.
- **Retention policy:** auto-purge leads, OTPs, RateLimit rows and inactive-student PII after N months.
- **DPA template** for academies (Triq as processor), a sub-processor list page, and a breach-notification runbook.
- **Cookie/consent banner** (essential vs analytics). PostHog is initialised only after opt-in for EU, UK and California visitors, and never on child-facing or athlete pages.
- **Health data** (`medicalInfo`, `bloodGroup`, MedicalForm, Wellness notes): explicit-consent checkbox, access logging, and encryption at rest with `secret-box.ts` (already used for Razorpay secrets).

| Region | Specific requirements | Effort |
|---|---|---|
| **India: DPDP Act 2023 + DPDP Rules (notified Nov 2025, phased commencement; confirm current dates with counsel)** | Itemised notice in English **and the 22 scheduled languages on request**. **Verifiable parental consent** for under-18s (the parent account creates the child, so record it in ConsentRecord). **No tracking, behavioural monitoring or targeted ads to children:** turn off PostHog for minors' surfaces. Grievance officer, response SLA, breach intimation to the Data Protection Board and to users. Deletion when the purpose ends. Consent-manager compatibility later. | M |
| **EU/EEA (GDPR) + UK (UK GDPR, DPA 2018, PECR, ICO Children's Code)** | Art. 6 bases per purpose. **Art. 9 explicit consent for health data.** Art. 8 child age 13–16 by state (UK 13). Art. 15/17/20 rights (export/delete). **DPA with academies.** **SCCs / UK IDTA + transfer risk assessment** while data sits in India (Stage 5 removes this). EU representative (Art. 27) and UK representative if no establishment there. DPIA for the children's athlete-profile and opportunities verticals. ICO Children's Code: high-privacy defaults for under-18 profiles (public athlete profile off by default). Cookie consent before PostHog. | L |
| **US (COPPA, as amended 2025; state privacy laws such as CCPA/CPRA; state youth-sport safeguarding)** | COPPA applies if under-13s use any part of the service directly (athlete login or profile). Parental verifiable consent, separate consent before disclosing to third parties (opportunities/scholarships → schools/scouts), data-retention policy, written security programme. CCPA/CPRA notice and "Do not sell/share" (true today, but declare it). Coach background-check fields (SafeSport-style) fit the existing credentials vertical. | M |
| **UAE (PDPL), Saudi (PDPL + SDAIA transfer rules), Qatar** | Consent and notice in Arabic. Cross-border transfer conditions (KSA is the strictest: adequacy or safeguards plus a risk assessment, and some government or sports-federation customers will require in-Kingdom hosting). | M (legal) + Stage 5 |
| **Australia (Privacy Act/APPs), Singapore (PDPA), Canada (PIPEDA/Quebec Law 25), Nigeria (NDPA), Kenya (DPA), South Africa (POPIA)** | Largely covered by the GDPR-grade foundation. Add a country annex to the privacy policy. Quebec Law 25 requires French-language privacy information and a privacy officer. POPIA has information-officer registration. | S each |
| **Safeguarding (not privacy, but expected globally)** | UK DBS, US SafeSport, AU Working With Children Check: credential types in `lib/credentials.ts` with expiry reminders. | M |

Legal docs (privacy, terms, DPA, cookie notice) need a lawyer, not code. Engineering: versioned policy pages (`/legal/privacy?v=`), per-region annexes, and re-consent on version bump.

### Stage 5: Infrastructure and data residency

**Today:** a single cell (Vercel `bom1` + Supabase `ap-south-1`).

**Target: regional "cells".** Each region gets its own Supabase project, Vercel function region and Blob store. One global control plane holds only the org→region routing table and auth bootstrap.

1. **Now (S, A):**
   - Add `Organization.dataRegion` (default `"in"`).
   - Set PostHog to the EU host for EU/UK orgs, or self-host.
   - Confirm and record Sentry's region, and turn on Sentry EU for EU cells later.
   - Document every sub-processor's region.
2. **First new cell when the first EU/UK academy signs (L):**
   - Supabase in `eu-west-2` (London) or `eu-central-1` (Frankfurt), Vercel function region `lhr1`/`fra1`, Blob store in the EU.
   - Prisma client chosen per request from the org's region. Because nearly every query is org-scoped (`orgId` everywhere), this is feasible: a `getDb(org)` factory replaces the global `db`. Cross-org surfaces (public directory, careers, opportunities, sponsorship marketplace) need either a global read-only index with no personal data or per-region federation. **This is the hard part. Design it before building more cross-org verticals.**
   - Login: phone/email → region lookup table (hash of identifier → region) in the control plane.
3. **US cell** (`us-east-1` + `iad1`): mainly for latency and US procurement, not legal requirement.
4. **GCC cell:** check Supabase region availability for Middle East (Bahrain/UAE). Otherwise, if a KSA/UAE government customer requires in-country hosting, use self-hosted Postgres on a local cloud region. Only for enterprise deals.
5. **Crons:** make the monthly fee generation, reminders and auto-sessions **per-org-timezone hourly sweeps**, run per cell.
6. **Backups and DR** per cell. Migrations run in every cell, so CI must apply `prisma/sql/*` to all cells.

| Item | Effort | Type |
|---|---|---|
| `dataRegion` column, PostHog/Sentry region config | S | A |
| Per-org-timezone cron sweep | M | A |
| `getDb(org)` abstraction + region routing table | L | A |
| EU cell stand-up + data-migration tooling (moving an org between cells) | L–XL | Infra + **MIG** when moving any existing org |
| Global vs regional split for cross-org verticals (directory, careers, opportunities, sponsorship) | L | Design decision |

---

## 3. Approval checklist

Items that need **founder or migration approval**:
1. Float → Int minor-unit conversion of legacy money columns (FeeRecord, Receipt, FeePlan, Product, Coupon, Referral).
2. Backfilling `currency` onto legacy money tables (additive columns, but it writes every row).
3. Phone storage normalisation to E.164 for all users (lookup keys change).
4. Optional `*Paise` → `*Minor` renames.
5. Multi-currency **pricing** for Triq plans (`lib/pricing.ts` is under founder lock).
6. Retiring `PLATFORM_COLLECTS_FEES` Stripe-to-platform in favour of Stripe Connect (product and legal decision).
7. Moving any existing org between data regions.
8. Legal entity, governing law and DPA content (needs counsel).

**Everything else** is additive: code changes, new nullable columns, and new tables (`DataRequest`, `ConsentRecord`, `OrgPaymentAccount`, `FxRate`, `User.uiLanguage`, `Organization.dataRegion`/`weekStart`/`measurementSystem`/`taxRegistration`/`paymentProvider`, optional `givenName`/`familyName`).

## 4. Suggested order of work

1. **Today:** restore the IST default in `fees.ts` (one line), and make `/delete-account` real.
2. **This week:** Stage 1 items 1.1–1.11.
3. **Next 2–4 weeks:** next-intl foundation + Hindi; gateway interface + Stripe Connect; consent ledger, DSR export/delete and cookie banner; per-tz cron.
4. **Next quarter:** Arabic + RTL, Spanish, Stripe Billing + per-currency pricing, tax-aware receipts, money-column migrations (once approved), EU cell (triggered by the first EU/UK customer).

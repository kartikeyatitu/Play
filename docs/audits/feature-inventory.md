# Triq — Complete Feature Inventory

**Snapshot:** 2026-10-20 · branch `codex/triq-reliability-and-vertical-roadmap`
**Scope:** every route, component, server action, API handler, Prisma model, SQL migration, and key lib module present in the repository right now. No speculation — only what IS in the code.

## Summary

| Area | Count |
|---|---:|
| App routes (page.tsx + route.ts/tsx) | **44** |
| &nbsp;&nbsp;&nbsp;· Pages | 29 |
| &nbsp;&nbsp;&nbsp;· API handlers | 10 |
| &nbsp;&nbsp;&nbsp;· Static-marketing / legal | 5 |
| React components | **197** across 12 folders |
| &nbsp;&nbsp;&nbsp;· org (admin) | 72 |
| &nbsp;&nbsp;&nbsp;· ui | 44 |
| &nbsp;&nbsp;&nbsp;· coach | 24 (+ 1 in squad/) |
| &nbsp;&nbsp;&nbsp;· parent | 23 |
| &nbsp;&nbsp;&nbsp;· marketing | 10 |
| &nbsp;&nbsp;&nbsp;· shell | 8 |
| &nbsp;&nbsp;&nbsp;· directory | 7 |
| &nbsp;&nbsp;&nbsp;· team | 3 |
| &nbsp;&nbsp;&nbsp;· analytics | 2 |
| &nbsp;&nbsp;&nbsp;· sport | 2 |
| &nbsp;&nbsp;&nbsp;· admin | 1 |
| &nbsp;&nbsp;&nbsp;· chat | 1 |
| Server actions (exported functions) | **147** across 60 files |
| Prisma models | **47** |
| SQL migrations (`prisma/sql/`) | **4** |
| Key lib modules | **46** |

### By primary role

| Role | Routes | Components (approx) | Server actions (approx) |
|---|---:|---:|---:|
| **Admin / Owner** (`/org`) | 1 | 72 | ~55 |
| **Coach** (`/coach`) | 1 | 25 | ~15 |
| **Parent** (`/parent`, `/student`) | 2 | 23 | ~12 |
| **Public visitor** (marketing, directory, booking, trial, join) | 15 | 20 | ~15 |
| **Staff** (`/staff`) | 1 | 3 | ~5 |
| **Platform / Ops** (`/ops/leads`) | 1 | — | ~5 |
| **API / cron / webhook** | 10 | — | — |

---

## 1. App routes

### Admin / Owner
| Path | Role | File | Status | Description |
|---|---|---|---|---|
| `/org` | ADMIN | `src/app/org/page.tsx` | ✅ | Main admin dashboard — tabs for Today, People, Fees, Communication, Settings, etc. |
| `/org/layout.tsx` | ADMIN | (added this sprint) | ✅ | Loads org locale, wraps children with OrgLocaleProvider |

### Coach
| Path | Role | File | Status | Description |
|---|---|---|---|---|
| `/coach` | COACH | `src/app/coach/page.tsx` | ✅ | Coach dashboard: today, squad, plan, inbox, me |
| `/coach/layout.tsx` | COACH | (added this sprint) | ✅ | Org-locale provider |

### Parent
| Path | Role | File | Status | Description |
|---|---|---|---|---|
| `/parent` | PARENT | `src/app/parent/page.tsx` | ✅ | Parent app: attendance, fees, media, timetable, family dashboard |
| `/parent/layout.tsx` | PARENT | (added this sprint) | ✅ | Org-locale provider |
| `/student/[id]` | PARENT/ADMIN/COACH | `src/app/student/[id]/page.tsx` | ✅ | Deep student profile (progress, media, incidents, skillReports, feeRecords) |

### Staff / Ops
| Path | Role | File | Status | Description |
|---|---|---|---|---|
| `/staff` | STAFF | `src/app/staff/page.tsx` | ✅ | Front-desk / receptionist / accountant view |
| `/ops/leads` | internal | `src/app/ops/leads/page.tsx` | ✅ | Triq-internal sales lead viewer |

### Public pages (no auth)
| Path | File | Status | Description |
|---|---|---|---|
| `/` | `src/app/page.tsx` | ✅ | Marketing landing page |
| `/home` | `src/app/home/page.tsx` | ✅ | Alt landing |
| `/pricing` | `src/app/pricing/page.tsx` | ✅ | Pricing page |
| `/contact` | `src/app/contact/page.tsx` | ✅ | Contact form |
| `/privacy` | `src/app/privacy/page.tsx` | ✅ | Privacy policy |
| `/terms` | `src/app/terms/page.tsx` | ✅ | Terms |
| `/refund-policy` | `src/app/refund-policy/page.tsx` | ✅ | Refund policy |
| `/delete-account` | `src/app/delete-account/page.tsx` | ✅ | Self-serve account deletion |
| `/parents` | `src/app/parents/page.tsx` | ✅ | Parent-focused landing |
| `/gurgaon` | `src/app/gurgaon/page.tsx` | ⚠️ | Legacy; now redirects to `/academies` |
| `/noida` | `src/app/noida/page.tsx` | ⚠️ | Legacy; redirects to `/academies` |

### Directory & discovery
| Path | File | Status | Description |
|---|---|---|---|
| `/academies` | `src/app/academies/page.tsx` | ✅ | All-cities directory landing |
| `/academies/[city]` | `src/app/academies/[city]/page.tsx` | ✅ | Academies in one city |
| `/academies/[city]/[sport]` | `src/app/academies/[city]/[sport]/page.tsx` | ✅ | Academies in city filtered by sport |
| `/academies/[city]/[sport]/[slug]` | `src/app/academies/[city]/[sport]/[slug]/page.tsx` | ✅ | Public listing page for a scraped (unclaimed) academy |
| `/academy/[slug]` | `src/app/academy/[slug]/page.tsx` | ✅ | Public page for a live Triq academy (with photo gallery) |
| `/c/[coachId]` | `src/app/c/[coachId]/page.tsx` | ✅ | Public coach profile |

### Auth / onboarding / booking flows
| Path | File | Status | Description |
|---|---|---|---|
| `/login` | `src/app/login/page.tsx` | ✅ | Phone + OTP / email / Google sign-in |
| `/register` | `src/app/register/page.tsx` | ✅ | Academy owner registration |
| `/onboarding` | `src/app/onboarding/page.tsx` | ✅ | Post-register academy setup (name, city, sports, photos) |
| `/auth/link/[token]` | `src/app/auth/link/[token]/page.tsx` | ✅ | One-tap WhatsApp login link redemption |
| `/book/[slug]` | `src/app/book/[slug]/page.tsx` | ✅ | Public turf / court booking flow |
| `/trial` | `src/app/trial/page.tsx` | ✅ | Public trial-class request |
| `/join` | `src/app/join/page.tsx` | ✅ | Parent self-enrol an additional child |
| `/join/success` | `src/app/join/success/page.tsx` | ✅ | Success screen for /join |
| `/r/[token]` | `src/app/r/[token]/page.tsx` | ✅ | Public receipt view by token |

### API handlers
| Path | File | Status | Description |
|---|---|---|---|
| `/api/auth/send-otp` | `send-otp/route.ts` | ⚠️ | OTP send endpoint (no live SMS/WA channel configured — falls back to test allowlist) |
| `/api/auth/verify-otp` | `verify-otp/route.ts` | ✅ | OTP verification + session issue |
| `/api/auth/logout` | `logout/route.ts` | ✅ | Clears session cookie |
| `/api/auth/me` | `me/route.ts` | ✅ | Returns current user |
| `/api/cron/monthly-fees` | `monthly-fees/route.ts` | ✅ | 02:00 1st-of-month Vercel cron; generates FeeRecord rows per org (Bearer `CRON_SECRET` auth) |
| `/api/health` | `health/route.ts` | ✅ | Liveness probe |
| `/api/receipts/[token]/image` | `[token]/image/route.tsx` | ✅ | OG-style PNG receipt generator |
| `/api/webhooks/razorpay` | `razorpay/route.ts` | ⚠️ | Signature-verified; 0 events ever delivered in prod |
| `/api/webhooks/razorpay/[orgId]` | `[orgId]/route.ts` | ⚠️ | Per-org Razorpay webhook variant |
| `/api/webhooks/razorpay/billing` | `billing/route.ts` | ⚠️ | Razorpay subscription billing events |
| `/api/webhooks/stripe` | `stripe/route.ts` | ⚠️ | Stripe webhook (unused — no Stripe integration live) |
| `/api/webhooks/whatsapp` | `whatsapp/route.ts` | ⚠️ | Meta WhatsApp Business API webhook (no live channel configured) |

---

## 2. React components (by folder)

### `src/components/org/` — Admin / Owner (72 files)
| File | Status | Purpose |
|---|---|---|
| `AcademySettings.tsx` | ✅ | Profile, payments, locale, photos settings tabs |
| `AddLeadForm.tsx` | ✅ | Capture new lead |
| `AdminClient.tsx` | ✅ | Top-level admin shell with all tabs wired up |
| `AnalyticsDashboard.tsx` | ✅ | Revenue + attendance + growth KPIs |
| `AttendanceInsights.tsx` | ✅ | Per-batch attendance trends |
| `AuditLogViewer.tsx` | ✅ | Admin-visible audit history |
| `AutoReminders.tsx` | ✅ | Auto-generated reminder list (session, fee, birthday, trial, absence, streak) |
| `BatchFeeEditor.tsx` | ✅ | Set per-batch monthly fee |
| `BatchHealthReport.tsx` | ✅ | Batch utilisation summary |
| `BatchTransfer.tsx` | ✅ | Move a student between batches |
| `BirthdayTracker.tsx` | ✅ | Upcoming birthdays with greet action |
| `BroadcastTab.tsx` | ✅ | Send announcements to many parents |
| `BulkActions.tsx` | ✅ | Multi-select mark-paid, archive, batch-assign |
| `BulkWhatsApp.tsx` | ✅ | Send WhatsApp to a cohort |
| `CalendarExport.tsx` | ✅ | iCal / Google Calendar export of batches |
| `CapacityAlerts.tsx` | ✅ | Flag over/under-utilised batches |
| `CertificateGenerator.tsx` | ✅ | Printable achievement certificates |
| `ChurnPredictor.tsx` | ✅ | At-risk student list |
| `CoachPerformance.tsx` | ✅ | Coach KPIs |
| `CoachProfile.tsx` | ✅ | Edit a coach's profile |
| `CoachVerification.tsx` | ✅ | Verification workflow for a coach |
| `CollectFees.tsx` | ✅ | Unpaid-fees dashboard with per-row WhatsApp reminder |
| `ContentCalendar.tsx` | ⚠️ | Content planning calendar (likely UI-only; no backing content model) |
| `CouponManager.tsx` | ✅ | Discount coupons CRUD |
| `CreateCoachDialog.tsx` | ✅ | Add a coach |
| `CreateStudentDialog.tsx` | ✅ | Add a student |
| `Deferred.tsx` | ✅ | Suspense helper for deferred-loaded sections |
| `ExcelImport.tsx` | ✅ | Bulk student import from .xlsx |
| `ExportCSV.tsx` | ✅ | Export students / fees as CSV |
| `FacilitiesTab.tsx` | ✅ | Manage facilities / courts |
| `FeePlans.tsx` | ✅ | Fee plan CRUD |
| `FeePricingAnalyzer.tsx` | ✅ | Market benchmark & simulator |
| `FeeToggle.tsx` | ✅ | Mark/reverse paid toggle (now reason-gated) |
| `GenerateFeesButton.tsx` | ✅ | Manual run of monthly fee generator |
| `GenerateSessionsButton.tsx` | ✅ | Manual run of session generator |
| `HolidayManager.tsx` | ✅ | Academy holiday calendar |
| `ImportExcelButton.tsx` | ✅ | Entry point for ExcelImport |
| `InboxTab.tsx` | ✅ | Parent↔admin message inbox |
| `InstagramGenerator.tsx` | ⚠️ | AI-assisted Instagram post generator (no live social posting) |
| `LeadPipeline.tsx` | ✅ | Kanban-style lead pipeline |
| `Leaderboard.tsx` | ✅ | Student points leaderboard |
| `LoginLinkButton.tsx` | ✅ | Generate one-tap WhatsApp login link |
| `MedicalForm.tsx` | ✅ | Student medical info |
| `OnboardingWizard.tsx` | ✅ | Initial setup checklist |
| `ParentEngagement.tsx` | ✅ | Metrics on parent app usage |
| `PayNowButton.tsx` | ✅ | Admin-triggered online fee payment |
| `PaymentPlans.tsx` | ✅ | Multi-month payment plans |
| `PayrollPanel.tsx` | ✅ | Staff payouts with permission gating |
| `PendingPayments.tsx` | ✅ | Awaiting-verification queue |
| `PhotoGallery.tsx` | ✅ | Academy media gallery |
| `ProductTour.tsx` | ⚠️ | Guided tour overlay |
| `RazorpayConnect.tsx` | ✅ | OAuth-style Razorpay keys config |
| `ReferralProgram.tsx` | ✅ | Referral tracking + rewards |
| `RevenueForecast.tsx` | ⚠️ | Multiplier-based forecast (not grounded) |
| `RevenueProjection.tsx` | ⚠️ | Same concern as above |
| `SeedButton.tsx` | 🧪 | Dev-only sample data seeder |
| `SocialPostGenerator.tsx` | ⚠️ | Generic social post generator (no live posting) |
| `StoreManager.tsx` | ✅ | Product CRUD for academy pro-shop |
| `StudentDetailDrawer.tsx` | ✅ | Side-sheet student detail |
| `StudentGrowthTracker.tsx` | ✅ | New-student growth chart |
| `StudentQRCode.tsx` | ✅ | QR for attendance |
| `StudentTable.tsx` | ✅ | Main student grid |
| `TeamPanel.tsx` | ✅ | Staff & coach members with role mgmt |
| `TestimonialCollector.tsx` | ✅ | Request / display testimonials |
| `TournamentBracket.tsx` | ⚠️ | Bracket UI (tournament model minimal) |
| `TransportManager.tsx` | ✅ | Route management |
| `TrialManager.tsx` | ✅ | Trial bookings and conversions |
| `TurfBoard.tsx` | ✅ | Turf availability + bookings grid |
| `WaitlistManager.tsx` | ✅ | Batch waitlist |
| `WhatsAppReminder.tsx` | ✅ | Per-row fee reminder opener |
| `WhatsAppRosterImport.tsx` | ✅ | Paste WhatsApp roster into students |
| `WhatsAppTemplates.tsx` | ✅ | Pre-built templates (fee, attendance, birthday, trial) |

### `src/components/coach/` — Coach (24 files + 1 subfolder)
| File | Status | Purpose |
|---|---|---|
| `AddMediaModal.tsx` | ✅ | Upload photo/video to a student |
| `AthleteSpotlightModal.tsx` | ✅ | Highlight a standout performance |
| `AttendanceToggle.tsx` | ✅ | Tap-to-mark present/absent/late |
| `BatchBroadcast.tsx` | ✅ | Message a whole batch |
| `CoachActions.tsx` | ✅ | Quick-action menu |
| `CoachBatchRoster.tsx` | ✅ | Squad view with filters (fee due, low attendance, not evaluated) |
| `CoachFeeKhata.tsx` | ✅ | Per-student fee collection sheet |
| `CoachMePanel.tsx` | ✅ | Own stats + payroll |
| `CoachShareProfileButton.tsx` | ✅ | Share public /c/[id] link |
| `CoachTabs.tsx` | ✅ | Coach-side tab navigation |
| `CoachVerificationBanner.tsx` | ✅ | Prompt coach to finish verification |
| `EmergencySOS.tsx` | ✅ | One-tap parent alert for injury |
| `EvaluateModal.tsx` | ✅ | Skill evaluation per student |
| `FeeKhataSheet.tsx` | ✅ | Printable fee ledger |
| `IncidentModal.tsx` | ✅ | Log an incident / injury |
| `InviteParentsCard.tsx` | ✅ | Bulk-invite parents of enrolled students |
| `MatchManager.tsx` | ✅ | Create match, track RSVPs |
| `MedicalCardModal.tsx` | ✅ | Read medical info (restricted) |
| `QRScanner.tsx` | ✅ | Scan StudentQRCode for attendance |
| `SessionAttendanceCard.tsx` | ✅ | Today's session roster + mark buttons |
| `ShareRecapButton.tsx` | ✅ | WhatsApp a recap after session |
| `TodayStatPills.tsx` | ✅ | Top-of-page KPI pills |
| `TrainingPlan.tsx` | ✅ | Session plan per batch |
| `squad/AttendanceAvatar.tsx` | ✅ | Avatar with attendance status badge |

### `src/components/parent/` — Parent (23 files)
| File | Status | Purpose |
|---|---|---|
| `AchievementBadges.tsx` | ✅ | Child achievement cards |
| `AttendanceCalendar.tsx` | ✅ | Month calendar of child attendance |
| `AttendanceStats.tsx` | ✅ | Summary stats |
| `AttendanceStreak.tsx` | ✅ | Streak counter |
| `AutoProgressReport.tsx` | ✅ | Auto-generated monthly progress |
| `CarpoolMatcher.tsx` | ⚠️ | Match parents in same batch (no live backend confirmed) |
| `CheckoutModal.tsx` | ✅ | Fee pay checkout |
| `CoachDirectory.tsx` | ✅ | Browse coaches at the academy |
| `DownloadReceipt.tsx` | ✅ | Download /r/[token] receipt |
| `FamilyDashboard.tsx` | ✅ | Multi-child view |
| `FeeHistory.tsx` | ✅ | Payment history |
| `FeedbackWidget.tsx` | ✅ | Submit feedback |
| `GamificationWidget.tsx` | ✅ | Points + leaderboard preview |
| `MediaFeed.tsx` | ✅ | Recent photos of their child |
| `MonthlyReport.tsx` | ✅ | Monthly summary |
| `ParentClient.tsx` | ✅ | Parent app shell |
| `PayOnlineButton.tsx` | ✅ | Launch Razorpay checkout |
| `PaymentReturnHandler.tsx` | ✅ | Post-redirect reconciliation |
| `ProShop.tsx` | ✅ | Order gear |
| `ProgressTimeline.tsx` | ✅ | Skill progress timeline |
| `RSVPButtons.tsx` | ✅ | Yes/no RSVP for matches/events |
| `ReferralWidget.tsx` | ✅ | Share referral link |
| `WeeklyTimetable.tsx` | ✅ | Next 7 days schedule |

### `src/components/directory/` — Public directory (7 files)
| File | Status | Purpose |
|---|---|---|
| `academy-card.tsx` | ✅ | Listing card |
| `claim-listing.tsx` | ✅ | Owner claims a scraped listing |
| `directory-grid.tsx` | ✅ | Grid layout |
| `directory-shell.tsx` | ✅ | Nav / breadcrumbs / JSON-LD |
| `form-fields.tsx` | ✅ | Shared form fields |
| `listing-view.tsx` | ✅ | Full academy listing view |
| `trial-request-form.tsx` | ✅ | Capture trial request |

### `src/components/marketing/` — Public pages (10 files)
| File | Status | Purpose |
|---|---|---|
| `demo-form.tsx` | ✅ | Sales lead capture |
| `demo-section.tsx` | ✅ | Demo CTA section |
| `hero-copy.tsx` | ✅ | Hero header copy |
| `landing-page.tsx` | ✅ | Full landing composition |
| `marketing.css` | ✅ | Marketing-only styles |
| `pricing-calculator.tsx` | ✅ | Interactive price calculator |
| `pricing-section.tsx` | ✅ | Plan cards |
| `product-mock.tsx` | ✅ | Phone / app mock graphic |
| `sections.tsx` | ✅ | Section layout primitives |
| `shell.tsx` | ✅ | Marketing shell + nav |

### `src/components/shell/` — Shared mobile shell (8 files)
| File | Status | Purpose |
|---|---|---|
| `AttentionItem.tsx` | ✅ | Alert / action row |
| `BookingsScreen.tsx` | ✅ | Bookings tab |
| `EmptyState.tsx` | ✅ | Reusable empty state |
| `InlineAttendance.tsx` | ✅ | Inline attendance widget |
| `KpiTile.tsx` | ✅ | KPI tile with sparkline |
| `MoreScreen.tsx` | ✅ | "More" tab for mobile |
| `SectionHeader.tsx` | ✅ | Standard section header |
| `TodayScreen.tsx` | ✅ | Mobile today screen |

### `src/components/team/` — Staff / multi-academy (3 files)
| File | Status | Purpose |
|---|---|---|
| `AcademySwitcher.tsx` | ✅ | Switch between academies you're a member of |
| `CheckInCard.tsx` | ✅ | Staff self check-in/out |
| `StaffHome.tsx` | ✅ | Staff home screen |

### `src/components/analytics/` — Analytics (2)
| File | Status | Purpose |
|---|---|---|
| `AnalyticsInit.tsx` | ✅ | PostHog bootstrap |
| `PlayerAnalytics.tsx` | ✅ | Per-athlete analytics viz |

### `src/components/admin/` — (1)
| File | Status | Purpose |
|---|---|---|
| `CreateBatchDialog.tsx` | ✅ | Modal to add a batch |

### `src/components/chat/` — (1)
| File | Status | Purpose |
|---|---|---|
| `ChatWindow.tsx` | ⚠️ | Parent↔admin chat UI |

### `src/components/sport/` — (2)
| File | Status | Purpose |
|---|---|---|
| `SportGlyph.tsx` | ✅ | Sport-specific icon |
| `sport-kind.ts` | ✅ | Sport metadata helper |

### `src/components/ui/` — Design system (44 files)
Shared primitives: `button`, `input`, `select`, `switch`, `dialog`, `card`, `badge`, `avatar`, `tabs`, `table`, `textarea`, `label`, `checkbox`, `skeleton`, `empty-state`, `confirm-dialog`, `stat-card`, `meter`, `sparkline`, `activity-ring`, `avatar-ring`, `glow-card`, `BottomSheet`, `AthleticButton`, `StatusChip`, `animated-counter`, `count-up`, `command-palette`, `data-filters`, `date-range-picker`, `dashboard-shell`, `error-boundary`, `keyboard-shortcuts`, `loading-button`, `notification-bell`, `paginated-table`, `print-view`, `status-mark`, `student-stories`, `theme-picker`, `themed-toaster`, `triq-logo`, `city-autocomplete` (new this session), `photo-picker` (new this session). All ✅.

---

## 3. Server actions (`src/app/actions/`, 60 files, 147 exports)

Grouped by concern:

### Auth
`loginWithEmail`, `loginWithGoogle`, `logout`, `logoutEverywhere`, `registerWithEmail`, `sendOtp`, `verifyOtpAndLogin`, `createLoginLink`, `inspectLoginLink`, `redeemLoginLink`, `createParentInviteLinks`.

### Onboarding / academy setup
`createAcademyWorkspace`, `registerAcademy`, `updateAcademy`, `updateAcademyPayments`, `updateAcademyLocale`, `switchAcademy`, `getMyAcademies`, `seedDemoData`.

### Students / batches / enrolment
`createStudent`, `updateStudent`, `deleteStudent`, `enrollAdditionalChild`, `transferStudent`, `createBatch`, `updateBatch`, `updateBatchSettings`, `deleteBatch`, `getBatches`, `importStudents`.

### Attendance / sessions
`markAttendance`, `markBatchAttendance`, `getTodayRoster`, `generateTodaySessions`, `cancelTodaySession`, `restoreTodaySession`, `saveSessionRecap`.

### Fees
`markFeeAsPaid`, `reverseFeePayment`, `toggleFeeStatus` (deprecated alias), `markFeePaid`, `confirmFeePayment`, `rejectFeePayment`, `reportFeePaid`, `getUnpaidFees`, `getFeeHistory`, `getFeeReceiptAction`, `getFeeReceiptToken`, `generateMonthlyFees`, `generateMonthlyFeesForOrg`, `getFeePlans`, `createFeePlan`, `deleteFeePlan`.

### Online payments
`createFeePaymentLink`, `syncFeePaymentLink`, `startOnlineFeePayment`, `confirmRazorpayCheckout`, `syncStripeCheckout`, `getOnlinePaymentOptions`, `resolvePayOption`, `connectRazorpay`, `disconnectRazorpay`, `getRazorpayStatus`.

### CRM
`createLead`, `updateLead`, `updateLeadStatus`, `getLeads`, `getLeadStats`, `convertLeadToStudent`, `convertTrialToStudent`, `recordTrialOutcome`, `updateTrialStatus`, `bookTrial`, `getOrgBySlug`, `submitDemoRequest`.

### Team / coaches / staff / payroll
`createCoach`, `updateCoach`, `addTeamMember`, `updateTeamMember`, `removeTeamMember`, `getTeam`, `getCoachVerification`, `toggleCoachVerification`, `updateVerificationStep`, `getPayroll`, `savePayoutAdjustments`, `markPayoutPaid`, `markPayoutUnpaid`, `addExpense`, `deleteExpense`, `markStaffAttendance`, `selfCheckIn`, `selfCheckOut`, `getStaffAttendanceMonth`, `getMyAttendance`.

### Content / media / announcements
`addPhoto`, `deletePhoto`, `getPhotos`, `uploadAcademyPhoto`, `removeAcademyPhoto`, `reorderAcademyPhotos`, `addHighlightReel`, `broadcastAnnouncement`, `broadcastToBatch`, `sendMessage`, `addTestimonial`, `getTestimonials`.

### Operations
`createFacility`, `saveFacility`, `archiveFacility`, `getTurfBoard`, `bookFacility`, `createCounterBooking`, `updateBooking`, `addHoliday`, `deleteHoliday`, `getHolidays`, `createRoute`, `deleteRoute`, `getRoutes`, `createEquipment`, `assignEquipment`, `deleteEquipment`, `addToWaitlist`, `updateWaitlistStatus`, `reportIncident`, `createEvent`, `updateRSVP`.

### Growth / gamification / commerce
`createCoupon`, `getCoupons`, `createProduct`, `placeOrder`, `fulfillOrder`, `createReferral`, `getReferrals`, `getReferralsCount`, `awardPoints`, `recalculatePoints`, `recalculateAllPoints`, `getPointBreakdown`, `submitFeedback`.

### Reminders / notifications
`getAutoReminders`, `markReminderSent`, `getRecentNotifications`, `getUnreadCount`.

### Analytics
`getAttendanceAnalytics`, `getRevenueAnalytics`, `getBatchHealthAnalytics`, `getStudentGrowthAnalytics`, `getParentEngagementAnalytics`.

### Reports / exports / audit
`exportAllStudentsCSV`, `getAuditLog`, `logAction`.

### Discovery / Places
`searchCities` (Google Places autocomplete).

### Destructive
`deleteAllData`.

### Medical
`updateMedicalInfo`, `updateDietPlan`.

### Skills / sports
`submitSkillReport`.

### Sales
`submitDemoRequest` (public demo request).

---

## 4. API handlers (`src/app/api/`, 10 files)

Covered under §1 route table. Summary:
- 4 auth endpoints (`send-otp`, `verify-otp`, `logout`, `me`)
- 1 cron (`monthly-fees`, Bearer-protected)
- 1 liveness (`health`)
- 1 receipt image renderer (OG card PNG)
- 5 webhooks (3× Razorpay, 1× Stripe, 1× WhatsApp) — all signature-verified in source; most unused in prod

---

## 5. Prisma models (47)

| Model | Purpose |
|---|---|
| **Organization** | Tenant root — academy's name, plan, locale (country/currency/timezone/locale/phoneCountry), photos, Razorpay keys |
| **User** | All humans — ADMIN / COACH / PARENT / STAFF roles, phone (unique), email, password hash |
| **OrgMembership** | Multi-org membership + permissions (OWNER / MANAGER / COACH / STAFF) |
| **Subscription** | Per-org paid-plan state + grace period |
| **BillingInvoice** | SaaS billing invoices (Triq → academy) |
| **Student** | Academy's athlete record |
| **Batch** | Named group of students with a coach, schedule, fee |
| **BatchEnrollment** | Student↔batch join with uniqueness |
| **Session** | A single scheduled training session instance |
| **Attendance** | Per-student per-session mark |
| **FeeRecord** | Monthly fee row per student |
| **FeePlan** | Reusable fee template |
| **Payment** | Online payment reconciliation (Razorpay/Stripe) |
| **Receipt** | Issued receipt with unique token |
| **Coupon** | Discount coupons |
| **Facility** | Court / turf / room |
| **Booking** | Non-turf facility booking |
| **TurfBooking** | Turf-specific hourly booking with repeat support |
| **Equipment** | Academy inventory |
| **Event** | Match / event / trip |
| **RSVP** | Event RSVPs |
| **Media** | Student session photos / videos |
| **GalleryPhoto** | Public academy gallery |
| **Announcement** | Admin → batch broadcast |
| **Message** | Parent↔admin direct messages |
| **SkillReport** | Monthly coach evaluation per student |
| **Incident** | Injury / discipline / medical incident log |
| **Feedback** | Parent feedback |
| **Lead** | CRM lead |
| **TrialBooking** | Scheduled trial |
| **DirectoryLead** | Public directory inquiry |
| **SalesLead** | Triq-internal sales lead |
| **ListedAcademy** | Scraped / manually added public directory listings |
| **ClaimRequest** | Owner claiming a scraped listing |
| **Waitlist** | Batch waitlist |
| **TransportRoute** | Pick-up/drop route |
| **StaffAttendance** | Staff check-in/out |
| **StaffPayout** | Monthly staff pay |
| **Expense** | Academy expense |
| **Referral** | Referral-program tracking |
| **Order** | Pro-shop orders |
| **Product** | Pro-shop products |
| **Holiday** | Academy holiday calendar |
| **AuditLog** | Admin action log |
| **VerificationToken** | OTP code storage (hashed) |
| **LoginToken** | One-tap WhatsApp login links (hashed) |
| **RateLimit** | Postgres-backed rate limiter buckets |

---

## 6. SQL migrations (`prisma/sql/`, 4)

| File | Purpose |
|---|---|
| `2026-10-14_enable_rls_on_exposed_tables.sql` | Enables Postgres Row-Level Security on tenant-exposed tables (end-to-end verification pending — see audit §5.7) |
| `2026-10-14_payroll_expenses.sql` | Creates `StaffAttendance` / `StaffPayout` / `Expense` tables |
| `2026-10-14_team_memberships.sql` | Creates `OrgMembership` and backfills existing users |
| `2026-10-17_hot_path_indexes.sql` | Adds composite indexes on `Attendance`, `FeeRecord`, `Payment`, etc. |

Supabase migrations applied this session (not in `prisma/sql/`): added `country/currency/timezone/locale/phoneCountry/photos` columns to `Organization`.

---

## 7. Key `src/lib/` modules (46 files)

| Module | Purpose |
|---|---|
| `auth.ts` | Session cookie (HMAC-signed, httpOnly), `getSession`, `requireAuth`, `requireMember` |
| `membership.ts` | OrgMembership helpers, `isOrgOwner`, `checkPermission`, `requirePermission`, backfills |
| `team.ts` | Role → permission matrix (OWNER / MANAGER / COACH / STAFF + staff sub-roles) |
| `features.ts` | Feature flags |
| `pricing.ts` | Canonical `PlanId`, `canonicalPlan`, `PLAN_LIMITS`, plan cards, founding offer |
| `billing-service.ts` | Student quota check against plan + grace period |
| `fees.ts` | `resolveStudentFee`, IST date helpers (today, month string, weekday) |
| `payment-service.ts` | Shared payment lifecycle |
| `payments.ts` | Payment utility helpers |
| `pay-link.ts` | Build UPI / Razorpay pay-link messages |
| `receipt-service.ts` | `getOrCreateReceipt` (idempotent per `feeRecordId`) |
| `razorpay.ts` / `razorpay-org.ts` | Razorpay client + per-org key handling |
| `gateways/` | Payment gateway abstraction folder |
| `i18n.ts` | `OrgLocale` type + `formatMoney`, `formatDate`, `formatTime`, `normalizePhoneForOrg`, `COUNTRY_OPTIONS` |
| `org-locale-context.tsx` | React context + hooks for OrgLocale (added this sprint) |
| `cities.ts` | Static 65-city autocomplete fallback |
| `enums.ts` | `LEAD_STATUSES` / `TRIAL_STATUSES` tuples (no Prisma deps, test-safe) |
| `phone.ts` | `parsePhone`, `toWaMeNumber`, country code handling |
| `whatsapp.ts` | WhatsApp Business API config + 6 message templates |
| `msg91.ts` | MSG91 SMS integration (unused in prod) |
| `secret-box.ts` | AES-256-GCM encryption helper for Razorpay secrets |
| `rate-limit.ts` | In-memory limiter + Postgres-backed `rateLimitDb` |
| `directory.ts` | Public directory helpers (CITIES, SPORTS, slug, listing path, phone clean) |
| `turf.ts` / `turf-engine.ts` | Turf scheduling + booking logic |
| `payroll.ts` | Payroll calculations |
| `coach.ts` | Coach utilities + `cleanPhone`, `scheduleStartMinutes` |
| `analytics.ts` | Shared analytics helpers |
| `today.ts` | Today-screen data aggregation |
| `sport-metrics.ts` | Sport-specific skill metric definitions |
| `motion.ts` | Reduced-motion preference helper |
| `theme.ts` | Theme tokens + boot script |
| `toast-messages.ts` | Standard toast strings |
| `validations.ts` | Zod validation schemas |
| `import-utils.ts` | Bulk-import helpers (clean phone, parse DoB) |
| `pagination.ts` | Pagination helpers |
| `safe-url.ts` | External-URL safety wrapper |
| `schema-ensure.ts` | ⚠️ Runtime `CREATE TABLE IF NOT EXISTS` for tables added post-launch |
| `sentry-options.ts` | Sentry config |
| `app-url.ts` | Base URL resolver |
| `action-attempt.ts` / `action-result.ts` | Server-action result shape helpers |
| `currency.ts` | Currency helpers |
| `db.ts` | Prisma client singleton |
| `utils.ts` | Misc UI utilities (`cn`, etc.) |

---

## Takeaway

**Density centres on Admin ops (72 org components, ~55 admin-facing server actions) and the Parent app (23 components).** Fees + attendance + CRM are the most mature flows end to end: UI, server action, DB model, analytics, and audit log all present.

**Apparent gaps where UI exists but backing data is thin:** `ContentCalendar`, `SocialPostGenerator`, `InstagramGenerator`, `TournamentBracket`, `ChatWindow` — components render but no Prisma model or server action makes them durable. `CarpoolMatcher` likewise.

**Apparent gaps where server actions exist but no live traffic:** Razorpay / Stripe / WhatsApp webhook handlers are complete and signature-verified, but zero rows in `Payment` with `status='PAID'` means they've never processed real production traffic — webhook edge cases are untested in prod. OTP channel (MSG91 / WhatsApp Business) is coded but not configured, so phone OTP login currently requires the test-phone allowlist.

**Obviously unused / legacy:** `src/app/gurgaon` and `src/app/noida` redirect to `/academies`; `src/components/org/SeedButton` is dev-only; Stripe webhook has no corresponding checkout action; `src/components/org/RevenueForecast` and `RevenueProjection` use multiplier formulas rather than fitted trends (flagged in audit §4.I).

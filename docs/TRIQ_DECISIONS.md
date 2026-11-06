# TRIQ Decisions

An ADR-style log of decisions already made. Newest decisions go at the bottom with the next number. Do not edit a past decision; record a new one that supersedes it and mark the old one "Superseded by D-n".

Format: date, decision, reason, consequences, source.

Status values: **Accepted** · **Superseded**.

---

## D-1. Academy pricing: ₹150 per active student, flat

- **Date:** 2026-10-27 (first proposals), 2026-10-29 (final).
- **Status:** Accepted.
- **Decision:** Growth plan is ₹150 per active student per month, the same rate for every student (no volume bands), with a minimum of ₹699 per month, before 18% GST. Free up to 30 active students. Founding offer: 50% off for 12 months for the first 50 academies. International: US$1 per active student, minimum US$49.
- **History:** 2026-10-27 proposal ₹15/₹10/₹7 (minimum ₹499), raised the same day to ₹20/₹12/₹8 (minimum ₹699). Replaced by the flat ₹150 rate on 2026-10-29.
- **Reason:** Founder decision. The pricing doc records that ₹150 is well above the ₹5–20 per student seen in Indian comparables; the 30-student free tier is the stated wedge.
- **Consequences:** Subscription billing is not automated; invoice manually until `SubscriptionInvoice` and the `triqBilling` flag are live. Numbers live in `src/lib/pricing.ts`.
- **Source:** `docs/business/TRIQ_PRICING.md`; commit `4af5e46`.

## D-2. Receipt void columns held out of the Prisma schema until the SQL runs

- **Date:** 2026-10-29.
- **Status:** Accepted.
- **Decision:** `Receipt.voidedAt`, `voidReason` and `voidedById` are in `prisma/sql/2026-10-29_wave2.sql` but not in `prisma/schema.prisma`. Order: run the SQL on production (with approval), then add the three fields and `@@index([orgId, voidedAt])`, then deploy.
- **Reason:** A Prisma client that knows these columns selects them on every receipt query without a `select`. If it is deployed before the columns exist, receipt reads and fee payments fail.
- **Consequences:** Receipt voiding stays Schema only until the migration runs. The same rule applies to any column added to an existing, heavily used model.
- **Source:** `docs/specs/wave2-schema.md`; comment in `model Receipt`; commit `8c8ed4b`.

## D-3. Adopt the master blueprint

- **Date:** 2026-11-06.
- **Status:** Accepted.
- **Decision:** The founder's master blueprint ("TRIQ — The Complete Sports Ecosystem") is the product direction: eight ecosystems plus TRIQ Intelligence, 20 participant types, athlete-first, Mind & Performance as a dedicated vertical. The existing application is evolved; no new application is started.
- **Reason:** Positions TRIQ as the operating system for sports rather than an academy app with modules, while keeping the working Academy OS.
- **Consequences:** The ten `docs/TRIQ_*.md` documents are maintained. Work is ordered by the blueprint's priorities and the audit's plan. Verticals are released only when workflows, safeguards, tests and customer validation are ready.
- **Source:** blueprint; `docs/TRIQ_AUDIT.md`.

## D-4. Release through feature branches and previews; no direct pushes to `main`

- **Date:** 2026-11-06.
- **Status:** Accepted.
- **Decision:** Each piece of work goes on a feature branch (`feat/…`, `fix/…`). Every push gets a Vercel Preview pointed at a staging database. Production release is a merge to `main`, only with founder approval.
- **Reason:** Production had been served directly from `main`. Changes need review on a working preview before they reach academies.
- **Consequences:** Preview environment variables must be set to staging values. UI changes are reviewed with screenshots at 390px and 1440px. Rollback is Vercel instant rollback plus a down script per migration.
- **Source:** `docs/TRIQ_AUDIT.md` section 9.

## D-5. Staging database before any production migration

- **Date:** 2026-11-06.
- **Status:** Accepted. Choice of staging option still open (Supabase branch of `triq`, or a separate Mumbai project with fictional data).
- **Decision:** Every migration runs on a non-production database first, is recorded in a `_migrations` ledger, then runs on production with founder approval, before the code that needs it is merged. Production changes are additive unless a destructive change has its own approval. Hand-written SQL in `prisma/sql/`; no `prisma migrate` or `prisma db push`.
- **Reason:** Production schema has drifted from repo SQL, runtime DDL exists, and there was no record of what ran where.
- **Consequences:** Wave 2 runs on staging first. Runtime DDL in `src/lib/schema-ensure.ts` is retired once covered.
- **Source:** `docs/TRIQ_AUDIT.md` sections 5 and 9; `docs/specs/wave2-schema.md`.

## D-6. Three-tier health and wellbeing data model

- **Date:** 2026-11-06.
- **Status:** Accepted.
- **Decision:** Data is split into tier 1 (coaching), tier 2 (personal wellbeing, owned by the athlete) and tier 3 (clinical, owned by the professional). Tiers 2 and 3 live in a separate `care` schema, accessed only through `CareAccessGrant`, with every read in `CareAccessLog` and clinical notes encrypted at the application level. Tiers 2 and 3 are excluded from exports, analytics, AI context, search, shared backups and anything sponsors, selectors or opponents can reach.
- **Reason:** Wellbeing is not a performance score. Most athletes are minors, and health and psychological data are sensitive.
- **Consequences:** Coaches and academy owners get no automatic access to wellbeing or clinical records. No ranking or reward uses tier 2 or 3 data.
- **Source:** `docs/TRIQ_AUDIT.md` section 6; `TRIQ_DATA_PRIVACY.md`.

## D-7. Mind & Performance ships content only until counsel and clinical sign-off

- **Date:** 2026-11-06.
- **Status:** Accepted.
- **Decision:** Step C1 (mental-skills library, sport packs, parent and coach education) may be built; it stores no personal data and needs sports-psychologist review. C2 (private wellbeing) and C3 (professional services) hold no real data until counsel and a clinical advisor sign off.
- **Reason:** Safeguarding for minors, notification rules and legal obligations must be set by qualified people before collecting wellbeing or clinical data. The product must never promise confidentiality it cannot keep.
- **Consequences:** C2 and C3 move out of the 61–90 day window if sign-off is late. Advisors still to be named.
- **Source:** `docs/TRIQ_AUDIT.md` sections 6 and 7.

## D-8. Points are never deducted for missed sessions

- **Date:** 2026-11-06.
- **Status:** Accepted (Sprint 1 item 10).
- **Decision:** Remove the rule that deducts 5 points per missed session. Missing a session never lowers points or level.
- **Reason:** A sick or injured child would lose points. This contradicts the athlete-first principle.
- **Consequences:** The rule in `src/app/actions/points.ts` is removed with a test. The wave 2 rewards ledger must not reintroduce it.
- **Source:** `docs/TRIQ_AUDIT.md` section 8; athlete flagship spec.

## D-9. Analytics excluded from child and family pages

- **Date:** 2026-11-06.
- **Status:** Accepted.
- **Decision:** Vercel Web Analytics is merged with child, parent, family and token pages excluded, and query strings stripped from all others.
- **Reason:** Master-plan risk 4: no analytics on pages showing children's or families' information.
- **Consequences:** `src/lib/analytics-privacy.ts` holds the excluded prefixes (sprint-1, commit `94c5826`). Any new child-facing route must be added to that list.
- **Source:** `docs/TRIQ_AUDIT.md` sections 3 and 8.

## D-10. Founder approved all Sprint 1 items

- **Date:** 2026-11-06.
- **Status:** Accepted.
- **Decision:** All twelve Sprint 1 backlog items in `docs/TRIQ_AUDIT.md` section 8 are approved, including those marked as needing approval: deleting the 20 fully merged branches, revoking EXECUTE on `rls_auto_enable()`, the migration ledger and staging database, and previews on staging.
- **Reason:** Founder review of the first deliverable.
- **Consequences:** Approval covers the sprint items as written. Production database changes still run on staging first (D-5). The staging-database option and the `xplay` question remain open decisions.
- **Source:** Founder approval, 2026-11-06 (relayed in the Sprint 1 brief).

## D-11. Staging database is the existing `Sportos` project

- **Date:** 2026-11-06
- **Status:** Accepted.
- **Decision:** Use the old Tokyo project `Sportos` (`oxhhdtzkusjqdvuyitkf`) as the staging database. It held no data (47 empty tables). Preview builds sync its schema from `prisma/schema.prisma` through `scripts/vercel-build.sh`, only when `TRIQ_STAGING_DB=1` is set for Preview, and the script refuses any URL containing the production project ref.
- **Reason:** The free Supabase plan allows two active projects; a new staging project was refused. Supabase branching would not work because the base tables were created outside Supabase's migration tracking.
- **Consequences:** Staging holds fictional data only. Exclusion constraints and RLS settings that exist only in hand-written SQL are not reproduced by `prisma db push`; staging differs from production there until a full baseline migration exists.
- **Source:** Founder, 2026-11-06 ("Use sportos and everything will be done in that").

## D-12. Canonical consent purpose name for AI

- **Date:** 2026-11-06
- **Status:** Accepted.
- **Decision:** `AI_PROCESSING` is the consent purpose for including a child's data in AI features, matching the schema comment on `ConsentRecord.purpose`.
- **Reason:** One name in code and docs.

## D-13. Blood group on the coach's emergency SOS screen

- **Date:** 2026-11-06
- **Status:** Accepted.
- **Decision:** Coaches see an athlete's blood group on the emergency SOS screen only. Everywhere else in the coach view, coaches see only allergies and the emergency contact.
- **Reason:** In an emergency, blood group can matter to first responders, and the SOS screen is used only in that situation. Founder delegated the call ("You can decide it").
- **Source:** Founder, 2026-11-06.

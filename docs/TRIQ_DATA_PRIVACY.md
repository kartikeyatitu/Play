# TRIQ Data Privacy

Date: 2026-11-06. Sources: `docs/TRIQ_AUDIT.md` sections 5 and 6, `docs/specs/wave2-schema.md`, `prisma/schema.prisma`, `docs/SECURITY.md`.

This is a design and engineering document, not legal advice. Lines marked **COUNSEL:** need confirmation from qualified counsel before the related feature holds real data.

Most TRIQ athletes are minors. Privacy is a platform requirement, not a feature.

## 1. Principles

1. **Data minimisation.** Collect only what a workflow needs.
2. **Separation.** Coaching data, personal wellbeing and clinical data live apart, with different owners and access rules.
3. **No automatic access** to private wellbeing or clinical records for coaches, academies, selectors or sponsors.
4. **Consent per purpose**, recorded, withdrawable, and checked at the point of use.
5. **Never sold, never advertised.** TRIQ never sells access to health information and never uses psychological data for advertising.
6. **Honest confidentiality.** The product never promises confidentiality it cannot keep.

## 2. The three data tiers

| Tier | Contents | Owner | Default access | AI use |
|---|---|---|---|---|
| **1. Coaching** | Attendance, match stats, skill and physical assessments, fitness tests, goals | The academy, with the athlete | Coach of the batch, academy staff with permission, the athlete, guardians | Allowed with redaction and permission-aware retrieval |
| **2. Personal wellbeing** | Check-ins, journal, recovery log, mental-skills progress | The athlete (guardian for young children) | Only people the athlete chooses, revocably | Off unless the athlete opts in; never used for training |
| **3. Clinical** | Professional assessments, screening results, treatment notes, diagnoses, care plans | The qualified professional | That professional and the authorised care team; the athlete as agreed | Never |

Medical safety information (allergies, emergency contact, conditions flagged "coach must know") is tier 1 with restricted fields. Coaches see only those safety-critical fields (Sprint 1 item 10). Today coaches can see more; this is a known risk being fixed.

**Status:** tier 1 is Built and used. Tiers 2 and 3 are **Planned**; no tier 2 or 3 data is collected today.

## 3. Permissions matrix

From `TRIQ_AUDIT.md` section 5. This is the starting point; each new data category gets its own row before it ships.

| Data | Athlete (18+) / guardian | Coach | Academy owner | Finance staff | Qualified clinician | Sponsor / selector |
|---|---|---|---|---|---|---|
| Public sporting profile | Own and control | View | View | — | View | View if published |
| Training schedule and attendance | Own | Assigned athletes | Their academy | — | With consent | No |
| Physical assessments | Own | Assigned athletes | Limited operational | — | If authorised | No |
| Match stats and results | Own | Assigned athletes | Their academy | — | — | If published |
| Fees, invoices, receipts | Own / guardian | No | With finance permission | Yes | No | No |
| Medical safety info (allergy, emergency contact, "coach must know") | Own / guardian | Assigned athletes | Their academy | No | Yes | No |
| Personal wellbeing (check-ins, journal, recovery log) | Own | **No automatic access** | **No automatic access** | No | Only if shared | **Never** |
| Clinical records and notes | As agreed with provider | **No** | **No** | No | Authorised care team | **Never** |

Notes:

- "Own" for a minor means the guardian acts, with the athlete's assent from 13 (section 7).
- "Assigned athletes" means students in batches the coach is assigned to.
- Money permissions are enforced from membership today (`f3ba220`); staff and coach permissions from membership are on `release/sprint-1` (`bb9fa6f`).

## 4. The `care` schema

Status: **Planned.** Must not hold real data before counsel and clinical sign-off.

### Placement

- Tier 2 and tier 3 tables live in a separate Postgres schema, `care`, not in `public`.
- No academy-scoped query can join into it. Only `care` domain service functions read or write it.
- RLS enabled with no policies, as for every table.

### `CareAccessGrant`

An explicit, revocable grant. No grant, no access.

| Field | Meaning |
|---|---|
| Subject | The athlete whose records are covered |
| Grantee | The person or care team receiving access |
| Scope | Which records or record types |
| Purpose | Why access is given (for example, an engagement with a named professional) |
| Expires at | Grants expire; open-ended grants need a stated reason |
| Granted by | The athlete, or the guardian for a minor; the method recorded |
| Revoked at | Set when withdrawn; a new grant is a new row |

### `CareAccessLog`

- **Every read is logged**: who, which record, when, under which grant.
- The athlete (or guardian) can see who looked.
- Append-only.

### Encryption

- Clinical notes (tier 3) are **encrypted at the application level** with a key separate from the payments key (`src/lib/secret-box.ts` holds payment gateway secrets today).
- The key is held only in production environment variables. Never in the repository, never in chat, never in preview environments.

### Exclusions

Tier 2 and tier 3 data are excluded from:

- academy exports and reports;
- web and product analytics;
- AI context;
- search indexes;
- backups or dumps shared outside the platform;
- anything a sponsor, selector or opponent can reach;
- rankings, scores, leaderboards, levels and rewards.

## 5. Consent

### Ledger

`ConsentRecord` (wave 2, **Schema only**, flag `consentLedger` off): one row per student, guardian and purpose, with `granted`, `grantedAt`, `withdrawnAt`, `method` (OTP, IN_PERSON, SIGNED_FORM) and `noticeVersion`. Withdrawal sets `withdrawnAt`; a new grant is a new row.

### Purposes

| Purpose | Covers | Source |
|---|---|---|
| `CORE_SERVICE` | Running the academy relationship: attendance, fees, progress | Schema comment |
| `PROGRESS_SHARING` | Sharing progress beyond the academy | Schema comment |
| `MARKETING` | Marketing messages | Schema comment |
| `AI_PROCESSING` | Including the child's data in AI features. Canonical name (decided 2026-11-06); the audit's `ai_assistance` means the same purpose | Schema comment; audit |
| Media scopes | `internal_coaching`, `parents_of_batch`, `academy_public`, `tournament_public` (in `MediaConsent`, per scope) | Wave 2 spec |
| Feature-specific | `OpportunityApplication.guardianConsent`, `FeeMandate` consent, second-academy join consent (sprint-1 branch) | Existing code |
| Care purposes | Per engagement with a professional; sharing a wellbeing summary with a named person | Planned with `CareAccessGrant` |

Purposes are checked at the point of use (for example, before building AI context).

**COUNSEL:** confirm the list of purposes, the notice wording per purpose, and which consent methods count as verifiable parental consent.

## 6. Retention

No retention periods are set yet. Do not invent them in code.

| Data | Current state | Needed |
|---|---|---|
| Media | `MediaAsset.deleteAfter` exists in schema (wave 2, not applied) | Default periods per scope |
| Tier 1 coaching and academy records | No retention rule | Period after a student leaves |
| Financial records (fees, receipts, invoices) | Kept; receipts are voided, never deleted (wave 2 design) | Statutory period |
| Audit and access logs | Kept | Period |
| Tier 2 and tier 3 | Not collected | Periods set with the clinical advisor |

**COUNSEL:** set retention periods for each row, including the statutory period for financial and tax records and for clinical records.

## 7. Minors

| Age | Model |
|---|---|
| Under 13 | Guardian-led |
| 13 to 17 | Athlete-facing with guardian consent and the athlete's own assent |
| 18+ | Full athlete control |

- Public surfaces show at most first name and last initial for a minor, with guardian consent. No under-18 contact details on any public surface (`docs/SECURITY.md`).
- Live public views and public receipts mask minors (`032d3fd`).
- Web analytics never records child, family or token pages (`src/lib/analytics-privacy.ts`, sprint-1 branch).
- Limits of confidentiality are explained in plain language before any wellbeing or professional service begins.

**COUNSEL:** confirm the age bands against Indian and UAE law, and who must be notified when a minor is at risk.

## 8. Deletion and export workflow

**Today:** `src/app/actions/account-deletion.ts` records an account-deletion **request** for manual review. It deletes nothing. The purge pipeline is not built and needs founder approval. `DataRequest` (DELETE or EXPORT, with a reference ID and status REQUESTED → IN_REVIEW → DONE or REJECTED) is **Schema only**.

**Proposed workflow:**

1. Request from the user (logged in) or by verified phone, rate-limited. A reference ID is returned.
2. Identity verified; for a minor, the request comes from or is confirmed by a guardian.
3. Review: list the records in scope across academies (`Student` rows, guardian links, media, consents, care records).
4. Hold anything that must legally be kept (financial records) and tell the requester what is kept and why.
5. Delete or anonymise the rest. Media files removed from storage, not only marked.
6. Record completion in `DataRequest` and `AuditLog` without copying the deleted values.
7. Export requests produce a file for the requester only, through a signed, expiring link.

Every new table must be added to the deletion path (`src/app/actions/delete.ts` per the release checklist).

**COUNSEL:** confirm response deadlines and what may be retained.

## 9. Legal context

As stated in the audit. Not a legal conclusion.

| Jurisdiction | Instruments named in the audit | Relevance |
|---|---|---|
| India | Digital Personal Data Protection (DPDP) Act and Rules | Verifiable parental consent for under-18s. The audit records substantive duties from May 2027 |
| UAE | Personal Data Protection Law (PDPL); Child Digital Safety Law | Planned market; children's data |

**COUNSEL:** confirm the DPDP commencement dates and duties that apply to TRIQ, whether health and psychological data need any further basis or registration, cross-border transfer rules (Supabase is in Mumbai), and the UAE obligations before UAE launch.

**COUNSEL and clinical advisor:** sign off before tier 2 or tier 3 stores real data.

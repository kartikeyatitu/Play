# Vertical 16 — AI assistance (light v1)

Status: planning doc. There is no real AI in the repo today. Verified against branch `feat/academy-os-branches` on
2026-10-25 (read-only).

## 1. Goal

Save academy owners and coaches writing time with a real language model, in the two places they write most: messages
to parents and monthly coach notes on a child's progress. Then give owners a plain-language weekly summary built from
their real numbers, replacing the current rule-based "AI Insights" claims with something honest. Every AI output is a
draft a human edits and sends, is labelled as AI-assisted, never sees children's medical data or anyone's contact
details, is logged per academy, and is rate-limited per academy.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| LLM provider SDK / API calls | `package.json` dependencies: no `@anthropic-ai/sdk`, `openai`, `ai`, `@ai-sdk/*`, `langchain`; `grep -rniE "anthropic\|openai"` over `src` → no hits | missing |
| "AI Insights" tab | `src/components/org/AdminClient.tsx` ~line 187 (nav) and ~634 (content): gated by `FEATURES.experimental` (default `false`, `src/lib/features.ts`); header text "Smart predictions powered by your academy data" | UI-only (heuristic) |
| ChurnPredictor | `src/components/org/ChurnPredictor.tsx`: additive points for missed sessions in last 5/10 and unpaid fee months | heuristic, gated |
| RevenueForecast | `getRevenueAnalytics` in `src/app/actions/analytics.ts` (~line 151): `current = current * 1.05 * 0.97` per month | heuristic, gated |
| RevenueProjection | `src/components/org/RevenueProjection.tsx`: projected = billed or students × rate; shown on the **Analytics** tab (~line 622), **not** behind `experimental` | working (arithmetic, not AI) |
| ContentCalendar / SocialPostGenerator / InstagramGenerator | `src/components/org/*.tsx`: hard-coded `templates` arrays filled with academy name/stats; Marketing tab gated by `experimental` | UI-only (templates) |
| Server-side secret pattern | `src/app/actions/places.ts` reads `process.env.GOOGLE_PLACES_API_KEY` inside a "use server" file ("Keeps the API key server-only") | working (pattern to copy) |
| Per-key DB rate limit | `rateLimitDb(key, max, windowMs)` in `src/lib/rate-limit.ts` (`RateLimit` table, falls back to in-memory) | working |
| Announcement send | `broadcastAnnouncement(title, message)` in `src/app/actions/announcements.ts`, `checkPermission("settings.manage")` | working |
| Coach notes | `EvaluateModal` (`src/components/coach/EvaluateModal.tsx`, "Coach notes (visible to parents)") → `submitSkillReport` in `src/app/actions/reports.ts` (coach limited to own batches' students) | working |
| Sensitive data to keep out | `Student.medicalInfo`, `bloodGroup`, `dietPlanUrl`; `Incident`; phones on `User`, `Lead`, `TrialBooking`, `TurfBooking` | must never reach a model |

## 3. Gaps for a real v1

- No provider client, no server-side key, no model config.
- No usage log or per-org quota; nothing to show cost per academy.
- No redaction layer guaranteeing contact details and medical data are stripped.
- No "AI-assisted" marker on saved content parents read.
- Existing "AI" labels describe heuristics; if the experimental flag is ever turned on, the claim is misleading.

## 4. v1 scope

**In**
- Server-only AI client (`src/lib/ai/`) calling one provider over HTTPS with `AI_API_KEY` and `AI_MODEL` env vars (not
  `NEXT_PUBLIC_`), timeout, one retry, max output tokens cap.
- Feature A — "Draft with AI" in the announcement composer: owner types bullet points ("ground closed Sunday, rain,
  makeup Tuesday 5pm") → title + message draft in the academy's locale/tone; owner edits, then sends via the existing action.
- Feature B — "Suggest note" in EvaluateModal: from sport, this month's scores/metrics and attendance %, plus the coach's
  own keywords → 2–3 sentence parent-friendly note. The child is referred to as "your child"; no name sent.
- Feature C — Owner weekly summary card: aggregates only (active students, attendance %, sessions held/cancelled,
  dues pending count/amount, new leads by status, trials booked, count of students flagged by the existing churn rules)
  → 5-bullet plain-language summary with one suggested action. No names.
- `AiUsage` log, per-org daily cap and per-user hourly cap, "AI-assisted" badge in drafts and on saved rows.

**Out (explicitly)**
- Chatbots for parents, autonomous sending, WhatsApp auto-replies, image generation, predictions presented as facts,
  fine-tuning, storing prompts/outputs, any use of medical/incident data, rewriting the existing heuristic components.

## 5. Data model

New: `AiUsage` (no existing table records per-org usage; `AuditLog.details` is free text and not queryable for quotas).
Reuse: `RateLimit` via `rateLimitDb` for burst limits. Additive columns mark saved AI-assisted content.

```prisma
/// Vertical 16 (additive): one row per model call. Never stores prompt or output text.
model AiUsage {
  id           String   @id @default(cuid())
  orgId        String
  userId       String
  feature      String   // ANNOUNCEMENT_DRAFT | COACH_NOTE_DRAFT | WEEKLY_SUMMARY
  model        String
  inputTokens  Int      @default(0)
  outputTokens Int      @default(0)
  status       String   // OK | ERROR | RATE_LIMITED | QUOTA_EXCEEDED | BLOCKED
  latencyMs    Int?
  createdAt    DateTime @default(now())
  @@index([orgId, createdAt])
}
// Announcement gets: aiAssisted Boolean @default(false)
// SkillReport gets:  aiAssisted Boolean @default(false)
```

`prisma/sql/2026-10-26_ai_usage.sql` (proposed; NOT applied without founder approval):

```sql
-- Additive only. NOT APPLIED. Apply BEFORE deploying code that selects the new columns.
CREATE TABLE IF NOT EXISTS "AiUsage" (
  "id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL, "feature" TEXT NOT NULL, "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0, "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL, "latencyMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "AiUsage_orgId_createdAt_idx" ON "AiUsage"("orgId", "createdAt");
ALTER TABLE "AiUsage" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "aiAssisted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SkillReport"  ADD COLUMN IF NOT EXISTS "aiAssisted" BOOLEAN NOT NULL DEFAULT false;
```

## 6. Build slices

**S1 — AI plumbing + announcement drafts**
- Objective: safe server-side client, usage log, limits, and the first user-visible use (Feature A).
- Files: `src/lib/ai/redact.ts` (pure: strips phone numbers in any `phoneCountry` format, emails, URLs with tokens;
  allow-list builders that only accept named fields), `src/lib/ai/prompts.ts` (pure prompt builders per feature),
  `src/lib/ai/limits.ts` (constants: e.g. 50 calls/org/day, 20/user/hour — numbers are founder decisions),
  `src/lib/ai/client.ts` (server-only fetch wrapper; imported only from "use server" files),
  `src/lib/__tests__/ai-redact.test.ts`, `src/lib/__tests__/ai-prompts.test.ts`,
  `src/app/actions/ai.ts` ("use server": `draftAnnouncement`), "Draft with AI" button in
  `src/components/org/BroadcastTab.tsx` (the component that calls `broadcastAnnouncement`),
  `src/app/actions/announcements.ts` (accept `aiAssisted` flag), `src/lib/features.ts`.
- Permission/tenancy: `checkPermission("settings.manage")` (same as `broadcastAnnouncement`); context loaded server-side
  from `session.orgId` only (academy name, sports, batch name) — never from client-supplied ids without an org check.
- Limits: `rateLimitDb("ai:org:"+orgId, max, 24h)` and `rateLimitDb("ai:user:"+userId, max, 1h)`; every call (including
  refusals) writes `AiUsage`.
- Audit: `AI_DRAFT_GENERATED` (feature, model, tokens — no text); `ANNOUNCEMENT_SENT_AI_ASSISTED` when sent.
- Tests: redaction (Indian, UAE, UK numbers; emails), prompt builders never include keys outside the allow-list,
  limit constants sane.
- Accept: no `AI_*` var is prefixed `NEXT_PUBLIC_`; key absent → button hidden and action returns "AI not configured";
  flag off → nothing rendered; draft visibly labelled "AI draft — check before sending".

**S2 — Coach note suggestions**
- Objective: Feature B in `EvaluateModal`.
- Files: `src/app/actions/ai.ts` (`draftCoachNote(studentId, month, keywords, scores)`), `EvaluateModal.tsx` button,
  `src/app/actions/reports.ts` (`aiAssisted` param), parent report view shows "AI-assisted note" tag.
- Permission/tenancy: same student lookup as `submitSkillReport` (coach → own batches only; admin → in-org). Server loads
  attendance % itself; only `{ sport, scores, metrics, attendancePct, keywords }` go to the model.
- Audit: `AI_DRAFT_GENERATED` (feature COACH_NOTE_DRAFT, studentId hashed or omitted).
- Tests: `buildCoachNotePrompt` input type has no name/medical/contact fields; redaction applied to keywords.
- Accept: a coach cannot draft for a student outside their batches.

**S3 — Owner weekly summary**
- Objective: Feature C as a card on the Today tab (on demand, cached per week).
- Files: `src/lib/ai/summary-input.ts` (pure: aggregates → prompt input), `src/app/actions/ai.ts`
  (`getWeeklySummary`), card component.
- Permission: `checkPermission("reports.view")`.
- Audit: `AI_DRAFT_GENERATED` (WEEKLY_SUMMARY).
- Tests: aggregate shaping; input contains numbers only, no names.
- Accept: summary text shows the numbers it was built from beside it, so owners can check it.

## 7. Feature flag

`ai: flag("AI", false)` → `NEXT_PUBLIC_FEATURE_AI`. Gates all three features and all `ai.ts` actions server-side.
Separate from `experimental` (heuristics stay hidden). Also requires `AI_API_KEY` present at runtime. Default off.

## 8. Dependencies

- Vertical 1 (Academy operations): announcements, `SkillReport`/EvaluateModal, attendance, fees, leads, `RateLimit`
  table. S1/S2 add one boolean column each to core tables.
- Vertical 14 (Opportunities) and 9 (Sponsorship) could reuse `draftAnnouncement`-style helpers later (pitch text,
  opportunity descriptions) — not in v1.
- Any analytics vertical: S3 should consume the same aggregate queries the Analytics tab uses, not duplicate them.

## 9. Risks and open questions

- Provider and model choice, data-processing terms, and whether prompts may leave India for data-residency reasons.
- Cost ceiling per academy and whether AI is a paid-plan feature (`Subscription.plan`).
- Rename the existing "AI Insights" tab (e.g. "Insights (rule-based)") before anyone enables `experimental`? Recommended;
  it is a copy-only change but touches existing frontend.
- Coach notes are parent-facing: is a visible "AI-assisted" tag acceptable to academies, or label only for the coach?
  (Founder rule says label it; this plan labels both.)
- Hallucination: summaries must show their source numbers; drafts are never auto-sent.
- Languages: Hindi/Hinglish drafts are likely wanted; v1 follows `Organization.locale` only.

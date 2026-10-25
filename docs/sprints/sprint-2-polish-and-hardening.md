# Sprint 2 — Polish & Hardening (parallel to Sprint 1 user-blocked tasks)

**Branch:** `codex/triq-reliability-and-vertical-roadmap` (continues from Sprint 1)
**Reference plan:** §11 (still in Phase 1 — exit gate not met until Sprint 1 Tasks 7/8 run)
**Why not Phase 2 yet:** Plan §11 forbids starting Phase 2 (Growth) before Phase 1 exit.
Sprint 2 is a continuation of Phase 1: close the long tail of hardening while the founder
unblocks Sprint 1 Tasks 5–8.

## Tasks

| # | Task | Who unblocks | Code effort |
|---|---|---|---|
| 1 | **Component adoption of `useFormatMoney` / `useFormatDate`** — migrate the top 5 high-traffic components off `.toLocaleString("en-IN")` so they format in the org's locale | — (solo) | ~2 hrs |
| 2 | **More Vitest coverage** for pure helpers: `fees.ts` (resolveStudentFee), `phone.ts` (parsePhone), `coach.ts` (parseMedicalInfo, scheduleRunsOn) | — (solo) | ~2 hrs |
| 3 | **Dead-code identification report** — list components the inventory flagged as "UI without data" plus any orphaned server actions. Do NOT delete — produce a review file so founder decides | — (solo) | ~1 hr |
| 4 | **Expand audit log coverage** for sensitive mutations currently missing it: membership changes, permission grants/revokes, bulk delete, Razorpay connect/disconnect | — (solo) | ~2 hrs |
| 5 | **Zod validation** on highest-risk `data: any` server actions (users.ts, medical.ts, payments.ts) | — (solo) | ~2 hrs |

## Out of scope

Explicitly, same as Sprint 1: no new verticals, no Content Studio activation, no marketplace,
no AI assistant.

## Discipline

Every commit on the branch, every task PR-reviewable, every change tested.

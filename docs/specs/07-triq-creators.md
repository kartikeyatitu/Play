# 07 — TRIQ Creators

Status date: 2026-10-26. Branch `build/v-careers-wellness-creators`. Scope: `docs/specs/SCOPE-11-VERTICALS.txt` §Vertical 7. Related prior plan: `docs/roadmap/verticals/07-communities.md` (academy boards; its moderation patterns are reused, its scope is not).
Flag: `creators` (`NEXT_PUBLIC_FEATURE_CREATORS`, default off). No fabricated followers, views, engagement or earnings.

## 1. Purpose and users
Give sports creators (coaches, adult athletes, analysts, content makers) a sports identity: a profile with sports and content categories, a portfolio of links to content they host elsewhere, links to their Triq coach/academy/venue pages, and discovery by organisations looking for collaborators.
Users: creators (signed-in adults), visitors (public), organisations browsing, Triq ops moderators (`SUPER_ADMIN`).

## 2. Roles and permissions
| Actor | Check | Can |
|---|---|---|
| Creator | signed-in owner of `CreatorProfile` | edit profile, add/remove portfolio links, see own view counts |
| Visitor | none | view public, non-hidden profiles and items |
| Reporter | signed-in | report a profile or item once |
| Moderator | `SUPER_ADMIN` | hide/unhide profile or item, dismiss/action reports (audited) |

## 3. Feature inventory
| Scope group | v1 |
|---|---|
| Creator profiles | handle, display name, bio, city, public opt-in |
| Sports and content categories | sports list; categories enum |
| Content portfolios | external links (YouTube, Instagram, X, other) via `safeHttpUrl` |
| Content discovery | `/creators` list with sport/category filter |
| Links to athlete/coach/venue/event profiles | own coach page `/c/[id]` (if COACH/ADMIN), academy/venue `/academy/[slug]` only where the creator has an ACTIVE membership; athlete/event links later (no public athlete/event pages yet) |
| Publishing on Triq | later (links only; no uploads) |
| Engagement analytics | profile view events (`CreatorProfileView`), 7/30-day counts; owner views excluded |
| Audience management | later |
| Sponsorship/collaboration | later (Brand Studio, V9) |
| Reporting and moderation | `ContentReport` + `/ops/reports` |
| Monetization | later release |

## 4. Screens
| Route | Who | Content |
|---|---|---|
| `/creators` | public | discovery list; 404 when flag off |
| `/creators/[handle]` | public | profile, portfolio, linked pages, report form (signed-in) |
| `/creators/me` | signed-in | editor, portfolio management, view analytics |
| `/ops/reports` | SUPER_ADMIN | open reports, hide/dismiss |

## 5. Fields and validation (`src/lib/creators.ts`)
handle 3–30 `[a-z0-9_]`, unique, reserved words blocked (`me`, `admin`, …); displayName 2–80; bio ≤1000; city ≤80; sports ≤10; categories ⊂ `CREATOR_CATEGORIES` (≤5); portfolio item: title 2–120, url = `safeHttpUrl` (http/https only), description ≤300, max 30 items; report: reason ∈ `REPORT_REASONS`, details ≤1000.

## 6. Journeys
1. Creator opens `/creators/me`, picks a handle, categories, sports; links academy (if member) and own coach page; marks public.
2. Adds portfolio links; invalid or `javascript:` URLs rejected.
3. Visitor browses `/creators`, filters by sport, opens a profile (a view event is recorded unless it is the owner).
4. Signed-in user reports an item; ops hides it; it disappears from public pages.
5. Creator sees real view counts for last 7/30 days.

## 7. Business rules
- Public visibility = `isPublic && !hiddenAt` for profile; items also need `!hiddenAt`.
- One report per (reporter, target); report status OPEN → ACTIONED | DISMISSED.
- Hiding is reversible (unhide); deleting by moderators is not offered.
- View counting: one row per page render by non-owner; signed-in viewers de-duplicated per profile per day; no IP stored.
- Portfolio platform derived from URL host only (label, no scraping, no follower counts).

## 8. Database (additive, `prisma/sql/2026-10-26_creators.sql`)
`CreatorProfile`(userId unique, handle unique, linkedOrgId?, linkCoachPage, isPublic, hiddenAt), `CreatorPortfolioItem`(creatorId, url, hiddenAt), `CreatorProfileView`(creatorId, viewerId?, createdAt), `ContentReport`(targetType, targetId, creatorId, reporterId, status, resolvedById). User-owned (no orgId); `linkedOrgId` is a reference only.

## 9. API (`src/app/actions/creators.ts`, `src/app/ops/reports/actions.ts`)
`saveCreatorProfile`, `addPortfolioItem`, `removePortfolioItem`, `reportContent` (signed-in, flag-checked) · `resolveReport`, `setCreatorHidden`, `setPortfolioItemHidden` (SUPER_ADMIN, audited).

## 10. Errors and edge cases
Handle taken → error. Linking an org without active membership → error. Too many items → error. Report on own content or duplicate → error. Hidden profile → 404 publicly, banner for owner.

## 11. Security and privacy
No under-18 data: creators are Users (adults in Triq's model; students are not Users). No email/phone on public pages. External links rendered with `rel="noopener noreferrer nofollow ugc"`. Audit rows: `CREATOR_PROFILE_SAVED`, `CREATOR_ITEM_ADDED/REMOVED`, `CONTENT_REPORTED`, `CONTENT_REPORT_RESOLVED`, `CREATOR_HIDDEN/UNHIDDEN`, `CREATOR_ITEM_HIDDEN/UNHIDDEN`.

## 12. Shared platform dependencies
Identity, memberships (link validation), moderation/reporting (first shared implementation; reusable by Commerce reviews), analytics (actual-event rule), `src/lib/safe-url.ts`.

## 13. Acceptance criteria
- No profile shows a number that is not a count of stored events.
- `javascript:`/`data:` URLs cannot be saved.
- Hidden content is not visible publicly.
- Org link only for active members.

## 14. Tests
`src/lib/__tests__/creators.test.ts`: handle rules, categories, portfolio URL validation via `safeHttpUrl`, platform detection, visibility rule, report validation.

## 15. Implementation status (verified 2026-10-26)
| Feature group | Status | Evidence |
|---|---|---|
| Creator profiles, portfolio, discovery, analytics, reporting | Missing → built (flag `creators`) | `src/app/creators/page.tsx`, `src/app/creators/[handle]/page.tsx`, `src/app/creators/me/page.tsx`, `src/app/actions/creators.ts`, `src/lib/creators.ts` |
| Moderation queue | Missing → built | `src/app/ops/reports/page.tsx`, `src/app/ops/reports/actions.ts` |
| Social post generators | Mocked/experimental (not creator identity) | `src/components/org/InstagramGenerator.tsx`, `SocialPostGenerator.tsx` behind `FEATURES.experimental` |
| Coach highlight videos (per child, private) | Partial, not creator content | `src/app/actions/media.ts` |
| Publishing, audience, sponsorship, monetization | Missing | — |

## 16. Release dependencies and open decisions
- Apply `prisma/sql/2026-10-26_creators.sql` before enabling `creators`.
- Decide age policy if athletes under 18 ever become Users.
- Decide whether creator pages go in the sitemap (v1: no).
- Collaboration requests depend on Brand Studio (V9).

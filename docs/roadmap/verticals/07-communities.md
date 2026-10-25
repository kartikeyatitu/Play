# Vertical 7 — Communities

> Planning doc. Read-only audit of branch `feat/academy-os-branches` on 2026-10-25. Nothing here is built yet.
> "Verified" means the file was opened and the behaviour seen in code. It does not mean it was tested in production.

## 1. Goal

Give every academy a private, moderated space where coaches and families talk about **their batch**. Coaches post updates. Parents can reply, react and see what is coming up. Staff can see who has read a post. Everything stays inside one academy (`orgId`). A parent's phone number and child are never shown to other parents. The first version builds on the announcement feed that already works. It is not a social network.

## 2. Verified today

| Capability | Evidence | Status |
|---|---|---|
| Academy-wide announcements | `Announcement` model (`prisma/schema.prisma`, has `batchId`, `kind`). `broadcastAnnouncement` in `src/app/actions/announcements.ts` (gated by `settings.manage`). `src/components/org/BroadcastTab.tsx` on the admin "Messages" tab | working. No audit log, no read tracking |
| Batch broadcasts by coach | `broadcastToBatch`, `cancelTodaySession`, `saveSessionRecap` in `src/app/actions/coach-session.ts` (coach must own the batch, via `ownedBatch`). `src/components/coach/BatchBroadcast.tsx` | working. No audit log |
| Parent announcement feed | `src/app/parent/page.tsx` loads the 8 latest announcements where `batchId` is null or one of the child's batches. Rendered in `ParentClient.tsx` | working, read-only (no replies or reactions) |
| Parent ↔ academy direct messages | `Message` model (durable, indexed). `sendMessage` in `src/app/actions/chat.ts` (parents can only message ADMIN/COACH in their org). `src/components/chat/ChatWindow.tsx`, `src/components/org/InboxTab.tsx` | working. No realtime (relies on `revalidatePath`), no read state. `docs/audits/feature-inventory.md` says chat is not durable; that is out of date |
| Notifications | `getUnreadCount` / `getRecentNotifications` in `src/app/actions/notifications.ts` count messages from the last 24 h | partial. The count is based on time, not on unread state |
| WhatsApp outreach | `src/components/org/BulkWhatsApp.tsx` builds `wa.me` links that someone taps one by one. `sendWhatsAppTemplate` in `src/lib/whatsapp.ts`. `src/app/api/webhooks/whatsapp/route.ts` only records delivery status | partial |
| Events + RSVP | `Event`, `RSVP` models. `createEvent` / `updateRSVP` in `src/app/actions/events.ts` (coach must own the batch). `src/components/parent/RSVPButtons.tsx`. `CreateMatchModal` from `src/components/coach/MatchManager.tsx` used in `src/app/coach/page.tsx` | working. Not audited in depth |
| Coach highlight videos | `Media` model, `addHighlightReel` in `src/app/actions/media.ts`, `src/components/parent/MediaFeed.tsx` | working (per child) |
| Photo gallery | `GalleryPhoto`, `addPhoto` / `getPhotos` in `src/app/actions/gallery.ts`, `PhotoGallery` on the admin "Gallery" tab | working for staff. **The parent app does not load it** (no `galleryPhoto` query in `src/app/parent/page.tsx`) |
| Leaderboard | `GamificationWidget.tsx` shows the top 3 by `Student.points` to parents | working. Note: other children's names are shown to parents |
| Parent feedback | `Feedback`, `submitFeedback` in `src/app/actions/feedback.ts`, `FeedbackWidget.tsx` | working (private to the academy) |
| Carpool | `src/components/parent/CarpoolMatcher.tsx`. Not rendered anywhere (grep finds no usage). Builds `wa.me/91{parent.phone}` links | UI-only. **Unsafe to ship**: it would show parents' phone numbers to other parents |
| Replies, comments, reactions, groups, moderation, read receipts | none found | missing |

## 3. Gaps for a real v1

1. Families cannot respond to a post. Every reply has to go through a 1:1 DM to the admin.
2. `Message` cannot hold a group thread: `receiverId` is required and it has no link to a post.
3. There is no moderation (hide or remove), and none of the community writes produce an audit trail. `broadcastAnnouncement` and `broadcastToBatch` write no `auditLog`.
4. There is no read tracking. The owner cannot tell whether a cancellation notice reached families.
5. Posting academy-wide requires `settings.manage`, which is an owner-level permission. There is no permission that matches "community".
6. The parent page only fetches the thread with the single `admin` user. Coach DMs are not shown to parents.

## 4. v1 scope

**In**
- Batch board: the existing `Announcement` rows, shown as a feed for each batch and for the whole academy.
- Parent comments on a post, only where the author enabled them (`allowComments`). Plain text, at most 1000 characters.
- Moderation: the post author, the batch coach, or an admin with `community.moderate` can hide a comment.
- Read receipts: "Seen by 18 / 24 families" for staff, and an unread dot for parents.
- Audit events for posting, commenting and moderating.

**Out (explicitly)**
- Parent-to-parent DMs, carpool, and parent directories. `CarpoolMatcher` stays unrendered.
- Parents creating new posts. Photo or video uploads by parents.
- Public or cross-academy communities, follower graphs, likes counters.
- Realtime sockets and push notifications. Refreshing on navigation is enough for v1.
- Reactions (emoji). Deferred to v1.1.

## 5. Data model

Reuse `Announcement` as the post. We need two new tables because a post can have many repliers and many readers, and neither `Message` (1:1) nor `Announcement` can hold either relation.

```prisma
model Announcement {
  // ...existing fields unchanged...
  allowComments Boolean @default(false) // V7: author opts in per post
  comments      AnnouncementComment[]
  reads         AnnouncementRead[]
}

/// V7: a reply under an announcement. Always scoped to the announcement's org.
model AnnouncementComment {
  id             String    @id @default(cuid())
  orgId          String
  announcementId String
  authorId       String    // User (parent or staff)
  studentId      String?   // which child the parent is replying about (for batch scoping)
  body           String
  hiddenAt       DateTime?
  hiddenById     String?
  createdAt      DateTime  @default(now())
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  @@index([announcementId, createdAt])
  @@index([orgId, createdAt])
}

/// V7: one row per user per announcement, first time they open it.
model AnnouncementRead {
  id             String   @id @default(cuid())
  orgId          String
  announcementId String
  userId         String
  readAt         DateTime @default(now())
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  @@unique([announcementId, userId])
  @@index([orgId])
}
```

`prisma/sql/YYYY-MM-DD_v7_communities.sql` (additive. NOT applied until the founder approves):

```sql
-- Additive only. NOT APPLIED to production. Requires founder approval before running.
-- Must be applied BEFORE deploying code that reads Announcement.allowComments.
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "allowComments" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AnnouncementComment" (
  "id"             TEXT PRIMARY KEY,
  "orgId"          TEXT NOT NULL,
  "announcementId" TEXT NOT NULL REFERENCES "Announcement"("id") ON DELETE CASCADE,
  "authorId"       TEXT NOT NULL,
  "studentId"      TEXT,
  "body"           TEXT NOT NULL,
  "hiddenAt"       TIMESTAMP(3),
  "hiddenById"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AnnouncementComment_announcementId_createdAt_idx" ON "AnnouncementComment"("announcementId","createdAt");
CREATE INDEX IF NOT EXISTS "AnnouncementComment_orgId_createdAt_idx" ON "AnnouncementComment"("orgId","createdAt");
ALTER TABLE "AnnouncementComment" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
  "id"             TEXT PRIMARY KEY,
  "orgId"          TEXT NOT NULL,
  "announcementId" TEXT NOT NULL REFERENCES "Announcement"("id") ON DELETE CASCADE,
  "userId"         TEXT NOT NULL,
  "readAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId","userId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_orgId_idx" ON "AnnouncementRead"("orgId");
ALTER TABLE "AnnouncementRead" ENABLE ROW LEVEL SECURITY;
```

Also add both tables to the academy-deletion order in `src/app/actions/delete.ts`, before `announcement`.

## 6. Build slices

**Slice 1: Flag, permission, pure rules, audit on existing posts**
- Objective: lay the foundation without any visible change while the flag is off.
- Files: `src/lib/features.ts` (add `communities`). `src/lib/team.ts` (add `"community.moderate"`. OWNER and MANAGER get it by default through `ALL_PERMISSIONS`). New `src/lib/community.ts` with pure helpers: `sanitizeCommentBody`, `canParentSeeAnnouncement(batchIds, a)`, `canModerate({role, coachOwnsBatch, perms})`. `src/app/actions/announcements.ts` and `coach-session.ts` gain `auditLog.create`.
- Permission/tenancy: unchanged behaviour. Audit rows always carry `session.orgId`.
- Audit: `ANNOUNCEMENT_POSTED` `{announcementId, batchId, kind}`.
- Tests: `src/lib/__tests__/community.test.ts` covering visibility (null batch vs a foreign batch), body trimming and length, and the moderation matrix.
- Acceptance: `npm test` passes. With the flag off, the UI is byte-for-byte the same apart from the extra audit rows.

**Slice 2: Schema + read receipts**
- Objective: staff see "Seen by X / Y families". Parents get an unread dot.
- Files: `prisma/schema.prisma`, the SQL file above, new `src/app/actions/community.ts` (`markAnnouncementsRead(ids)`, `getReadStats(announcementId)`), `ParentClient.tsx` and `BatchBroadcast.tsx` (render only when `FEATURES.communities` is on).
- Tenancy: `markAnnouncementsRead` looks the announcement up with `{id, orgId: session.orgId, OR: [{batchId: null}, {batchId: {in: childBatchIds}}]}` and silently ignores any it cannot see. Read stats require the owning coach (same rule as `ownedBatch`) or `reports.view`.
- Audit: none. Reads are high-volume and not sensitive.
- Tests: the denominator for the "families in batch" count lives as a pure helper in `src/lib/community.ts`.
- Acceptance: a parent of batch A cannot create a read row for a batch B post (verified by an e2e or manual script). Upserts are idempotent.

**Slice 3: Parent comments**
- Objective: parents reply under posts where `allowComments` is true.
- Files: `community.ts` (`addComment`, `listComments`). `BroadcastTab.tsx` and `BatchBroadcast.tsx` get an "Allow replies" toggle. A parent comment thread component in `src/components/parent/`.
- Permission/tenancy: `requireAuth(['PARENT','COACH','ADMIN'])`. Parents must have a child (`parentId = session.id`) enrolled in the post's batch, or the post must be academy-wide in the same org. `orgId` comes from the announcement and is never taken from the client. Rate limit with the existing `src/lib/rate-limit.ts`. Comments show the author's first name and role only, never a phone number.
- Audit: `COMMUNITY_COMMENT_CREATED` `{commentId, announcementId}`.
- Tests: helper tests for audience checks. One e2e case in `/e2e`: a parent from another batch gets "not found".
- Acceptance: with the flag off, the actions return an error and nothing renders.

**Slice 4: Moderation**
- Objective: hide or unhide comments and close replies.
- Files: `community.ts` (`hideComment`, `setAllowComments`), plus moderation UI in the admin Messages tab and the coach batch view.
- Permission: ADMIN-app users need `checkPermission("community.moderate")`. Coaches need to own the batch (`ownedBatch` pattern from `coach-session.ts`). `checkPermission` only accepts the ADMIN app role, so coaches need this separate path.
- Audit: `COMMUNITY_COMMENT_HIDDEN`, `COMMUNITY_COMMENT_UNHIDDEN`, `COMMUNITY_REPLIES_CLOSED`.
- Acceptance: hidden comments disappear for parents and show greyed out for staff.

## 7. Feature flag

`FEATURES.communities = flag("COMMUNITIES", false)`, i.e. `NEXT_PUBLIC_FEATURE_COMMUNITIES`. It gates read receipts, the reply UI and the comment and moderation actions. Every server action re-checks the flag. Existing announcements, DMs and RSVP keep working regardless of the flag.

## 8. Dependencies

- **Vertical 1 (Academy operations):** batches, enrolments and `OrgMembership`. Posts are scoped by `Batch.coachId` and `BatchEnrollment`. Branches (`Batch.branchId`, this branch) could later allow a "branch board". Not in v1.
- **Vertical 12 (Wellness):** must never post medical content into the community feed. Wellness check-ins stay private.
- **Vertical 15 (Inclusive):** girls-only or para-sport batches are just batches, so the board works for them with no extra work.
- **Vertical 11 (Marketplace):** none in v1. "Kit available" posts are plain announcements.
- Academy deletion (`src/app/actions/delete.ts`) must include the new tables.

## 9. Risks and open questions for the founder

1. **Child safeguarding.** Should coaches be able to reply to a parent comment? Should comments be visible to every family in the batch, or only to staff (feedback mode)? Recommendation: visible to the batch, with author-only opt-in per post.
2. **Leaderboard privacy.** `GamificationWidget` already shows other children's names to parents. Should this be opt-in per academy?
3. **Carpool.** Do you want carpool at all? Shipping it would mean sharing phone numbers between families. It needs explicit consent, so it is out of scope for v1.
4. **Posting permission.** Academy-wide posts currently need `settings.manage`. Should `community.moderate` also allow managers and staff to post academy-wide?
5. **Notifications.** v1 does not push. Is WhatsApp template delivery (`sendWhatsAppTemplate`) for new posts wanted, given Meta costs per message?
6. **RLS.** I could not verify from the repo whether RLS is enabled on `Announcement`; it does not appear in `prisma/sql/2026-10-14_enable_rls_on_exposed_tables.sql`. `docs/sprints/task-8-rls-verification.md` notes that RLS may be bypassed by the `postgres` role. Tenant isolation must therefore stay enforced in the actions.

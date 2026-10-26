// V7 Communities — pure rules for announcement boards, replies and moderation.
// Client-safe: no DB or server-only imports (tested in src/lib/__tests__/community.test.ts).

/** Longest reply a parent or staff member can post under an announcement. */
export const COMMENT_MAX_LENGTH = 1000;

/** Audit actions written by community writes. */
export const COMMUNITY_AUDIT = {
  POSTED: "ANNOUNCEMENT_POSTED",
  COMMENT_CREATED: "COMMUNITY_COMMENT_CREATED",
  COMMENT_HIDDEN: "COMMUNITY_COMMENT_HIDDEN",
  COMMENT_UNHIDDEN: "COMMUNITY_COMMENT_UNHIDDEN",
  REPLIES_CLOSED: "COMMUNITY_REPLIES_CLOSED",
  REPLIES_OPENED: "COMMUNITY_REPLIES_OPENED",
} as const;

export type SanitizeResult = { ok: true; body: string } | { ok: false; error: string };

/**
 * Normalise a reply body: strip control characters (keeping newlines and tabs), trim, collapse runs of
 * 3+ blank lines, and enforce 1..COMMENT_MAX_LENGTH characters.
 */
export function sanitizeCommentBody(raw: unknown): SanitizeResult {
  if (typeof raw !== "string") return { ok: false, error: "Reply is empty." };
  const cleaned = raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return { ok: false, error: "Reply is empty." };
  if (cleaned.length > COMMENT_MAX_LENGTH) {
    return { ok: false, error: `Replies can be at most ${COMMENT_MAX_LENGTH} characters.` };
  }
  return { ok: true, body: cleaned };
}

/**
 * A parent may see an announcement when it is academy-wide (no batch) or targets one of the batches
 * their children are enrolled in. Org scoping is done by the caller's query.
 */
export function canParentSeeAnnouncement(childBatchIds: readonly string[], a: { batchId: string | null | undefined }): boolean {
  if (!a.batchId) return true;
  return childBatchIds.includes(a.batchId);
}

export type ModerationActor = {
  /** App role from the session: ADMIN | COACH | STAFF | PARENT. */
  role: string;
  /** True when the actor wrote the announcement. */
  isAuthor?: boolean;
  /** True when the actor is the coach of the announcement's batch. */
  coachOwnsBatch?: boolean;
  /** True when the actor's membership grants community.moderate. */
  hasModeratePermission?: boolean;
};

/**
 * Who may hide comments or close replies:
 *  - never a parent;
 *  - the post's author (staff only);
 *  - the coach who owns the post's batch;
 *  - an ADMIN-app member holding community.moderate.
 */
export function canModerate(actor: ModerationActor): boolean {
  if (actor.role === "PARENT") return false;
  if (actor.isAuthor) return true;
  if (actor.role === "COACH" && actor.coachOwnsBatch) return true;
  if (actor.role === "ADMIN" && actor.hasModeratePermission) return true;
  return false;
}

/**
 * Number of distinct families (parents) behind a list of enrolled students — the "Y" in "Seen by X / Y".
 * Students without a parent id are ignored.
 */
export function familiesCount(students: ReadonlyArray<{ parentId?: string | null }>): number {
  const ids = new Set<string>();
  for (const s of students) if (s.parentId) ids.add(s.parentId);
  return ids.size;
}

/** Readers who belong to the audience: only parents in the audience count towards "Seen by". */
export function seenByFamilies(readerIds: readonly string[], audienceParentIds: readonly string[]): number {
  const audience = new Set(audienceParentIds);
  const seen = new Set<string>();
  for (const id of readerIds) if (audience.has(id)) seen.add(id);
  return seen.size;
}

/** "Seen by 18 / 24 families" (or "Seen by 1 / 1 family"). */
export function seenByLabel(seen: number, total: number): string {
  return `Seen by ${seen} / ${total} ${total === 1 ? "family" : "families"}`;
}

/** Public display name for a reply author: first name and role only, never a phone number or surname. */
export function commentAuthorLabel(name: string | null | undefined, role: string | null | undefined): string {
  const first = (name || "").trim().split(/\s+/)[0] || "Member";
  // Never leak a phone-number-shaped "name" (some parents are created with their number as name).
  const safeFirst = /\d{5,}/.test(first) ? "Parent" : first;
  const roleLabel = role === "ADMIN" ? "Academy" : role === "COACH" ? "Coach" : role === "STAFF" ? "Staff" : "Parent";
  return safeFirst === "Parent" && roleLabel === "Parent" ? "Parent" : `${safeFirst} · ${roleLabel}`;
}

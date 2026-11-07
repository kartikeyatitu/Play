/**
 * Who may see a piece of media. Pure: every input is passed in, nothing is fetched here.
 *
 * Rules (docs/TRIQ_DATA_PRIVACY.md, media scopes):
 * 1. Deleted media is visible to nobody.
 * 2. Academy staff (an active membership in the media's academy) always see it.
 * 3. Everyone else sees READY media only, and only media with at least one tagged child.
 *    Untagged media may still show children nobody has consented for, so it stays staff-only.
 * 4. A guardian sees it when, for every tagged child, either the child is their own, or the child
 *    has an active `parents_of_batch` consent AND shares a batch with one of the guardian's children.
 * 5. Anyone (including signed-out visitors) sees it when every tagged child has an active
 *    `academy_public` consent, or `tournament_public` for TOURNAMENT/MATCH media.
 *
 * Consent is active when it belongs to the media's academy and has not been withdrawn. Withdrawal
 * takes effect on the next check: nothing is cached.
 */
import type { MediaContextType, MediaScope } from "./constants";

export interface MediaViewer {
  /** null for a signed-out visitor. */
  userId: string | null;
  /** Academies where the viewer has an ACTIVE membership (owner, manager, coach or staff). */
  staffOrgIds: readonly string[];
  /** Students the viewer is guardian of. */
  guardianOfStudentIds: readonly string[];
  /** Batches the viewer's children are enrolled in. */
  childBatchIds: readonly string[];
}

export interface MediaForView {
  orgId: string;
  contextType: MediaContextType | string;
  status: string;
  deletedAt?: Date | null;
}

export interface SubjectForView {
  studentId: string;
  /** Batches this tagged child is enrolled in (within the media's academy). */
  batchIds: readonly string[];
}

export interface ConsentForView {
  orgId: string;
  studentId: string;
  scope: MediaScope | string;
  withdrawnAt?: Date | null;
}

export type ViewDecision =
  | { allowed: true; reason: "STAFF" | "GUARDIAN" | "PUBLIC" }
  | { allowed: false; reason: "DELETED" | "NOT_READY" | "UNTAGGED" | "NO_CONSENT" };

export const ANONYMOUS_VIEWER: MediaViewer = {
  userId: null,
  staffOrgIds: [],
  guardianOfStudentIds: [],
  childBatchIds: [],
};

const PUBLIC_TOURNAMENT_CONTEXTS = new Set(["TOURNAMENT", "MATCH"]);

/** Active scopes per student for one academy. */
export function activeScopesByStudent(consents: readonly ConsentForView[], orgId: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const c of consents) {
    if (c.orgId !== orgId) continue;
    if (c.withdrawnAt) continue;
    let set = out.get(c.studentId);
    if (!set) out.set(c.studentId, (set = new Set()));
    set.add(c.scope);
  }
  return out;
}

export function isPubliclyViewable(
  media: MediaForView,
  subjects: readonly SubjectForView[],
  consents: readonly ConsentForView[],
): boolean {
  if (media.deletedAt || media.status !== "READY" || subjects.length === 0) return false;
  const scopes = activeScopesByStudent(consents, media.orgId);
  const tournamentOk = PUBLIC_TOURNAMENT_CONTEXTS.has(media.contextType);
  return subjects.every((s) => {
    const set = scopes.get(s.studentId);
    if (!set) return false;
    return set.has("academy_public") || (tournamentOk && set.has("tournament_public"));
  });
}

export function explainView(
  viewer: MediaViewer,
  media: MediaForView,
  subjects: readonly SubjectForView[],
  consents: readonly ConsentForView[],
): ViewDecision {
  if (media.deletedAt || media.status === "DELETED") return { allowed: false, reason: "DELETED" };
  if (viewer.userId && viewer.staffOrgIds.includes(media.orgId)) return { allowed: true, reason: "STAFF" };
  if (media.status !== "READY") return { allowed: false, reason: "NOT_READY" };
  if (subjects.length === 0) return { allowed: false, reason: "UNTAGGED" };

  if (isPubliclyViewable(media, subjects, consents)) return { allowed: true, reason: "PUBLIC" };

  if (viewer.userId) {
    const scopes = activeScopesByStudent(consents, media.orgId);
    const own = new Set(viewer.guardianOfStudentIds);
    const myBatches = new Set(viewer.childBatchIds);
    const guardianOk = subjects.every((s) => {
      if (own.has(s.studentId)) return true;
      if (!scopes.get(s.studentId)?.has("parents_of_batch")) return false;
      return s.batchIds.some((b) => myBatches.has(b));
    });
    if (guardianOk) return { allowed: true, reason: "GUARDIAN" };
  }
  return { allowed: false, reason: "NO_CONSENT" };
}

export function canView(
  viewer: MediaViewer,
  media: MediaForView,
  subjects: readonly SubjectForView[],
  consents: readonly ConsentForView[],
): boolean {
  return explainView(viewer, media, subjects, consents).allowed;
}

/** Who may upload and tag: owners, managers and coaches of the academy. Parents and other staff cannot in v1. */
export function canUploadMedia(membership: { role: string; status?: string | null } | null | undefined): boolean {
  if (!membership || (membership.status && membership.status !== "ACTIVE")) return false;
  return membership.role === "OWNER" || membership.role === "MANAGER" || membership.role === "COACH";
}

/** Owners and managers may delete any media in their academy; coaches only their own uploads. */
export function canDeleteMedia(
  membership: { role: string; status?: string | null } | null | undefined,
  userId: string,
  media: { uploaderId: string },
): boolean {
  if (!canUploadMedia(membership)) return false;
  if (membership!.role === "COACH") return media.uploaderId === userId;
  return true;
}

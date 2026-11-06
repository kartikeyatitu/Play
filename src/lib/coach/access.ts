// Coach OS access rules. Pure and client-safe: no DB access.
//
// Permissions matrix (docs/TRIQ_DATA_PRIVACY.md): coaches see training, attendance and physical
// assessments for "assigned athletes", meaning students in batches they coach. Other team members need
// students.manage. Coaches stay limited to their own batches even if granted extra permissions, matching
// canMarkBatchAttendance in src/lib/team.ts.

import { membershipAllows } from "@/lib/team";

type Membership = { role: string; staffRole?: string | null; permissions?: string | null; status?: string | null };

/** True when this member may see or write assessments for a student. */
export function canAssessStudent(membership: Membership, isCoachOfStudent: boolean): boolean {
  if (membership.status && membership.status !== "ACTIVE") return false;
  if (isCoachOfStudent) return true;
  if (membership.role === "COACH") return false;
  return membershipAllows(membership, "students.manage");
}

/** True when the member may switch Coach OS views to every batch in the academy. */
export function canViewAllBatches(membership: Membership): boolean {
  if (membership.role === "COACH") return false;
  return membershipAllows(membership, "students.manage");
}

export type BatchScope = "mine" | "all";

/** The scope actually used: "all" only when asked for and allowed. */
export function resolveScope(requested: string | null | undefined, membership: Membership): BatchScope {
  return requested === "all" && canViewAllBatches(membership) ? "all" : "mine";
}

/** Prisma Batch `where` for a scope. */
export function batchWhereFor(scope: BatchScope, userId: string, orgId: string) {
  return scope === "all" ? { orgId } : { orgId, coachId: userId };
}

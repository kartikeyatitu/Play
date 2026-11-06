// Athlete Passport access policy. Pure and unit-tested: the caller loads the facts, this decides.
//
// Allowed:
//   - the athlete's parent (Student.parentId), for their own children only;
//   - a coach of a batch the athlete is enrolled in, in the athlete's academy;
//   - other active staff of the athlete's academy holding one of PASSPORT_STAFF_PERMISSIONS.
// Everyone else is refused with "not_found" (never "forbidden"), so a passport id can't be probed and an
// outsider never learns that a child exists or what they are called.

import { membershipAllows, type Permission } from "@/lib/team";

/** Staff permissions that open an academy athlete's passport (owners hold every permission). */
export const PASSPORT_STAFF_PERMISSIONS: readonly Permission[] = ["students.manage", "reports.view"];

export type PassportRelation = "PARENT" | "COACH" | "STAFF";

export type PassportAccessFacts = {
  /** The signed-in user's id, or null when signed out. */
  viewerId: string | null;
  /** The athlete, or null when no such student exists. */
  student: { id: string; orgId: string | null; parentId: string } | null;
  /** The viewer's membership in the athlete's academy (not their active one), or null. */
  membership: { role: string; staffRole?: string | null; permissions?: string | null; status?: string | null } | null;
  /** The viewer coaches a batch of the athlete's academy that the athlete is enrolled in. */
  coachesStudent: boolean;
};

export type PassportDecision = { ok: true; relation: PassportRelation } | { ok: false; status: "not_found" };

const NOT_FOUND: PassportDecision = { ok: false, status: "not_found" };

export function decidePassportAccess(f: PassportAccessFacts): PassportDecision {
  if (!f.viewerId || !f.student) return NOT_FOUND;
  if (f.student.parentId === f.viewerId) return { ok: true, relation: "PARENT" };

  // Everything below is academy staff, which needs an academy and an active membership in it.
  const m = f.membership;
  if (!f.student.orgId || !m || (m.status && m.status !== "ACTIVE")) return NOT_FOUND;

  if (m.role === "COACH") return f.coachesStudent ? { ok: true, relation: "COACH" } : NOT_FOUND;
  if (PASSPORT_STAFF_PERMISSIONS.some((p) => membershipAllows(m, p))) return { ok: true, relation: "STAFF" };
  // A manager or staff member without the permission may still see athletes in batches they coach.
  if (f.coachesStudent) return { ok: true, relation: "COACH" };
  return NOT_FOUND;
}

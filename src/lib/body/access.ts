/**
 * TRIQ Body: who may see or change what. Server-only helpers (they read the database).
 *
 * - Parents: only their own children (Student.parentId), read-only.
 * - Coaches: only athletes enrolled in their own batches, and only plans for their own batches
 *   (or plans they wrote without a batch).
 * - Owners, managers and staff: by permission (students.manage to record tests, students.manage or
 *   reports.view to view, batches.manage for every session plan in the academy).
 *
 * Nothing here touches FitnessResult, Drill, SessionPlan or SessionPlanItem.
 */
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getMembership, hasPermission } from "@/lib/membership";
import { coachStudentFilter } from "@/lib/athlete-access";

export type BodyViewer = {
  userId: string;
  name: string;
  orgId: string | null;
  appRole: string;
  membership: Awaited<ReturnType<typeof getMembership>>;
};

export async function getBodyViewer(): Promise<BodyViewer> {
  const session = await requireAuth(["ADMIN", "COACH", "STAFF", "PARENT"]);
  const orgId = (session.orgId as string | null) ?? null;
  const membership = orgId && session.role !== "PARENT" ? await getMembership(session.id, orgId) : null;
  return { userId: session.id, name: session.name ?? "", orgId, appRole: session.role, membership };
}

export function isParent(v: BodyViewer) {
  return v.appRole === "PARENT";
}

export function isCoachMember(v: BodyViewer) {
  return v.membership?.role === "COACH";
}

/** Academy team member (any role) with an active membership. */
export function isTeam(v: BodyViewer) {
  return Boolean(v.orgId && v.membership && !isParent(v));
}

export type StudentAccess = { canView: boolean; canRecord: boolean; seeCohort: boolean };

const NONE: StudentAccess = { canView: false, canRecord: false, seeCohort: false };

/** What this viewer may do for one athlete. */
export async function studentAccess(v: BodyViewer, studentId: string): Promise<StudentAccess> {
  if (!v.orgId || typeof studentId !== "string" || !studentId) return NONE;
  if (isParent(v)) {
    const s = await db.student.findFirst({ where: { id: studentId, parentId: v.userId, orgId: v.orgId }, select: { id: true } });
    return s ? { canView: true, canRecord: false, seeCohort: false } : NONE;
  }
  if (!v.membership) return NONE;
  if (isCoachMember(v)) {
    const s = await db.student.findFirst({ where: { id: studentId, ...coachStudentFilter(v.userId, v.orgId) }, select: { id: true } });
    return s ? { canView: true, canRecord: true, seeCohort: true } : NONE;
  }
  const s = await db.student.findFirst({ where: { id: studentId, orgId: v.orgId }, select: { id: true } });
  if (!s) return NONE;
  const manage = hasPermission(v.membership, "students.manage");
  const view = manage || hasPermission(v.membership, "reports.view");
  return { canView: view, canRecord: manage, seeCohort: view };
}

/** Prisma `where` for the athletes this viewer may see, or null for none. */
export function visibleStudentsWhere(v: BodyViewer) {
  if (!v.orgId) return null;
  if (isParent(v)) return { parentId: v.userId, orgId: v.orgId };
  if (!v.membership) return null;
  if (isCoachMember(v)) return coachStudentFilter(v.userId, v.orgId);
  if (hasPermission(v.membership, "students.manage") || hasPermission(v.membership, "reports.view")) return { orgId: v.orgId };
  return null;
}

/** True when the viewer may plan for (and see plans of) every batch in the academy. */
export function canManageAllPlans(v: BodyViewer) {
  return Boolean(v.membership && !isCoachMember(v) && hasPermission(v.membership, "batches.manage"));
}

/** Batches this viewer may attach a session plan to. */
export async function plannableBatches(v: BodyViewer) {
  if (!v.orgId || !isTeam(v)) return [];
  if (isCoachMember(v)) {
    return db.batch.findMany({ where: { orgId: v.orgId, coachId: v.userId }, select: { id: true, name: true, sport: true }, orderBy: { name: "asc" } });
  }
  if (!canManageAllPlans(v)) return [];
  return db.batch.findMany({ where: { orgId: v.orgId }, select: { id: true, name: true, sport: true }, orderBy: { name: "asc" } });
}

/** May this viewer read or change a plan with this batch and author? */
export function canUsePlan(
  v: BodyViewer,
  plan: { orgId: string; batchId: string | null; createdById: string },
  batchCoachId: string | null,
): boolean {
  if (!v.orgId || plan.orgId !== v.orgId || !isTeam(v)) return false;
  if (canManageAllPlans(v)) return true;
  if (isCoachMember(v)) return plan.batchId ? batchCoachId === v.userId : plan.createdById === v.userId;
  return false;
}

/** Team members who may write session plans at all (coaches for their own batches, or batches.manage). */
export function canPlan(v: BodyViewer) {
  return isTeam(v) && (isCoachMember(v) || canManageAllPlans(v));
}

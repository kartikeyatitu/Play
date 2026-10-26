"use server";

// V2 TRIQ Athlete: achievements with explicit verification status, and coach-set development goals.
// Every action is gated by FEATURES.athleteOS (off by default) and scoped to the caller's academy.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { getMembership, hasPermission } from "@/lib/membership";
import { coachStudentFilter } from "@/lib/athlete-access";
import { orgToday } from "@/lib/i18n";
import { isMissingTableError, SCHEMA_PENDING_MESSAGE } from "@/lib/schema-pending";
import {
  canEditAchievement,
  isGoalStatus,
  nextAchievementStatus,
  parseAchievementInput,
  parseGoalInput,
  statusAfterEdit,
  type AthleteActor,
  type ReviewAction,
} from "@/lib/athlete";

type Fail = { success: false; error: string };
const NOT_ENABLED: Fail = { success: false, error: "Not enabled" };

interface Ctx {
  userId: string;
  orgId: string;
  actor: AthleteActor;
  /** ADMIN with students.manage — may verify / reject and delete verified entries. */
  canVerify: boolean;
  today: Date;
}

/** Resolve who the caller is relative to this athlete, or null when they may not see the athlete. */
async function athleteContext(studentId: string): Promise<Ctx | null> {
  const session = await requireAuth(["ADMIN", "COACH", "PARENT"]);
  if (!session.orgId || typeof studentId !== "string" || !studentId) return null;
  const orgId = session.orgId as string;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  const today = new Date(`${orgToday(org)}T00:00:00.000Z`);

  if (session.role === "PARENT") {
    const s = await db.student.findFirst({ where: { id: studentId, parentId: session.id, orgId }, select: { id: true } });
    return s ? { userId: session.id, orgId, actor: "PARENT", canVerify: false, today } : null;
  }
  const membership = await getMembership(session.id, orgId);
  if (!membership) return null;
  if (session.role === "COACH") {
    const s = await db.student.findFirst({ where: { id: studentId, ...coachStudentFilter(session.id, orgId) }, select: { id: true } });
    return s ? { userId: session.id, orgId, actor: "COACH", canVerify: false, today } : null;
  }
  const s = await db.student.findFirst({ where: { id: studentId, orgId }, select: { id: true } });
  if (!s) return null;
  return { userId: session.id, orgId, actor: "ADMIN", canVerify: hasPermission(membership, "students.manage"), today };
}

async function audit(ctx: Ctx, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId: ctx.userId, orgId: ctx.orgId, action, details: JSON.stringify(details) } });
}

function failFrom(e: unknown): Fail {
  if (isMissingTableError(e)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
  throw e;
}

function refresh(studentId: string) {
  revalidatePath(`/student/${studentId}`);
}

/** Achievements and goals for one athlete, plus what the caller may do. */
export async function listAthleteRecords(studentId: string) {
  if (!FEATURES.athleteOS) return NOT_ENABLED;
  const ctx = await athleteContext(studentId);
  if (!ctx) return { success: false as const, error: "Athlete not found" };
  try {
    const [achievements, goals] = await Promise.all([
      db.athleteAchievement.findMany({ where: { orgId: ctx.orgId, studentId }, orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }] }),
      db.athleteGoal.findMany({ where: { orgId: ctx.orgId, studentId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    ]);
    return {
      success: true as const,
      userId: ctx.userId,
      actor: ctx.actor,
      canVerify: ctx.canVerify,
      canReview: ctx.actor !== "PARENT",
      canSetGoals: ctx.actor !== "PARENT",
      achievements: achievements.map((a) => ({ ...a, canEdit: canEditAchievement(a, ctx.actor === "ADMIN" && !ctx.canVerify ? "COACH" : ctx.actor, ctx.userId) })),
      goals,
    };
  } catch (e) {
    return failFrom(e);
  }
}

export async function submitAchievement(studentId: string, raw: Record<string, unknown>) {
  if (!FEATURES.athleteOS) return NOT_ENABLED;
  const ctx = await athleteContext(studentId);
  if (!ctx) return { success: false, error: "Athlete not found" };
  const parsed = parseAchievementInput(raw ?? {}, ctx.today);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const row = await db.athleteAchievement.create({
      data: { ...parsed.value, orgId: ctx.orgId, studentId, status: "SUBMITTED", submittedById: ctx.userId, submittedByRole: ctx.actor },
    });
    await audit(ctx, "ACHIEVEMENT_SUBMITTED", { achievementId: row.id, studentId, by: ctx.actor });
    refresh(studentId);
    return { success: true, id: row.id };
  } catch (e) {
    return failFrom(e);
  }
}

export async function updateAchievement(achievementId: string, raw: Record<string, unknown>) {
  if (!FEATURES.athleteOS) return NOT_ENABLED;
  try {
    const existing = await findAchievement(achievementId);
    if (!existing) return { success: false, error: "Achievement not found" };
    const ctx = await athleteContext(existing.studentId);
    if (!ctx || ctx.orgId !== existing.orgId) return { success: false, error: "Achievement not found" };
    const editor: AthleteActor = ctx.actor === "ADMIN" && !ctx.canVerify ? "COACH" : ctx.actor;
    if (!canEditAchievement(existing, editor, ctx.userId)) return { success: false, error: "You can't edit this entry." };
    const parsed = parseAchievementInput(raw ?? {}, ctx.today);
    if (!parsed.ok) return { success: false, error: parsed.error };
    await db.athleteAchievement.update({
      where: { id: existing.id },
      data: {
        ...parsed.value,
        status: statusAfterEdit(),
        reviewedById: null, reviewedAt: null, verifiedById: null, verifiedAt: null, rejectionReason: null,
      },
    });
    await audit(ctx, "ACHIEVEMENT_UPDATED", { achievementId: existing.id, studentId: existing.studentId, previousStatus: existing.status });
    refresh(existing.studentId);
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

export async function deleteAchievement(achievementId: string) {
  if (!FEATURES.athleteOS) return NOT_ENABLED;
  try {
    const existing = await findAchievement(achievementId);
    if (!existing) return { success: false, error: "Achievement not found" };
    const ctx = await athleteContext(existing.studentId);
    if (!ctx || ctx.orgId !== existing.orgId) return { success: false, error: "Achievement not found" };
    const allowed = existing.status === "VERIFIED" ? ctx.canVerify : canEditAchievement(existing, ctx.actor === "ADMIN" && !ctx.canVerify ? "COACH" : ctx.actor, ctx.userId);
    if (!allowed) return { success: false, error: "You can't delete this entry." };
    await db.athleteAchievement.delete({ where: { id: existing.id } });
    await audit(ctx, "ACHIEVEMENT_DELETED", { achievementId: existing.id, studentId: existing.studentId, status: existing.status });
    refresh(existing.studentId);
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

/** review (coach or staff), verify / reject / unverify (staff with students.manage only). */
export async function reviewAchievement(achievementId: string, action: ReviewAction, reason?: string) {
  if (!FEATURES.athleteOS) return NOT_ENABLED;
  try {
    const existing = await findAchievement(achievementId);
    if (!existing) return { success: false, error: "Achievement not found" };
    const ctx = await athleteContext(existing.studentId);
    if (!ctx || ctx.orgId !== existing.orgId) return { success: false, error: "Achievement not found" };
    // An admin without students.manage reviews like a coach and cannot verify.
    const actor: AthleteActor = ctx.actor === "ADMIN" && !ctx.canVerify ? "COACH" : ctx.actor;
    const next = nextAchievementStatus(existing.status, action, actor, reason);
    if (!next.ok) return { success: false, error: next.error };
    const now = new Date();
    const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 280) : null;
    // Conditional update: only applies if nobody changed the status in between.
    const res = await db.athleteAchievement.updateMany({
      where: { id: existing.id, orgId: ctx.orgId, status: existing.status },
      data:
        next.value === "VERIFIED"
          ? { status: "VERIFIED", verifiedById: ctx.userId, verifiedAt: now, rejectionReason: null }
          : next.value === "REJECTED"
            ? { status: "REJECTED", rejectionReason: cleanReason, reviewedById: ctx.userId, reviewedAt: now }
            : action === "unverify"
              ? { status: "REVIEWED", verifiedById: null, verifiedAt: null, rejectionReason: cleanReason }
              : { status: "REVIEWED", reviewedById: ctx.userId, reviewedAt: now },
    });
    if (res.count === 0) return { success: false, error: "This entry was just changed by someone else. Refresh and try again." };
    const auditAction = { review: "ACHIEVEMENT_REVIEWED", verify: "ACHIEVEMENT_VERIFIED", reject: "ACHIEVEMENT_REJECTED", unverify: "ACHIEVEMENT_UNVERIFIED" }[action];
    await audit(ctx, auditAction, { achievementId: existing.id, studentId: existing.studentId, from: existing.status, to: next.value });
    refresh(existing.studentId);
    return { success: true, status: next.value };
  } catch (e) {
    return failFrom(e);
  }
}

export async function saveGoal(studentId: string, raw: Record<string, unknown>, goalId?: string) {
  if (!FEATURES.athleteOS) return NOT_ENABLED;
  const ctx = await athleteContext(studentId);
  if (!ctx) return { success: false, error: "Athlete not found" };
  if (ctx.actor === "PARENT") return { success: false, error: "Only coaches and academy staff can set goals." };
  const parsed = parseGoalInput(raw ?? {}, ctx.today, !goalId);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    if (goalId) {
      const res = await db.athleteGoal.updateMany({ where: { id: goalId, orgId: ctx.orgId, studentId }, data: parsed.value });
      if (res.count === 0) return { success: false, error: "Goal not found" };
      await audit(ctx, "GOAL_SAVED", { goalId, studentId, updated: true });
      refresh(studentId);
      return { success: true, id: goalId };
    }
    const row = await db.athleteGoal.create({ data: { ...parsed.value, orgId: ctx.orgId, studentId, setById: ctx.userId, status: "ACTIVE" } });
    await audit(ctx, "GOAL_SAVED", { goalId: row.id, studentId, updated: false });
    refresh(studentId);
    return { success: true, id: row.id };
  } catch (e) {
    return failFrom(e);
  }
}

export async function setGoalStatus(goalId: string, status: string) {
  if (!FEATURES.athleteOS) return NOT_ENABLED;
  if (!isGoalStatus(status)) return { success: false, error: "Invalid status" };
  try {
    const goal = typeof goalId === "string" ? await db.athleteGoal.findUnique({ where: { id: goalId } }) : null;
    if (!goal) return { success: false, error: "Goal not found" };
    const ctx = await athleteContext(goal.studentId);
    if (!ctx || ctx.orgId !== goal.orgId) return { success: false, error: "Goal not found" };
    if (ctx.actor === "PARENT") return { success: false, error: "Only coaches and academy staff can update goals." };
    await db.athleteGoal.update({
      where: { id: goal.id },
      data: { status, achievedAt: status === "ACHIEVED" ? new Date() : null },
    });
    await audit(ctx, "GOAL_STATUS_CHANGED", { goalId: goal.id, studentId: goal.studentId, from: goal.status, to: status });
    refresh(goal.studentId);
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

async function findAchievement(id: string) {
  if (typeof id !== "string" || !id) return null;
  return db.athleteAchievement.findUnique({ where: { id } });
}

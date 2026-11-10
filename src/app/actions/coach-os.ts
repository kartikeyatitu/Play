"use server";

// Coach OS writes. Only async functions are exported from this file.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attempt } from "@/lib/action-attempt";
import type { ActionResult } from "@/lib/action-result";
import { requireMember } from "@/lib/membership";
import { rateLimitDb } from "@/lib/rate-limit";
import { istMonthString } from "@/lib/fees";
import { canAssessStudent } from "@/lib/coach/access";
import { reportAverage, validateAssessment, type AssessmentInput } from "@/lib/coach/assessment";
import { awardForSource, reverseAwardForSource } from "@/lib/rewards/server";

/**
 * Save a rubric assessment as this month's SkillReport for the student (one per student per month, so a
 * second save in the same month updates it). Rubric scores go in `metrics`; technique/fitness/discipline
 * are filled from area averages for older screens. Allowed for the coach of one of the student's
 * batches, or a non-coach team member with students.manage.
 */
export async function saveAssessment(input: AssessmentInput): Promise<ActionResult<{ month: string }>> {
  return attempt(async () => {
    // Access errors ("No academy found", not an active member) are short and safe to show as-is.
    const { session, membership } = await requireMember(["ADMIN", "COACH", "STAFF"]);

    const valid = validateAssessment(input);
    if (!valid.ok) throw new Error(valid.error);

    const limit = await rateLimitDb(`coach-os:assess:${session.id}`, 60, 60 * 60 * 1000);
    if (!limit.allowed) throw new Error("Too many saves. Try again in a while.");

    const student = await db.student.findFirst({
      where: { id: valid.studentId, orgId: session.orgId },
      select: { id: true, orgId: true, enrollments: { select: { batch: { select: { coachId: true, orgId: true } } } } },
    });
    const isCoach = !!student?.enrollments.some((e) => e.batch.coachId === session.id && e.batch.orgId === session.orgId);
    // Missing and refused look the same.
    if (!student || !canAssessStudent(membership, isCoach)) throw new Error("Student not found");

    const month = istMonthString();
    const data = {
      coachId: session.id as string,
      orgId: student.orgId,
      sport: valid.rubric.label,
      metrics: valid.scores,
      notes: valid.note,
      ...valid.legacy,
    };
    const saved = await db.skillReport.upsert({
      where: { studentId_month: { studentId: student.id, month } },
      update: data,
      create: { studentId: student.id, month, ...data },
      select: { id: true, month: true, sport: true, technique: true, fitness: true, discipline: true, metrics: true },
    });
    await syncSkillReward(session.orgId as string, student.id, saved, session.id as string);

    revalidatePath("/coach");
    revalidatePath("/coach/roster");
    revalidatePath("/coach/assess");
    return { month };
  }, "coach-os.saveAssessment");
}

/**
 * SKILL_IMPROVED: earned when this month's assessment averages higher than the most recent earlier one.
 * Re-saving the same month re-checks it, and takes the reward back if it no longer beats the last one.
 * Never throws: an assessment must save even if rewards fail.
 */
async function syncSkillReward(
  orgId: string,
  studentId: string,
  report: { id: string; month: string; sport: string | null; technique: number; fitness: number; discipline: number; metrics: unknown },
  coachId: string,
) {
  try {
    const previous = await db.skillReport.findFirst({
      where: { studentId, month: { lt: report.month } },
      orderBy: { month: "desc" },
      select: { month: true, sport: true, technique: true, fitness: true, discipline: true, metrics: true },
    });
    const now = reportAverage(report);
    const before = previous ? reportAverage(previous) : null;
    const args = { orgId, studentId, trigger: "SKILL_IMPROVED" as const, sourceId: report.id, createdById: coachId };
    if (now != null && before != null && now > before) await awardForSource(args);
    else await reverseAwardForSource(args);
  } catch (e) {
    console.error("coach-os: skill reward sync failed", e instanceof Error ? e.message : e);
  }
}

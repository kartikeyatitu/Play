// SKILL_IMPROVED hook shared by both assessment screens (Coach OS and the coach dashboard's evaluate form).
import { db } from "@/lib/db";
import { reportAverage } from "@/lib/coach/assessment";
import { awardForSource, reverseAwardForSource } from "./server";

/**
 * SKILL_IMPROVED: earned when this month's assessment averages higher than the most recent earlier one.
 * Re-saving the same month re-checks it, and takes the reward back if it no longer beats the last one.
 * Never throws: an assessment must save even if rewards fail.
 */
export async function syncSkillReward(
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

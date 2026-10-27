/**
 * Prompt builders — pure. Inputs are already minimised: no student names, phones or health data.
 */
import type { BusinessReport } from "@/lib/business-report";
import { redactContactDetails } from "./redact";

export type ScoredDimension = { label: string; score: number };

export const SKILL_NOTE_SYSTEM = [
  "You help sports coaches write short monthly progress notes that parents will read.",
  "Write 2 to 4 sentences in plain, warm, specific English. Address the parent, refer to the child as 'your child'.",
  "Mention one clear strength and one thing to work on, based only on the scores and the coach's points.",
  "Do not invent facts, matches, numbers or medical details. Do not use names. No emojis, no headings, no lists.",
].join(" ");

export function buildSkillNotePrompt(input: { sport: string; month: string; dimensions: ScoredDimension[]; coachPoints: string }): string {
  const lines = input.dimensions.map((d) => `- ${d.label}: ${clampScore(d.score)}/5`);
  const points = redactContactDetails(input.coachPoints.trim()).slice(0, 800);
  return [
    `Sport: ${input.sport}`,
    `Month: ${input.month}`,
    "Scores (1 = needs a lot of work, 5 = excellent):",
    ...lines,
    points ? `Coach's own points: ${points}` : "Coach's own points: none given.",
    "Write the note now.",
  ].join("\n");
}

export const REPORT_SYSTEM = [
  "You are an analyst for a sports academy. You explain one month of the academy's own business numbers to its owner.",
  "Use only the numbers provided. Never estimate, project or invent figures. If a value is missing, say it was not recorded.",
  "Write at most 5 short bullet points, each starting with '- ': what went well, what needs attention, and one practical next step.",
  "Refer to batches and courts by the names given. Plain English, no jargon, no headings.",
].join(" ");

/** Compact, aggregate-only view of the report. Batch and court names are business labels, not personal data. */
export function buildReportPrompt(report: BusinessReport, currency: string): string {
  const pct = (r: number | null) => (r == null ? "not recorded" : `${Math.round(r * 100)}%`);
  const money = (n: number) => `${currency} ${Math.round(n)}`;
  const lines = [
    `Month: ${report.month}`,
    `Fees: billed ${money(report.money.billed)}, collected ${money(report.money.collected)} (collection rate ${pct(report.money.collectionRate)}), outstanding this month ${money(report.money.outstandingMonth)}, outstanding to date ${money(report.money.outstandingAll)} across ${report.money.outstandingAllCount} unpaid records.`,
    `Attendance: ${pct(report.attendance.rate)} (${report.attendance.present} present of ${report.attendance.marked} marked), ${report.attendance.sessions} sessions, ${report.attendance.cancelled} cancelled.`,
    `Students: ${report.students.active} active, ${report.students.newInMonth} new this month.`,
    `Trials: ${report.trials.booked} booked, ${report.trials.enrolled} enrolled (conversion ${pct(report.trials.conversionRate)}).`,
    `Batch fill: ${pct(report.batches.utilisation)} (${report.batches.enrolled} enrolled, total capacity ${report.batches.capacity}).`,
    "Batches:",
    ...report.batches.rows.slice(0, 30).map(
      (b) => `- ${b.name}: ${b.enrolled}${b.capacity ? `/${b.capacity}` : ""} enrolled, attendance ${pct(b.attendanceRate)}, billed ${money(b.billed)}, collected ${money(b.collected)}, outstanding ${money(b.outstanding)}`,
    ),
  ];
  if (report.facilities.rows.length > 0) {
    lines.push(`Courts: ${pct(report.facilities.utilisation)} used (${report.facilities.bookedHours} of ${report.facilities.openHours} hours), ${money(report.facilities.revenue)} received.`);
    for (const f of report.facilities.rows.slice(0, 20)) {
      lines.push(`- ${f.name}: ${f.bookedHours}/${f.openHours} hours booked (${pct(f.utilisation)}), ${money(f.revenue)} received`);
    }
  }
  lines.push("Explain this month for the owner.");
  return lines.join("\n");
}

export function clampScore(n: number): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(5, Math.max(1, v)) : 3;
}

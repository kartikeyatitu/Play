/**
 * At-risk students (analytics step 2) — pure scoring, no I/O. Loader: src/lib/risk-data.ts.
 *
 * Signals (the ones retention platforms such as Glofox describe, adapted to academies):
 *  1. Recent attendance: last 8 marked sessions (needs ≥4 to count).
 *  2. Drop: recent rate vs the 8 sessions before (needs ≥4 in each window).
 *  3. Absence streak: consecutive absences up to the most recent session.
 *  4. Overdue fees: months of fees unpaid after their month has passed.
 *  5. Tenure: students in their first 90 days are likelier to leave (adds weight only alongside another signal).
 * The score is a guide for who to call first, not a prediction.
 */
import { monthLabel, monthsBehind } from "@/lib/insights";

export const RECENT_WINDOW = 8;
export const MIN_MARKS = 4;
export const NEW_STUDENT_DAYS = 90;

export type AttendanceMark = { date: string; present: boolean };
export type RiskLevel = "high" | "medium" | "low" | "none";
export type RiskSignal = "attendance" | "drop" | "streak" | "fees" | "new";

export type RiskResult = {
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  reasons: string[];
  recentRate: number | null;
  previousRate: number | null;
  absenceStreak: number;
  lastPresent: string | null;
  overdueMonths: string[];
};

export function scoreRisk(input: {
  marks: ReadonlyArray<AttendanceMark>;
  unpaidMonths: ReadonlyArray<string>;
  joinedAt: Date | null;
  today: string; // YYYY-MM-DD, academy timezone
}): RiskResult {
  const marks = [...input.marks].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const recent = marks.slice(0, RECENT_WINDOW);
  const previous = marks.slice(RECENT_WINDOW, RECENT_WINDOW * 2);
  const rate = (xs: AttendanceMark[]) => (xs.length >= MIN_MARKS ? xs.filter((m) => m.present).length / xs.length : null);
  const recentRate = rate(recent);
  const previousRate = rate(previous);

  let absenceStreak = 0;
  for (const m of marks) {
    if (m.present) break;
    absenceStreak++;
  }
  const lastPresent = marks.find((m) => m.present)?.date ?? null;

  const currentMonth = input.today.slice(0, 7);
  const overdueMonths = [...new Set(input.unpaidMonths)]
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && monthsBehind(m, currentMonth) >= 1)
    .sort();

  let score = 0;
  const signals: RiskSignal[] = [];
  const reasons: string[] = [];

  if (recentRate != null && recentRate < 0.7) {
    const attended = recent.filter((m) => m.present).length;
    score += recentRate < 0.5 ? 3 : 2;
    signals.push("attendance");
    reasons.push(`Attended ${attended} of the last ${recent.length} sessions`);
  }
  if (recentRate != null && previousRate != null && previousRate - recentRate >= 0.25) {
    score += 2;
    signals.push("drop");
    reasons.push(`Attendance down from ${Math.round(previousRate * 100)}% to ${Math.round(recentRate * 100)}%`);
  }
  if (absenceStreak >= 3) {
    score += absenceStreak >= 5 ? 3 : 2;
    signals.push("streak");
    reasons.push(`Missed the last ${absenceStreak} sessions in a row`);
  }
  if (overdueMonths.length > 0) {
    score += overdueMonths.length >= 2 ? 2 : 1;
    signals.push("fees");
    reasons.push(`Fees unpaid for ${listMonths(overdueMonths)}`);
  }
  if (score > 0 && input.joinedAt) {
    const days = Math.floor((Date.parse(`${input.today}T00:00:00Z`) - input.joinedAt.getTime()) / 86_400_000);
    if (days >= 0 && days <= NEW_STUDENT_DAYS) {
      score += 1;
      signals.push("new");
      reasons.push(`Joined ${days} day${days === 1 ? "" : "s"} ago: the first three months are when most students leave`);
    }
  }

  const level: RiskLevel = score >= 5 ? "high" : score >= 3 ? "medium" : score >= 1 ? "low" : "none";
  return { score, level, signals, reasons, recentRate, previousRate, absenceStreak, lastPresent, overdueMonths };
}

function listMonths(months: string[]): string {
  const labels = months.map(monthLabel);
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(-3).join(", ")} and ${labels.length - 3} earlier`;
}

/**
 * A warm, editable WhatsApp message to the parent. The admin reads and sends it themselves.
 * Attendance concerns lead; fees are mentioned gently. No scores or labels are shown to parents.
 */
export function parentMessage(input: {
  parentName: string;
  childName: string;
  batchName: string | null;
  academyName: string;
  signals: ReadonlyArray<RiskSignal>;
  overdueMonths: ReadonlyArray<string>;
}): string {
  const parent = firstName(input.parentName) || "there";
  const child = firstName(input.childName) || "your child";
  const where = input.batchName ? ` at ${input.batchName}` : "";
  const attendanceIssue = input.signals.some((s) => s === "attendance" || s === "drop" || s === "streak");
  const fees = input.overdueMonths.length > 0 ? input.overdueMonths.map(monthLabel).join(", ") : "";
  const hello = `Hi ${parent}, this is ${input.academyName}.`;
  if (attendanceIssue) {
    const base = `${hello} We've missed ${child}${where} recently and wanted to check everything is OK. If the timing isn't working, we're happy to suggest another batch.`;
    return fees ? `${base} Also, ${child}'s fees for ${fees} are still pending; reply here if you'd like to pay by UPI or need more time.` : base;
  }
  if (fees) {
    return `${hello} A quick reminder that ${child}'s fees for ${fees} are still pending. Reply here if you'd like to pay by UPI or need more time.`;
  }
  return `${hello} Just checking in on how ${child} is enjoying training${where}. Anything we can help with?`;
}

function firstName(name: string): string {
  return String(name ?? "").trim().split(/\s+/)[0] ?? "";
}

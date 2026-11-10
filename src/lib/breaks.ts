// Breaks (exams, holidays, injury) and make-up sessions. Pure rules; storage lives in breaks-server.ts.
// Stored as AuditLog rows so no database change is needed: the latest STUDENT_BREAK row per child wins.

export const BREAK_ACTION = "STUDENT_BREAK";
export const MAKEUP_CREDIT_ACTION = "MAKEUP_CREDIT";
export const MAKEUP_USED_ACTION = "MAKEUP_USED";

export const BREAK_REASONS = ["EXAMS", "HOLIDAY", "INJURY", "OTHER"] as const;
export type BreakReason = (typeof BREAK_REASONS)[number];
export const BREAK_REASON_LABEL: Record<BreakReason, string> = { EXAMS: "Exams", HOLIDAY: "Holiday", INJURY: "Injury", OTHER: "Break" };

export type StudentBreak = { studentId: string; fromMonth: string; toMonth: string; reason: BreakReason };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Owner input → a break, or an error. A break starts this month or later and lasts 1 to 3 months. */
export function validateBreak(
  input: { studentId?: unknown; fromMonth?: unknown; months?: unknown; reason?: unknown },
  currentMonth: string,
): { ok: true; value: StudentBreak } | { ok: false; error: string } {
  const studentId = typeof input.studentId === "string" ? input.studentId.trim() : "";
  if (!studentId || studentId.length > 64) return { ok: false, error: "Pick a student." };
  const fromMonth = typeof input.fromMonth === "string" ? input.fromMonth : "";
  if (!MONTH.test(fromMonth)) return { ok: false, error: "Pick the month the break starts." };
  if (fromMonth < currentMonth) return { ok: false, error: "A break can't start in a past month." };
  if (fromMonth > addMonths(currentMonth, 6)) return { ok: false, error: "Start the break within the next 6 months." };
  const months = Number(input.months);
  if (!Number.isInteger(months) || months < 1 || months > 3) return { ok: false, error: "A break lasts 1, 2 or 3 months." };
  const reason = (BREAK_REASONS as readonly string[]).includes(String(input.reason)) ? (input.reason as BreakReason) : "OTHER";
  return { ok: true, value: { studentId, fromMonth, toMonth: addMonths(fromMonth, months - 1), reason } };
}

/** Rows newest first → each child's current break (a row with toMonth null ends it). Past breaks drop out. */
export function currentBreaks(
  rowsNewestFirst: ReadonlyArray<{ details: string | null }>,
  currentMonth: string,
): Map<string, StudentBreak> {
  const out = new Map<string, StudentBreak>();
  const seen = new Set<string>();
  for (const r of rowsNewestFirst) {
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(r.details || "{}");
    } catch {
      continue;
    }
    const sid = typeof d.studentId === "string" ? d.studentId : "";
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    if (typeof d.fromMonth !== "string" || typeof d.toMonth !== "string" || !MONTH.test(d.fromMonth) || !MONTH.test(d.toMonth)) continue;
    if (d.toMonth < currentMonth) continue;
    const reason = (BREAK_REASONS as readonly string[]).includes(String(d.reason)) ? (d.reason as BreakReason) : "OTHER";
    out.set(sid, { studentId: sid, fromMonth: d.fromMonth, toMonth: d.toMonth, reason });
  }
  return out;
}

export const onBreak = (b: StudentBreak | undefined | null, month: string) => !!b && b.fromMonth <= month && month <= b.toMonth;

/** "On a break for exams until Dec 2026" */
export function breakLine(b: StudentBreak): string {
  const what = b.reason === "OTHER" ? "a break" : `a break for ${BREAK_REASON_LABEL[b.reason].toLowerCase()}`;
  return `On ${what} until ${monthLabel(b.toMonth)}`;
}

export type MakeupCredit = { id: string; studentId: string; date: string; batchName: string; reason: string };

/** Credits not yet marked used. `credits` and `used` are AuditLog rows; a used row names the credit's id. */
export function openMakeups(
  credits: ReadonlyArray<{ id: string; details: string | null }>,
  used: ReadonlyArray<{ details: string | null }>,
): MakeupCredit[] {
  const usedIds = new Set<string>();
  for (const u of used) {
    try {
      const d = JSON.parse(u.details || "{}");
      if (typeof d.creditId === "string") usedIds.add(d.creditId);
    } catch {
      /* skip */
    }
  }
  const out: MakeupCredit[] = [];
  for (const c of credits) {
    if (usedIds.has(c.id)) continue;
    try {
      const d = JSON.parse(c.details || "{}");
      if (typeof d.studentId !== "string") continue;
      out.push({ id: c.id, studentId: d.studentId, date: String(d.date || ""), batchName: String(d.batchName || ""), reason: String(d.reason || "") });
    } catch {
      /* skip */
    }
  }
  return out;
}

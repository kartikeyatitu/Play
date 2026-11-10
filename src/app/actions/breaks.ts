"use server";
// Breaks (exams, holidays, injury), rain days and make-up sessions. Stored as AuditLog rows (no schema change).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { istMonthString, istToday, istWeekday, scheduleRunsOn } from "@/lib/fees";
import { BREAK_ACTION, MAKEUP_CREDIT_ACTION, MAKEUP_USED_ACTION, validateBreak, onBreak, type StudentBreak } from "@/lib/breaks";
import { loadBreaks, loadOpenMakeups } from "@/lib/breaks-server";

type Ok<T = object> = { success: true } & T;
type Fail = { success: false; error: string };

function refresh() {
  revalidatePath("/org");
  revalidatePath("/coach");
  revalidatePath("/parent");
}

async function studentInOrg(orgId: string, studentId: string) {
  return db.student.findFirst({ where: { id: studentId, orgId }, select: { id: true, name: true } });
}

/** The child's current or upcoming break, if any. */
export async function getStudentBreak(studentId: string): Promise<Ok<{ value: StudentBreak | null; currentMonth: string }> | Fail> {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  if (!(await studentInOrg(auth.session.orgId, String(studentId)))) return { success: false, error: "Student not found." };
  const month = istMonthString();
  const map = await loadBreaks(auth.session.orgId, month);
  return { success: true, value: map.get(String(studentId)) ?? null, currentMonth: month };
}

/** Put a child on a break for 1 to 3 months: no monthly fee, not on the coach's roster, nothing counted as missed. */
export async function setStudentBreak(input: { studentId: string; fromMonth: string; months: number; reason: string }): Promise<Ok<{ value: StudentBreak }> | Fail> {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const v = validateBreak(input ?? {}, istMonthString());
  if (!v.ok) return { success: false, error: v.error };
  if (!(await studentInOrg(auth.session.orgId, v.value.studentId))) return { success: false, error: "Student not found." };
  await db.auditLog.create({
    data: { userId: auth.session.id, orgId: auth.session.orgId, action: BREAK_ACTION, details: JSON.stringify(v.value) },
  });
  refresh();
  return { success: true, value: v.value };
}

/** End a break early (or cancel one that hasn't started). The child is back on the roster straight away. */
export async function endStudentBreak(studentId: string): Promise<Ok | Fail> {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const s = await studentInOrg(auth.session.orgId, String(studentId));
  if (!s) return { success: false, error: "Student not found." };
  await db.auditLog.create({
    data: { userId: auth.session.id, orgId: auth.session.orgId, action: BREAK_ACTION, details: JSON.stringify({ studentId: s.id, fromMonth: null, toMonth: null, ended: true }) },
  });
  refresh();
  return { success: true };
}

/**
 * Rain (or a ground problem): cancel every batch that runs today, tell parents, and optionally owe each
 * child a make-up session. Children on a break are skipped.
 */
export async function cancelAllToday(input: { reason: string; makeup: boolean }): Promise<Ok<{ batches: number; makeups: number }> | Fail> {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;
  const reason = String(input?.reason ?? "").trim().slice(0, 200) || "Rain";
  const today = istToday();
  const weekday = istWeekday();
  const month = istMonthString();
  const dateStr = today.toISOString().slice(0, 10);

  const batches = await db.batch.findMany({
    where: { orgId },
    select: { id: true, name: true, schedule: true, sessions: { where: { date: today }, select: { id: true, status: true } }, enrollments: { select: { studentId: true } } },
  });
  const todays = batches.filter((b) => b.sessions.length > 0 || scheduleRunsOn(b.schedule, weekday) !== false).filter((b) => b.sessions[0]?.status !== "CANCELLED");
  if (todays.length === 0) return { success: false, error: "No batches left to cancel today." };
  const breaks = input?.makeup ? await loadBreaks(orgId, month) : new Map();

  let makeups = 0;
  for (const b of todays) {
    const s = await db.session.upsert({
      where: { batchId_date: { batchId: b.id, date: today } },
      update: { status: "CANCELLED", cancelReason: reason },
      create: { batchId: b.id, date: today, status: "CANCELLED", cancelReason: reason, orgId },
      select: { id: true },
    });
    await db.announcement.create({
      data: {
        orgId,
        batchId: b.id,
        kind: "CANCELLATION",
        authorId: auth.session.id,
        title: `Today's ${b.name} session is cancelled`,
        message: input?.makeup ? `Reason: ${reason}. Your child gets a make-up session; the academy will share the time.` : `Reason: ${reason}. See you at the next session.`,
      },
    });
    if (input?.makeup) {
      const rows = b.enrollments
        .filter((e) => !onBreak(breaks.get(e.studentId), month))
        .map((e) => ({
          userId: auth.session.id,
          orgId,
          action: MAKEUP_CREDIT_ACTION,
          details: JSON.stringify({ studentId: e.studentId, sessionId: s.id, batchId: b.id, batchName: b.name, date: dateStr, reason }),
        }));
      if (rows.length) {
        await db.auditLog.createMany({ data: rows });
        makeups += rows.length;
      }
    }
  }
  await db.auditLog.create({
    data: { userId: auth.session.id, orgId, action: "SESSIONS_CANCELLED_ALL", details: JSON.stringify({ date: dateStr, reason, batches: todays.length, makeups }) },
  });
  refresh();
  return { success: true, batches: todays.length, makeups };
}

/** Make-up sessions still owed, with the child's name, oldest first. */
export async function listOpenMakeups(): Promise<Ok<{ items: { id: string; studentId: string; name: string; date: string; batchName: string; reason: string }[] }> | Fail> {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const open = await loadOpenMakeups(auth.session.orgId);
  const students = await db.student.findMany({ where: { orgId: auth.session.orgId, id: { in: [...new Set(open.map((o) => o.studentId))] } }, select: { id: true, name: true } });
  const names = new Map(students.map((s) => [s.id, s.name]));
  return { success: true, items: open.filter((o) => names.has(o.studentId)).map((o) => ({ ...o, name: names.get(o.studentId)! })) };
}

/** The make-up session was given. */
export async function markMakeupGiven(creditId: string): Promise<Ok | Fail> {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const credit = await db.auditLog.findFirst({ where: { id: String(creditId), orgId: auth.session.orgId, action: MAKEUP_CREDIT_ACTION }, select: { id: true } });
  if (!credit) return { success: false, error: "Make-up not found." };
  await db.auditLog.create({
    data: { userId: auth.session.id, orgId: auth.session.orgId, action: MAKEUP_USED_ACTION, details: JSON.stringify({ creditId: credit.id }) },
  });
  refresh();
  return { success: true };
}

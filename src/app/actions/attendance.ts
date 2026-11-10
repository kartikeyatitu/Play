"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyArrivals } from "@/lib/arrival";
import { requireMember } from "@/lib/membership";
import { canMarkBatchAttendance } from "@/lib/team";
import { istToday } from "@/lib/fees";
import { ATTENDANCE_STATUSES, statusIsPresent, type AttendanceStatus } from "@/lib/coach";
import { syncAttendanceReward } from "@/lib/rewards/server";

/** Rewards hang off attendance but must never break it. */
async function syncRewards(orgId: string, sessionId: string, studentIds: string[], present: boolean, by: string) {
  for (const studentId of studentIds) {
    try {
      await syncAttendanceReward({ orgId, sessionId, studentId, present, createdById: by });
    } catch (e) {
      console.error("attendance: rewards sync failed", e instanceof Error ? e.message : e);
    }
  }
}

type Result = { success: true } | { success: false; error: string };

function normaliseStatus(input: AttendanceStatus | boolean): AttendanceStatus | null {
  if (typeof input === "boolean") return input ? "PRESENT" : "ABSENT";
  return (ATTENDANCE_STATUSES as string[]).includes(input) ? input : null;
}

/** Auth + ownership check shared by both actions. Returns the batch or an error. */
async function authoriseBatch(batchId: string) {
  let ctx: Awaited<ReturnType<typeof requireMember>>;
  try {
    ctx = await requireMember(["ADMIN", "COACH", "STAFF"]);
  } catch (e: any) {
    if (e?.message === "No academy found") return { error: "No academy found for your account." } as const;
    if (e?.message === "You are not an active member of this academy") return { error: e.message as string } as const;
    throw e;
  }
  const authSession = ctx.session;

  const batch = await db.batch.findFirst({
    where: { id: batchId, orgId: authSession.orgId },
    select: { id: true, coachId: true, orgId: true },
  });
  if (!batch) return { error: "Batch not found in your academy." } as const;
  if (!canMarkBatchAttendance(ctx.membership, batch.coachId === authSession.id)) {
    return {
      error: ctx.membership.role === "COACH"
        ? "You can only mark attendance for your own batches."
        : "You don't have permission to mark attendance.",
    } as const;
  }
  return { batch, orgId: authSession.orgId, userId: authSession.id } as const;
}

/** Today's session for a batch — race-safe thanks to @@unique([batchId, date]). */
async function getOrCreateTodaySession(batchId: string, orgId: string) {
  const today = istToday();
  return db.session.upsert({
    where: { batchId_date: { batchId, date: today } },
    update: {},
    create: { batchId, date: today, status: "COMPLETED", orgId },
  });
}

export type RosterEntry = { id: string; name: string; status: AttendanceStatus | null };

/** Today's roster for a batch with any marks already taken. Read-only (no session is created). */
export async function getTodayRoster(
  batchId: string
): Promise<{ success: true; students: RosterEntry[]; cancelled: boolean } | { success: false; error: string }> {
  const auth = await authoriseBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };

  const [enrollments, session] = await Promise.all([
    db.batchEnrollment.findMany({
      where: { batchId, student: { orgId: auth.orgId } },
      select: { student: { select: { id: true, name: true } } },
      orderBy: { student: { name: "asc" } },
    }),
    db.session.findUnique({
      where: { batchId_date: { batchId, date: istToday() } },
      select: { status: true, attendances: { select: { studentId: true, status: true, isPresent: true } } },
    }),
  ]);
  const marks = new Map(
    (session?.attendances ?? []).map((a) => [a.studentId, (a.status as AttendanceStatus | null) ?? (a.isPresent ? "PRESENT" : "ABSENT")])
  );
  return {
    success: true,
    cancelled: session?.status === "CANCELLED",
    students: enrollments.map((e) => ({ id: e.student.id, name: e.student.name, status: marks.get(e.student.id) ?? null })),
  };
}

export async function markAttendance(
  batchId: string,
  studentId: string,
  statusInput: AttendanceStatus | boolean
): Promise<Result> {
  const status = normaliseStatus(statusInput);
  if (!status) return { success: false, error: "Invalid attendance status." };

  const auth = await authoriseBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };

  // Defense in depth: the enrolled student must also belong to the batch's academy
  const enrollment = await db.batchEnrollment.findFirst({
    where: { batchId, studentId, student: { orgId: auth.orgId } },
    select: { id: true },
  });
  if (!enrollment) return { success: false, error: "Student is not enrolled in this batch." };

  const dbSession = await getOrCreateTodaySession(batchId, auth.orgId);
  if (dbSession.status === "CANCELLED") {
    return { success: false, error: "This session was cancelled. Restore it to take attendance." };
  }

  const isPresent = statusIsPresent(status);
  const before = isPresent
    ? await db.attendance.findUnique({ where: { sessionId_studentId: { sessionId: dbSession.id, studentId } }, select: { isPresent: true } })
    : null;
  await db.attendance.upsert({
    where: { sessionId_studentId: { sessionId: dbSession.id, studentId } },
    update: { isPresent, status },
    create: { sessionId: dbSession.id, studentId, isPresent, status },
  });
  await syncRewards(auth.orgId, dbSession.id, [studentId], isPresent, auth.userId);
  if (isPresent && !before?.isPresent) {
    const sessionId = dbSession.id;
    after(() => notifyArrivals(auth.orgId, sessionId, [studentId]));
  }

  revalidatePath("/coach");
  return { success: true };
}

export async function markBatchAttendance(
  batchId: string,
  studentIds: string[],
  statusInput: AttendanceStatus | boolean
): Promise<Result> {
  const status = normaliseStatus(statusInput);
  if (!status) return { success: false, error: "Invalid attendance status." };

  const auth = await authoriseBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };

  // Only students actually enrolled in this batch (and belonging to the same academy)
  const enrolled = await db.batchEnrollment.findMany({
    where: { batchId, studentId: { in: studentIds }, student: { orgId: auth.orgId } },
    select: { studentId: true },
  });
  const ids = enrolled.map((e) => e.studentId);
  if (ids.length === 0) return { success: false, error: "No enrolled students to mark." };

  const dbSession = await getOrCreateTodaySession(batchId, auth.orgId);
  if (dbSession.status === "CANCELLED") {
    return { success: false, error: "This session was cancelled. Restore it to take attendance." };
  }

  const isPresent = statusIsPresent(status);
  const alreadyIn = isPresent
    ? new Set(
        (await db.attendance.findMany({ where: { sessionId: dbSession.id, studentId: { in: ids }, isPresent: true }, select: { studentId: true } })).map((a) => a.studentId)
      )
    : new Set<string>();
  await db.$transaction(
    ids.map((studentId) =>
      db.attendance.upsert({
        where: { sessionId_studentId: { sessionId: dbSession.id, studentId } },
        update: { isPresent, status },
        create: { sessionId: dbSession.id, studentId, isPresent, status },
      })
    )
  );
  await syncRewards(auth.orgId, dbSession.id, ids, isPresent, auth.userId);
  const arrived = isPresent ? ids.filter((id) => !alreadyIn.has(id)) : [];
  if (arrived.length) {
    const sessionId = dbSession.id;
    after(() => notifyArrivals(auth.orgId, sessionId, arrived));
  }

  revalidatePath("/coach");
  return { success: true };
}


/**
 * Today's note about one child (typed or spoken), saved on their attendance row so the parent sees it
 * on the child's page and in the weekly story. Attendance has to be marked first.
 */
export async function saveSessionNote(batchId: string, studentId: string, noteInput: string): Promise<Result> {
  const auth = await authoriseBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };
  const note = String(noteInput ?? "").replace(/\s+\n/g, "\n").trim().slice(0, 500);

  const session = await db.session.findUnique({
    where: { batchId_date: { batchId, date: istToday() } },
    select: { id: true, status: true },
  });
  if (!session) return { success: false, error: "Mark attendance first, then add a note." };
  if (session.status === "CANCELLED") return { success: false, error: "This session was cancelled." };
  const row = await db.attendance.findFirst({
    where: { sessionId: session.id, studentId, student: { orgId: auth.orgId } },
    select: { id: true },
  });
  if (!row) return { success: false, error: "Mark this child's attendance first, then add a note." };
  await db.attendance.update({ where: { id: row.id }, data: { notes: note || null } });
  revalidatePath("/coach");
  return { success: true };
}

"use server";

// V10 TRIQ Education: institution profile, sports programs, teams/squads mapped onto existing
// batches, and student participation records. Gated by FEATURES.education (off by default).
// All data stays inside the institution's organization.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { checkPermission, getMembership, hasPermission } from "@/lib/membership";
import { orgToday } from "@/lib/i18n";
import { isMissingTableError, SCHEMA_PENDING_MESSAGE } from "@/lib/schema-pending";
import {
  computeProgramMetrics,
  parseInstitutionProfile,
  parseParticipationInput,
  parseProgramInput,
  parseTeamInput,
} from "@/lib/education";

type Fail = { success: false; error: string };
const NOT_ENABLED: Fail = { success: false, error: "Not enabled" };
const NO_PERMISSION: Fail = { success: false, error: "You don't have permission to do this" };
const METRICS_WINDOW_DAYS = 90;

function failFrom(e: unknown): Fail {
  if (isMissingTableError(e)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
  throw e;
}

async function orgDay(orgId: string): Promise<Date> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  return new Date(`${orgToday(org)}T00:00:00.000Z`);
}

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
}

const refresh = () => revalidatePath("/org");

/** Institution profile, programs with teams and metrics, and batches that can be linked. Owners/managers. */
export async function getInstitutionOverview() {
  if (!FEATURES.education) return NOT_ENABLED;
  const auth = await checkPermission(null);
  if (!auth.ok) return { success: false as const, error: auth.error };
  const orgId = auth.session.orgId;
  const perms = {
    canEditProfile: hasPermission(auth.membership, "settings.manage"),
    canManagePrograms: hasPermission(auth.membership, "batches.manage"),
    canRecord: hasPermission(auth.membership, "students.manage"),
  };
  try {
    const today = await orgDay(orgId);
    const from = new Date(today.getTime() - METRICS_WINDOW_DAYS * 86_400_000);
    const [profile, programs, batches] = await Promise.all([
      db.institutionProfile.findUnique({ where: { orgId } }),
      db.sportsProgram.findMany({ where: { orgId }, include: { teams: true }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
      db.batch.findMany({
        where: { orgId },
        select: { id: true, name: true, sport: true, schedule: true, coach: { select: { name: true } }, _count: { select: { enrollments: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    const linkedBatchIds = programs.flatMap((p) => p.teams.map((t) => t.batchId));
    const [sessions, enrollments, records] = linkedBatchIds.length
      ? await Promise.all([
          db.session.findMany({ where: { batchId: { in: linkedBatchIds }, date: { gte: from, lte: today } }, select: { id: true, date: true, status: true, batchId: true } }),
          db.batchEnrollment.findMany({ where: { batchId: { in: linkedBatchIds } }, select: { batchId: true, studentId: true } }),
          db.participationRecord.findMany({ where: { orgId, date: { gte: from } }, select: { programId: true, kind: true, date: true } }),
        ])
      : [[], [], []];
    const attendances = sessions.length
      ? await db.attendance.findMany({ where: { sessionId: { in: sessions.map((s) => s.id) } }, select: { sessionId: true, isPresent: true, status: true } })
      : [];

    const batchById = new Map(batches.map((b) => [b.id, b]));
    return {
      success: true as const,
      ...perms,
      windowDays: METRICS_WINDOW_DAYS,
      profile,
      batches: batches.map((b) => ({ id: b.id, name: b.name, sport: b.sport, linked: linkedBatchIds.includes(b.id) })),
      programs: programs.map((p) => {
        const ids = new Set(p.teams.map((t) => t.batchId));
        const progSessions = sessions.filter((s) => ids.has(s.batchId));
        const sessionIds = new Set(progSessions.map((s) => s.id));
        return {
          id: p.id,
          name: p.name,
          sport: p.sport,
          description: p.description,
          status: p.status,
          teams: p.teams.map((t) => {
            const b = batchById.get(t.batchId);
            return { id: t.id, batchId: t.batchId, squadType: t.squadType, ageGroup: t.ageGroup, gender: t.gender, batchName: b?.name ?? "Batch", coachName: b?.coach?.name ?? null, schedule: b?.schedule ?? null, roster: b?._count.enrollments ?? 0 };
          }),
          metrics: computeProgramMetrics({
            teamCount: p.teams.length,
            enrolledStudentIds: enrollments.filter((e) => ids.has(e.batchId)).map((e) => e.studentId),
            sessions: progSessions,
            attendances: attendances.filter((a) => sessionIds.has(a.sessionId)),
            records: records.filter((r) => r.programId === p.id),
            from,
            today,
          }),
        };
      }),
    };
  } catch (e) {
    return failFrom(e);
  }
}

export async function saveInstitutionProfile(raw: Record<string, unknown>) {
  if (!FEATURES.education) return NOT_ENABLED;
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const parsed = parseInstitutionProfile(raw ?? {});
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { orgId, id: userId } = auth.session;
  try {
    await db.institutionProfile.upsert({
      where: { orgId },
      update: { ...parsed.value, updatedById: userId },
      create: { ...parsed.value, orgId, updatedById: userId },
    });
    await audit(userId, orgId, "INSTITUTION_PROFILE_SAVED", { kind: parsed.value.kind });
    refresh();
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

export async function saveProgram(raw: Record<string, unknown>, programId?: string) {
  if (!FEATURES.education) return NOT_ENABLED;
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const parsed = parseProgramInput(raw ?? {});
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { orgId, id: userId } = auth.session;
  try {
    const clash = await db.sportsProgram.findFirst({
      where: { orgId, name: { equals: parsed.value.name, mode: "insensitive" }, ...(programId ? { id: { not: programId } } : {}) },
      select: { id: true },
    });
    if (clash) return { success: false, error: "A program with this name already exists." };
    let id = programId;
    if (programId) {
      const res = await db.sportsProgram.updateMany({ where: { id: programId, orgId }, data: parsed.value });
      if (res.count === 0) return { success: false, error: "Program not found" };
    } else {
      id = (await db.sportsProgram.create({ data: { ...parsed.value, orgId, createdById: userId } })).id;
    }
    await audit(userId, orgId, "PROGRAM_SAVED", { programId: id, created: !programId });
    refresh();
    return { success: true, id };
  } catch (e) {
    return failFrom(e);
  }
}

export async function setProgramStatus(programId: string, status: string) {
  if (!FEATURES.education) return NOT_ENABLED;
  if (status !== "ACTIVE" && status !== "ARCHIVED") return { success: false, error: "Invalid status" };
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { orgId, id: userId } = auth.session;
  try {
    const res = await db.sportsProgram.updateMany({ where: { id: programId, orgId }, data: { status } });
    if (res.count === 0) return { success: false, error: "Program not found" };
    await audit(userId, orgId, "PROGRAM_STATUS_CHANGED", { programId, status });
    refresh();
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

export async function linkTeam(programId: string, raw: Record<string, unknown>) {
  if (!FEATURES.education) return NOT_ENABLED;
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const parsed = parseTeamInput(raw ?? {});
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { orgId, id: userId } = auth.session;
  try {
    const [program, batch] = await Promise.all([
      db.sportsProgram.findFirst({ where: { id: programId, orgId }, select: { id: true, status: true } }),
      db.batch.findFirst({ where: { id: parsed.value.batchId, orgId }, select: { id: true } }),
    ]);
    if (!program) return { success: false, error: "Program not found" };
    if (program.status !== "ACTIVE") return { success: false, error: "Re-activate the program first." };
    if (!batch) return { success: false, error: "Batch not found in your institution." };
    const already = await db.programTeam.findUnique({ where: { batchId: batch.id }, select: { programId: true } });
    if (already) return { success: false, error: "This batch is already a team in a program." };
    const team = await db.programTeam.create({ data: { ...parsed.value, orgId, programId: program.id } });
    await audit(userId, orgId, "TEAM_LINKED", { programId: program.id, teamId: team.id, batchId: batch.id });
    refresh();
    return { success: true, id: team.id };
  } catch (e: any) {
    if (e?.code === "P2002") return { success: false, error: "This batch is already a team in a program." };
    return failFrom(e);
  }
}

export async function unlinkTeam(teamId: string) {
  if (!FEATURES.education) return NOT_ENABLED;
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { orgId, id: userId } = auth.session;
  try {
    const team = await db.programTeam.findFirst({ where: { id: teamId, orgId } });
    if (!team) return { success: false, error: "Team not found" };
    await db.programTeam.delete({ where: { id: team.id } }); // batch, roster and attendance are untouched
    await audit(userId, orgId, "TEAM_UNLINKED", { programId: team.programId, teamId: team.id, batchId: team.batchId });
    refresh();
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

/** Participation records and the program roster (students in its team batches). Staff only. */
export async function listParticipation(programId: string) {
  if (!FEATURES.education) return NOT_ENABLED;
  const auth = await checkPermission(null);
  if (!auth.ok) return { success: false as const, error: auth.error };
  if (!hasPermission(auth.membership, "students.manage") && !hasPermission(auth.membership, "reports.view")) return NO_PERMISSION;
  const orgId = auth.session.orgId;
  try {
    const program = await db.sportsProgram.findFirst({ where: { id: programId, orgId }, include: { teams: true } });
    if (!program) return { success: false as const, error: "Program not found" };
    const batchIds = program.teams.map((t) => t.batchId);
    const [records, roster] = await Promise.all([
      db.participationRecord.findMany({ where: { orgId, programId: program.id }, orderBy: { date: "desc" }, take: 200 }),
      batchIds.length
        ? db.student.findMany({
            where: { orgId, enrollments: { some: { batchId: { in: batchIds } } } },
            select: { id: true, name: true, enrollments: { where: { batchId: { in: batchIds } }, select: { batchId: true } } },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);
    const names = new Map(roster.map((s) => [s.id, s.name]));
    const missing = records.filter((r) => !names.has(r.studentId)).map((r) => r.studentId);
    if (missing.length) {
      for (const s of await db.student.findMany({ where: { orgId, id: { in: missing } }, select: { id: true, name: true } })) names.set(s.id, s.name);
    }
    const teamOfBatch = new Map(program.teams.map((t) => [t.batchId, t.id]));
    return {
      success: true as const,
      roster: roster.map((s) => ({ id: s.id, name: s.name, teamIds: s.enrollments.map((e) => teamOfBatch.get(e.batchId)).filter(Boolean) as string[] })),
      records: records.map((r) => ({ ...r, studentName: names.get(r.studentId) ?? "Former student" })),
    };
  } catch (e) {
    return failFrom(e);
  }
}

/** Staff with students.manage, or the coach of one of the program's team batches the student is in. */
export async function recordParticipation(programId: string, raw: Record<string, unknown>) {
  if (!FEATURES.education) return NOT_ENABLED;
  const session = await requireAuth(["ADMIN", "COACH"]);
  if (!session.orgId) return { success: false, error: "No institution found" };
  const orgId = session.orgId as string;
  const membership = await getMembership(session.id, orgId);
  if (!membership) return NO_PERMISSION;
  const isStaff = session.role === "ADMIN" && hasPermission(membership, "students.manage");
  if (!isStaff && session.role !== "COACH") return NO_PERMISSION;
  try {
    const parsed = parseParticipationInput(raw ?? {}, await orgDay(orgId));
    if (!parsed.ok) return { success: false, error: parsed.error };
    const program = await db.sportsProgram.findFirst({ where: { id: programId, orgId, status: "ACTIVE" }, include: { teams: true } });
    if (!program) return { success: false, error: "Program not found or archived" };
    const teams = isStaff ? program.teams : (await db.batch.findMany({ where: { orgId, coachId: session.id, id: { in: program.teams.map((t) => t.batchId) } }, select: { id: true } }))
      .map((b) => program.teams.find((t) => t.batchId === b.id)!)
      .filter(Boolean);
    if (!teams.length) return { success: false, error: isStaff ? "Link a batch to this program first." : "You don't coach a team in this program." };
    const student = await db.student.findFirst({
      where: { id: parsed.value.studentId, orgId, enrollments: { some: { batchId: { in: teams.map((t) => t.batchId) } } } },
      select: { id: true, enrollments: { select: { batchId: true } } },
    });
    if (!student) return { success: false, error: "This student is not in one of the program's teams." };
    let teamId = parsed.value.teamId;
    if (teamId && !teams.some((t) => t.id === teamId && student.enrollments.some((e) => e.batchId === t.batchId))) teamId = null;
    const row = await db.participationRecord.create({ data: { ...parsed.value, teamId, orgId, programId: program.id, recordedById: session.id } });
    await audit(session.id, orgId, "PARTICIPATION_RECORDED", { programId: program.id, recordId: row.id, studentId: student.id, kind: row.kind });
    refresh();
    return { success: true, id: row.id };
  } catch (e) {
    return failFrom(e);
  }
}

export async function deleteParticipation(recordId: string) {
  if (!FEATURES.education) return NOT_ENABLED;
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { orgId, id: userId } = auth.session;
  try {
    const rec = await db.participationRecord.findFirst({ where: { id: recordId, orgId } });
    if (!rec) return { success: false, error: "Record not found" };
    await db.participationRecord.delete({ where: { id: rec.id } });
    await audit(userId, orgId, "PARTICIPATION_DELETED", { programId: rec.programId, recordId: rec.id, studentId: rec.studentId });
    refresh();
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

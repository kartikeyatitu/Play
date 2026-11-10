"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { checkPermission } from "@/lib/membership";
import {
  canTransition,
  checkEligibility,
  allFixturesDecided,
  registrationOpen,
  validateCompetitionConfig,
} from "@/lib/competition";
import { buildCompetitionDetail, type CompetitionDetail, type CompetitionSummary } from "@/lib/competition-view";

/**
 * TRIQ Play server actions (docs/specs/03-triq-play.md). Every query is scoped to the caller's org.
 * Writes that touch one competition take a per-competition advisory lock, so registrations can't
 * overshoot capacity and bracket advancement can't interleave. Result writes also carry the fixture's
 * `version` (optimistic concurrency) so a stale screen can't overwrite a newer result.
 */

type Fail = { success: false; error: string };
const OFF: Fail = { success: false, error: "Competitions aren't enabled for this academy yet." };
const STALE = "This match was updated by someone else. Reload and try again.";

class ActionError extends Error {}

async function lockCompetition(tx: Prisma.TransactionClient, competitionId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"competition:" + competitionId}))`;
}

function fail(e: unknown, fallback: string): Fail {
  if (e instanceof ActionError) return { success: false, error: e.message };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { success: false, error: "That name, player or seed is already used in this competition." };
  }
  console.error(`[competitions] ${fallback}:`, e instanceof Error ? e.message : e);
  return { success: false, error: fallback };
}

async function manager() {
  if (!FEATURES.events) return { ok: false as const, error: OFF.error };
  return checkPermission("competitions.manage");
}

// ───────────────────────────── reads ─────────────────────────────

export async function listCompetitions(): Promise<{ success: true; competitions: CompetitionSummary[] } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;
  const rows = await db.competition.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { entries: { where: { status: "REGISTERED" } } } } },
  });
  return {
    success: true,
    competitions: rows.map((c) => ({
      id: c.id,
      name: c.name,
      sport: c.sport,
      format: c.format,
      entryType: c.entryType,
      status: c.status,
      startDate: c.startDate ? c.startDate.toISOString().slice(0, 10) : null,
      maxEntries: c.maxEntries,
      entryCount: c._count.entries,
    })),
  };
}

export async function getCompetition(id: string): Promise<{ success: true; competition: CompetitionDetail } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;
  const c = await db.competition.findFirst({ where: { id: String(id ?? ""), orgId } });
  if (!c) return { success: false, error: "Competition not found." };
  const [entries, fixtures, members] = await Promise.all([
    db.competitionEntry.findMany({ where: { competitionId: c.id, orgId }, orderBy: { createdAt: "asc" } }),
    db.fixture.findMany({ where: { competitionId: c.id, orgId } }),
    db.orgMembership.findMany({
      where: { orgId, status: "ACTIVE" },
      select: { userId: true, user: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
      take: 200,
    }),
  ]);
  const officials = members.map((m) => ({ userId: m.userId, name: m.user.name }));
  return { success: true, competition: buildCompetitionDetail(c, entries, fixtures, officials, true) };
}

/** Students of this academy matching a name, for individual registration (names only). */
export async function searchCompetitionStudents(query: string): Promise<{ success: true; students: { id: string; name: string }[] } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const q = String(query ?? "").trim().slice(0, 60);
  const students = await db.student.findMany({
    where: { orgId: auth.session.orgId, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return { success: true, students };
}

// ───────────────────────────── competition ─────────────────────────────

async function checkBatch(orgId: string, batchId: string | null) {
  if (!batchId) return true;
  return Boolean(await db.batch.findFirst({ where: { id: batchId, orgId }, select: { id: true } }));
}

export async function createCompetition(input: Record<string, unknown>): Promise<{ success: true; id: string } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateCompetitionConfig(input ?? {});
  if (!v.ok) return { success: false, error: v.error };
  if (!(await checkBatch(session.orgId, v.value.eligibleBatchId))) return { success: false, error: "Batch not found." };
  try {
    const c = await db.$transaction(async (tx) => {
      const created = await tx.competition.create({ data: { ...v.value, orgId: session.orgId, createdById: session.id }, select: { id: true } });
      await tx.auditLog.create({
        data: { userId: session.id, orgId: session.orgId, action: "COMPETITION_CREATED", details: JSON.stringify({ competitionId: created.id, name: v.value.name, format: v.value.format }) },
      });
      return created;
    });
    return { success: true, id: c.id };
  } catch (e) {
    return fail(e, "Couldn't create the competition.");
  }
}

export async function updateCompetition(id: string, input: Record<string, unknown>): Promise<{ success: true } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateCompetitionConfig(input ?? {});
  if (!v.ok) return { success: false, error: v.error };
  if (!(await checkBatch(session.orgId, v.value.eligibleBatchId))) return { success: false, error: "Batch not found." };
  try {
    await db.$transaction(async (tx) => {
      await lockCompetition(tx, String(id));
      const c = await tx.competition.findFirst({ where: { id: String(id), orgId: session.orgId } });
      if (!c) throw new ActionError("Competition not found.");
      if (!registrationOpen(c.status)) throw new ActionError("Settings can't change once fixtures are generated.");
      const registered = await tx.competitionEntry.count({ where: { competitionId: c.id, status: "REGISTERED" } });
      if (v.value.maxEntries < registered) throw new ActionError(`${registered} entries are already registered.`);
      if (v.value.entryType !== c.entryType && registered > 0) throw new ActionError("Entry type can't change after entries are registered.");
      await tx.competition.update({ where: { id: c.id }, data: v.value });
      await tx.auditLog.create({ data: { userId: session.id, orgId: session.orgId, action: "COMPETITION_UPDATED", details: JSON.stringify({ competitionId: c.id }) } });
    });
    return { success: true };
  } catch (e) {
    return fail(e, "Couldn't save the competition.");
  }
}

export async function setCompetitionStatus(id: string, status: string): Promise<{ success: true } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    await db.$transaction(async (tx) => {
      await lockCompetition(tx, String(id));
      const c = await tx.competition.findFirst({ where: { id: String(id), orgId: session.orgId } });
      if (!c) throw new ActionError("Competition not found.");
      const fixtures = await tx.fixture.findMany({ where: { competitionId: c.id }, select: { status: true } });
      const t = canTransition(c.status, String(status), { hasFixtures: fixtures.length > 0, allDecided: allFixturesDecided(fixtures) });
      if (!t.ok) throw new ActionError(t.error);
      await tx.competition.update({ where: { id: c.id }, data: { status: String(status) } });
      await tx.auditLog.create({
        data: { userId: session.id, orgId: session.orgId, action: `COMPETITION_STATUS_${status}`, details: JSON.stringify({ competitionId: c.id, from: c.status }) },
      });
    });
    return { success: true };
  } catch (e) {
    return fail(e, "Couldn't change the status.");
  }
}

// ───────────────────────────── entries ─────────────────────────────

export async function registerEntry(
  competitionId: string,
  input: { name?: string; studentId?: string; batchId?: string; seed?: number | string | null }
): Promise<{ success: true; id: string } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  const seedRaw = input?.seed;
  const seed = seedRaw === null || seedRaw === undefined || seedRaw === "" ? null : Number(seedRaw);
  if (seed !== null && !(Number.isInteger(seed) && seed >= 1 && seed <= 128)) return { success: false, error: "Seed must be a whole number from 1 to 128." };

  try {
    const id = await db.$transaction(async (tx) => {
      await lockCompetition(tx, String(competitionId));
      const c = await tx.competition.findFirst({ where: { id: String(competitionId), orgId } });
      if (!c) throw new ActionError("Competition not found.");
      if (!registrationOpen(c.status)) throw new ActionError("Registration is closed for this competition.");

      const registered = await tx.competitionEntry.count({ where: { competitionId: c.id, status: "REGISTERED" } });
      if (registered >= c.maxEntries) throw new ActionError(`This competition is full (${c.maxEntries} entries).`);
      if (seed !== null) {
        const taken = await tx.competitionEntry.findFirst({ where: { competitionId: c.id, status: "REGISTERED", seed }, select: { id: true } });
        if (taken) throw new ActionError(`Seed ${seed} is already taken.`);
      }

      let name: string;
      let studentId: string | null = null;
      let batchId: string | null = null;
      if (c.entryType === "INDIVIDUAL") {
        const student = await tx.student.findFirst({
          where: { id: String(input?.studentId ?? ""), orgId },
          select: { id: true, name: true, dob: true, enrollments: { select: { batchId: true } } },
        });
        if (!student) throw new ActionError("Pick a student from your academy.");
        const verdict = checkEligibility(
          { minAge: c.minAge, maxAge: c.maxAge, ageCutoffDate: c.ageCutoffDate, eligibleBatchId: c.eligibleBatchId },
          { dob: student.dob, batchIds: student.enrollments.map((e) => e.batchId) }
        );
        if (!verdict.ok) throw new ActionError(verdict.error);
        studentId = student.id;
        name = student.name.trim().slice(0, 60);
        const previous = await tx.competitionEntry.findFirst({ where: { competitionId: c.id, studentId } });
        if (previous) {
          if (previous.status === "REGISTERED") throw new ActionError(`${name} is already registered.`);
          await tx.competitionEntry.update({ where: { id: previous.id }, data: { status: "REGISTERED", seed } });
          await tx.auditLog.create({ data: { userId: session.id, orgId, action: "COMPETITION_ENTRY_REGISTERED", details: JSON.stringify({ competitionId: c.id, entryId: previous.id, rejoined: true }) } });
          return previous.id;
        }
        // Two students can share a name: keep entry names unique without exposing anything else.
        const base = name;
        for (let n = 2; await tx.competitionEntry.findFirst({ where: { competitionId: c.id, name }, select: { id: true } }); n++) {
          name = `${base} (${n})`;
        }
      } else {
        name = String(input?.name ?? "").trim().replace(/\s+/g, " ");
        if (name.length < 2 || name.length > 60) throw new ActionError("Team name must be 2–60 characters.");
        batchId = String(input?.batchId ?? "").trim() || null;
        if (batchId && !(await tx.batch.findFirst({ where: { id: batchId, orgId }, select: { id: true } }))) throw new ActionError("Batch not found.");
        const same = await tx.competitionEntry.findFirst({ where: { competitionId: c.id, name: { equals: name, mode: "insensitive" } } });
        if (same) {
          if (same.status === "REGISTERED") throw new ActionError("A team with this name is already registered.");
          await tx.competitionEntry.update({ where: { id: same.id }, data: { status: "REGISTERED", seed, batchId } });
          await tx.auditLog.create({ data: { userId: session.id, orgId, action: "COMPETITION_ENTRY_REGISTERED", details: JSON.stringify({ competitionId: c.id, entryId: same.id, rejoined: true }) } });
          return same.id;
        }
      }

      const entry = await tx.competitionEntry.create({
        data: { orgId, competitionId: c.id, name, studentId, batchId, seed, registeredById: session.id },
        select: { id: true },
      });
      await tx.auditLog.create({ data: { userId: session.id, orgId, action: "COMPETITION_ENTRY_REGISTERED", details: JSON.stringify({ competitionId: c.id, entryId: entry.id }) } });
      return entry.id;
    });
    return { success: true, id };
  } catch (e) {
    return fail(e, "Couldn't register the entry.");
  }
}

export async function withdrawEntry(entryId: string): Promise<{ success: true } | Fail> {
  const auth = await manager();
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const entry = await db.competitionEntry.findFirst({ where: { id: String(entryId), orgId: session.orgId }, select: { id: true, competitionId: true } });
    if (!entry) return { success: false, error: "Entry not found." };
    await db.$transaction(async (tx) => {
      await lockCompetition(tx, entry.competitionId);
      const c = await tx.competition.findFirst({ where: { id: entry.competitionId, orgId: session.orgId }, select: { status: true } });
      if (!c || !registrationOpen(c.status)) throw new ActionError("Entries can't be withdrawn after fixtures are generated.");
      const res = await tx.competitionEntry.updateMany({ where: { id: entry.id, status: "REGISTERED" }, data: { status: "WITHDRAWN", seed: null } });
      if (res.count === 0) throw new ActionError("This entry is already withdrawn.");
      await tx.auditLog.create({ data: { userId: session.id, orgId: session.orgId, action: "COMPETITION_ENTRY_WITHDRAWN", details: JSON.stringify({ competitionId: entry.competitionId, entryId: entry.id }) } });
    });
    return { success: true };
  } catch (e) {
    return fail(e, "Couldn't withdraw the entry.");
  }
}

// Draws, scheduling and results live in src/app/actions/fixtures.ts (one place for fixtures).

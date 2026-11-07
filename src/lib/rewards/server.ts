// TRIQ Rewards: DB-backed helpers. SERVER ONLY (imports the Prisma client). Not a "use server" file on
// purpose: nothing here is callable from the browser. Every function checks FEATURES.rewards first and
// does nothing while the flag is off (the tables don't exist in production until then).
//
// Hooks: call `awardForSource` from server code that records a source event, e.g. after attendance is
// saved, a drill is marked, a match result is logged, a personal best is verified or a skill report is
// saved. It is idempotent per (source, student), so it is safe to call again on retries or re-saves.
// It never throws: failures come back as { ok: false } and are logged.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import {
  capPoints,
  EARN_SOURCE_TYPES,
  isEarnTrigger,
  monthWindow,
  TRIGGER_SOURCE_TYPE,
  SOURCE,
  type EarnTrigger,
} from "./rules";
import { earnKey, expiringSoon, expiryRowsDue, EXPIRY_WARNING_DAYS, pointsExpiryFor, type PointsRow } from "./ledger";
import { xpReasonCode } from "./levels";
import { badgeStats, badgesToAward, GLOBAL_BADGES, tagsNote } from "./badges";
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_ACTION, type RewardsSettings } from "./settings";

export const REWARDS_DISABLED = "Rewards are not switched on for this academy yet";

type Tx = Prisma.TransactionClient;
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 };

const isKnown = (e: unknown, code: string) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
/** Serialization conflicts (P2034) are retried; everything else propagates. */
export async function withSerializable<T>(fn: (tx: Tx) => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await db.$transaction(fn, SERIALIZABLE);
    } catch (e) {
      if (i < attempts && isKnown(e, "P2034")) continue;
      throw e;
    }
  }
}
export const isUniqueViolation = (e: unknown) => isKnown(e, "P2002");

// ── Settings, time zone, audit ──────────────────────────────────────────────

export async function loadRewardsSettings(orgId: string): Promise<RewardsSettings> {
  if (!FEATURES.rewards) return DEFAULT_SETTINGS;
  const row = await db.auditLog.findFirst({
    where: { orgId, action: SETTINGS_ACTION },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });
  return row ? parseSettings(row.details) : DEFAULT_SETTINGS;
}

export async function orgTimezone(orgId: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  return org?.timezone || "Asia/Kolkata";
}

export async function writeAudit(client: Tx | typeof db, a: { userId: string; orgId: string; action: string; details: Record<string, unknown> }) {
  await client.auditLog.create({ data: { userId: a.userId, orgId: a.orgId, action: a.action, details: JSON.stringify(a.details) } });
}

// ── Awards ──────────────────────────────────────────────────────────────────

export type AwardResult =
  | { ok: true; status: "AWARDED" | "DUPLICATE" | "DISABLED" | "NOTHING"; xp: number; points: number; capped: boolean }
  | { ok: false; error: string };

export class CapRefused extends Error {}

/** Internal: writes one award (XP + points) after caps. Used by awardForSource and the coach bonus actions. */
export async function recordAward(a: {
  orgId: string;
  studentId: string;
  trigger: EarnTrigger;
  sourceId: string;
  sport?: string | null;
  xp: number;
  points: number;
  note?: string | null;
  reasonCode?: string;
  createdById?: string | null;
  /** Coach bonus: refuse instead of trimming when the monthly cap would cut it. */
  refuseIfCapped?: boolean;
  now?: Date;
}): Promise<AwardResult> {
  if (!FEATURES.rewards) return { ok: true, status: "DISABLED", xp: 0, points: 0, capped: false };
  const now = a.now ?? new Date();
  const key = earnKey(a.trigger, a.sourceId, a.studentId);
  const [px, pp] = await Promise.all([
    db.xpLedger.findUnique({ where: { idempotencyKey: key }, select: { id: true } }),
    db.pointsLedger.findUnique({ where: { idempotencyKey: key }, select: { id: true } }),
  ]);
  if (px || pp) return { ok: true, status: "DUPLICATE", xp: 0, points: 0, capped: false };

  const { start, end } = monthWindow(now, await orgTimezone(a.orgId));
  const sourceType = TRIGGER_SOURCE_TYPE[a.trigger];
  try {
    return await withSerializable(async (tx) => {
      const base = { orgId: a.orgId, studentId: a.studentId, delta: { gt: 0 }, createdAt: { gte: start, lt: end } };
      const [all, att] = await Promise.all([
        tx.pointsLedger.aggregate({ _sum: { delta: true }, where: { ...base, sourceType: { in: [...EARN_SOURCE_TYPES] } } }),
        tx.pointsLedger.aggregate({ _sum: { delta: true }, where: { ...base, sourceType: TRIGGER_SOURCE_TYPE.SESSION_ATTENDED } }),
      ]);
      const cap = capPoints(a.points, a.trigger, all._sum.delta ?? 0, att._sum.delta ?? 0);
      if (a.refuseIfCapped && cap.capped) throw new CapRefused("This player has reached the monthly points cap");
      const xp = Math.max(0, Math.trunc(a.xp));
      if (xp > 0) {
        await tx.xpLedger.create({
          data: {
            orgId: a.orgId,
            studentId: a.studentId,
            delta: xp,
            sourceType,
            sourceRef: a.sourceId,
            reasonCode: xpReasonCode(a.trigger, a.sport),
            note: a.note ?? null,
            createdById: a.createdById ?? null,
            createdAt: now,
            idempotencyKey: key,
          },
        });
      }
      if (cap.granted > 0) {
        await tx.pointsLedger.create({
          data: {
            orgId: a.orgId,
            studentId: a.studentId,
            delta: cap.granted,
            sourceType,
            sourceRef: a.sourceId,
            reasonCode: a.reasonCode ?? a.trigger,
            note: a.note ?? null,
            createdById: a.createdById ?? null,
            createdAt: now,
            expiresAt: pointsExpiryFor(now),
            idempotencyKey: key,
          },
        });
      }
      const status = xp > 0 || cap.granted > 0 ? "AWARDED" : "NOTHING";
      return { ok: true as const, status, xp, points: cap.granted, capped: cap.capped };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, status: "DUPLICATE", xp: 0, points: 0, capped: false };
    if (e instanceof CapRefused) return { ok: false, error: e.message };
    throw e;
  }
}

/**
 * Idempotent award for an automatic source event. Values come from the academy's earn rules (never
 * from the caller), points are trimmed to the monthly caps, XP is not capped. Coach bonuses don't go
 * through here (they need a person, a reason and the review rules: see coachBonus in actions/rewards).
 * There is deliberately no trigger for a missed session.
 *
 *   attendance → { trigger: "SESSION_ATTENDED", sourceId: sessionId }   (only for PRESENT/LATE rows)
 *   drill      → { trigger: "DRILL_COMPLETED",  sourceId: drill-mark id }
 *   match      → { trigger: "MATCH_PLAYED", sourceId: matchId, tags?: ["CLEAN_SHEET" | "ALL_ROUND"] }
 *                + { trigger: "MATCH_WON", sourceId: matchId } for the winner
 *   PB         → { trigger: "PERSONAL_BEST", sourceId: performance result id }
 *   assessment → { trigger: "SKILL_IMPROVED", sourceId: skill report id } when it beats the previous one
 */
export async function awardForSource(input: {
  orgId: string;
  studentId: string;
  trigger: Exclude<EarnTrigger, "COACH_BONUS">;
  sourceId: string;
  sport?: string | null;
  tags?: string[];
  createdById?: string | null;
}): Promise<AwardResult> {
  if (!FEATURES.rewards) return { ok: true, status: "DISABLED", xp: 0, points: 0, capped: false };
  try {
    if (!isEarnTrigger(input.trigger) || input.trigger === ("COACH_BONUS" as EarnTrigger)) return { ok: false, error: "Unknown trigger" };
    const student = await db.student.findFirst({ where: { id: input.studentId, orgId: input.orgId }, select: { id: true } });
    if (!student) return { ok: false, error: "Student not found" };
    const rule = (await loadRewardsSettings(input.orgId)).earnRules[input.trigger];
    const r = await recordAward({
      orgId: input.orgId,
      studentId: input.studentId,
      trigger: input.trigger,
      sourceId: input.sourceId,
      sport: input.sport,
      xp: rule.xp,
      points: rule.points,
      note: tagsNote(input.tags),
      createdById: input.createdById ?? null,
    });
    if (r.ok && r.status === "AWARDED") await evaluateBadges(input.orgId, input.studentId).catch((e) => console.error("rewards: badge check failed", e));
    return r;
  } catch (e) {
    console.error("rewards: awardForSource failed", input.trigger, e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not record the award" };
  }
}

// ── Badges ──────────────────────────────────────────────────────────────────

let globalBadgesReady: Promise<void> | null = null;

/** Creates the TRIQ library badges (orgId null) once per process. */
export function ensureGlobalBadges(): Promise<void> {
  if (!FEATURES.rewards) return Promise.resolve();
  globalBadgesReady ??= (async () => {
    const have = await db.badgeDefinition.findMany({ where: { orgId: null }, select: { key: true } });
    const keys = new Set(have.map((h) => h.key));
    for (const b of GLOBAL_BADGES) {
      if (keys.has(b.key)) continue;
      await db.badgeDefinition.create({
        data: { orgId: null, key: b.key, name: b.name, description: b.description, icon: b.icon, rule: (b.rule ?? Prisma.JsonNull) as Prisma.InputJsonValue },
      });
    }
  })().catch((e) => {
    globalBadgesReady = null;
    throw e;
  });
  return globalBadgesReady;
}

/** Badge definitions visible to an academy (library + its own), one per key (academy's own wins). */
export async function badgeDefinitionsFor(orgId: string) {
  await ensureGlobalBadges();
  const defs = await db.badgeDefinition.findMany({
    where: { active: true, OR: [{ orgId: null }, { orgId }] },
    orderBy: { createdAt: "asc" },
  });
  const byKey = new Map<string, (typeof defs)[number]>();
  for (const d of defs) if (!byKey.has(d.key) || d.orgId) byKey.set(d.key, d);
  return [...byKey.values()];
}

/** Auto-awards any rule badges the child has now earned. Never revokes. */
export async function evaluateBadges(orgId: string, studentId: string): Promise<number> {
  if (!FEATURES.rewards) return 0;
  const [defs, held, xpRows, attendance] = await Promise.all([
    badgeDefinitionsFor(orgId),
    db.studentBadge.findMany({ where: { studentId }, select: { badge: { select: { key: true } } } }),
    db.xpLedger.findMany({ where: { orgId, studentId }, select: { delta: true, reasonCode: true, note: true } }),
    db.attendance.findMany({
      where: { studentId, session: { orgId } },
      select: { isPresent: true, status: true, session: { select: { date: true, status: true } } },
    }),
  ]);
  const stats = badgeStats(
    xpRows,
    attendance.map((a) => ({ isPresent: a.isPresent, status: a.status, date: a.session.date, sessionStatus: a.session.status })),
  );
  const toAward = badgesToAward(defs, stats, new Set(held.map((h) => h.badge.key)));
  if (!toAward.length) return 0;
  const r = await db.studentBadge.createMany({
    data: toAward.map((d) => ({ orgId, studentId, badgeId: d.id, awardedById: null, reason: null })),
    skipDuplicates: true,
  });
  return r.count;
}

// ── Points rows, expiry ─────────────────────────────────────────────────────

export async function loadPointsRows(client: Tx | typeof db, orgId: string, studentId: string): Promise<PointsRow[]> {
  return client.pointsLedger.findMany({
    where: { orgId, studentId },
    select: { id: true, delta: true, sourceType: true, sourceRef: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Writes the negative EXPIRY rows due now for one academy. Idempotent (one key per expired lot). */
export async function runExpiryForOrg(orgId: string, now = new Date()): Promise<{ students: number; rows: number; points: number }> {
  if (!FEATURES.rewards) return { students: 0, rows: 0, points: 0 };
  const due = await db.pointsLedger.findMany({
    where: { orgId, delta: { gt: 0 }, expiresAt: { lte: now } },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  let rows = 0;
  let points = 0;
  for (const { studentId } of due) {
    const data = expiryRowsDue(await loadPointsRows(db, orgId, studentId), now);
    if (!data.length) continue;
    const r = await db.pointsLedger.createMany({
      data: data.map((d) => ({
        orgId,
        studentId,
        delta: d.delta,
        sourceType: SOURCE.EXPIRY,
        sourceRef: d.lotId,
        reasonCode: "expired",
        createdById: null,
        createdAt: now,
        idempotencyKey: d.idempotencyKey,
      })),
      skipDuplicates: true,
    });
    rows += r.count;
    if (r.count === data.length) points += data.reduce((s, d) => s - d.delta, 0);
  }
  return { students: due.length, rows, points };
}

/** Expiry for every academy with points due. Used by the cron route. */
export async function runExpiryAll(now = new Date()) {
  if (!FEATURES.rewards) return { orgs: 0, students: 0, rows: 0, points: 0, failed: 0 };
  const orgs = await db.pointsLedger.findMany({ where: { delta: { gt: 0 }, expiresAt: { lte: now } }, select: { orgId: true }, distinct: ["orgId"] });
  const total = { orgs: orgs.length, students: 0, rows: 0, points: 0, failed: 0 };
  for (const { orgId } of orgs) {
    try {
      const r = await runExpiryForOrg(orgId, now);
      total.students += r.students;
      total.rows += r.rows;
      total.points += r.points;
    } catch (e) {
      total.failed++;
      console.error("rewards expiry: org failed", orgId, e instanceof Error ? e.message : e);
    }
  }
  return total;
}

/**
 * Children with points expiring in the next 30 days (for the parent warning). Returns the list only:
 * sending is not wired yet (no delivery channel for rewards in v1); the parent card shows the warning.
 */
export async function expiryWarningsForOrg(orgId: string, now = new Date()) {
  if (!FEATURES.rewards) return [];
  const until = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  const ids = await db.pointsLedger.findMany({
    where: { orgId, delta: { gt: 0 }, expiresAt: { gt: now, lte: until } },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  const out: { studentId: string; amount: number; firstAt: Date }[] = [];
  for (const { studentId } of ids) {
    const s = expiringSoon(await loadPointsRows(db, orgId, studentId), now);
    if (s.amount > 0 && s.firstAt) out.push({ studentId, amount: s.amount, firstAt: s.firstAt });
  }
  return out;
}

/**
 * Deletion path (docs/TRIQ_DATA_PRIVACY.md §8): removes a student's rewards rows. Not wired yet;
 * src/app/actions/delete.ts should call this when it deletes a student (outside this feature's files).
 */
export async function deleteRewardsDataForStudent(orgId: string, studentId: string) {
  if (!FEATURES.rewards) return;
  await db.$transaction([
    db.studentBadge.deleteMany({ where: { orgId, studentId } }),
    db.leaderboardOptIn.deleteMany({ where: { orgId, studentId } }),
    db.redemption.deleteMany({ where: { orgId, studentId } }),
    db.pointsLedger.deleteMany({ where: { orgId, studentId } }),
    db.xpLedger.deleteMany({ where: { orgId, studentId } }),
  ]);
}

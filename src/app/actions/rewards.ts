"use server";
// TRIQ Rewards server actions (spec §3–9). Every action checks FEATURES.rewards first and returns
// { ok: false } while it is off, so no rewards table is touched before it exists in production.
//
// Access:
//   parent   → only their own children (Student.parentId); can view, redeem, cancel own requests, opt in.
//              Parents can never award points or XP.
//   coach    → only students in batches they coach (Batch.coachId); bonus, coach badges, approve/decline/fulfil.
//   owner / manager → their academy; catalogue, settings, reviews, expiry, budget.
//   Fee-credit rewards: owner only, and only after the owner opts in. Nothing here writes fee tables.
//
// The automatic award hook (awardForSource) lives in src/lib/rewards/server.ts, not here: anything
// exported from a "use server" file is callable from the browser, and automatic awards must not be.

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getSession } from "@/lib/auth";
import { requireMember } from "@/lib/membership";
import { normalizeSport, summarizeAttendance } from "@/lib/athlete/passport-build";
import {
  BONUS_REASONS,
  CAPS,
  checkCoachBonus,
  COACH_BADGE_KEYS,
  canCoachAwardBadge,
  DAY_MS,
  EARN_LABELS,
  EARN_RULE_CEILINGS,
  EARN_SOURCE_TYPES,
  eligibilityProblems,
  expiringSoon,
  isBonusReason,
  isEarnTrigger,
  levelsBySport,
  monthWindow,
  nextStatus,
  parseEligibility,
  parseRewardItemInput,
  parseSettings,
  parseXpReason,
  redeemKey,
  refundExpiry,
  refundKey,
  restocksOn,
  simulatePoints,
  SETTINGS_ACTION,
  SOURCE,
  SUGGESTED_ITEMS,
  termOf,
  topXpLevel,
  buildLeaderboard,
  REWARD_KIND_LABELS,
  type RedemptionAction,
  type RewardsSettings,
} from "@/lib/rewards";
import {
  badgeDefinitionsFor,
  isUniqueViolation,
  loadPointsRows,
  loadRewardsSettings,
  orgTimezone,
  recordAward,
  REWARDS_DISABLED,
  runExpiryForOrg,
  withSerializable,
  writeAudit,
} from "@/lib/rewards/server";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const OFF = fail(REWARDS_DISABLED);

/** Thrown inside transactions to roll back with a message safe to show. */
class UserError extends Error {}

const ACCESS_ERRORS = new Set(["No academy found", "You are not an active member of this academy", "You don't have permission to do this"]);

type Staff = { userId: string; orgId: string; role: "OWNER" | "MANAGER" | "COACH"; isOwner: boolean; isManager: boolean };

async function staffCtx(): Promise<{ ok: true; staff: Staff } | Fail> {
  try {
    const { session, membership } = await requireMember(["ADMIN", "COACH"]);
    const role = membership.role;
    if (role !== "OWNER" && role !== "MANAGER" && role !== "COACH") return fail("You don't have permission to do this");
    return { ok: true, staff: { userId: session.id, orgId: session.orgId, role, isOwner: role === "OWNER", isManager: role !== "COACH" } };
  } catch (e: any) {
    if (typeof e?.message === "string" && ACCESS_ERRORS.has(e.message)) return fail(e.message);
    throw e;
  }
}

async function managerCtx(): Promise<{ ok: true; staff: Staff } | Fail> {
  const c = await staffCtx();
  if (!c.ok) return c;
  return c.staff.isManager ? c : fail("Only the owner or a manager can do this");
}

/** Who is calling: a parent (own children only) or academy staff. */
async function viewerCtx(): Promise<{ ok: true; parentId: string } | { ok: true; staff: Staff; parentId?: undefined } | Fail> {
  const session = await getSession();
  if (!session) return fail("Please sign in");
  if (session.role === "PARENT") return { ok: true, parentId: String(session.id) };
  return staffCtx();
}

/** Coaches: students in batches they coach. Owners/managers: their academy. */
function staffStudentWhere(staff: Staff, studentId: string) {
  return staff.role === "COACH"
    ? { id: studentId, orgId: staff.orgId, enrollments: { some: { batch: { coachId: staff.userId, orgId: staff.orgId } } } }
    : { id: studentId, orgId: staff.orgId };
}

async function scopedStudent(v: { parentId: string } | { staff: Staff }, studentId: string) {
  if (typeof studentId !== "string" || !studentId) return null;
  const where = "staff" in v ? staffStudentWhere(v.staff, studentId) : { id: studentId, parentId: v.parentId };
  const s = await db.student.findFirst({
    where,
    select: { id: true, name: true, orgId: true, parentId: true, enrollments: { select: { batch: { select: { id: true, name: true, sport: true, coachId: true } } } } },
  });
  return s && s.orgId ? { ...s, orgId: s.orgId } : null;
}

function revalidate() {
  revalidatePath("/rewards");
  revalidatePath("/org/rewards");
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const safeRequestId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : crypto.randomUUID().replace(/-/g, ""));
const cleanNote = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null);
const parseJson = (s: string | null): Record<string, any> => {
  try {
    const o = s ? JSON.parse(s) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
};

async function attendanceRate(orgId: string, studentId: string, now: Date): Promise<number | null> {
  const rows = await db.attendance.findMany({
    where: { studentId, session: { orgId, date: { gte: new Date(now.getTime() - 90 * DAY_MS), lte: now } } },
    select: { isPresent: true, status: true, session: { select: { date: true, status: true } } },
  });
  return summarizeAttendance(
    rows.map((r) => ({ isPresent: r.isPresent, status: r.status, date: r.session.date, sessionStatus: r.session.status })),
    now,
  ).rate;
}

function historyLabel(kind: "points" | "xp", sourceType: string, reasonCode: string): string {
  if (sourceType === SOURCE.REDEMPTION) return "Reward requested";
  if (sourceType === SOURCE.REFUND) return "Points returned";
  if (sourceType === SOURCE.EXPIRY) return "Points expired";
  const trigger = kind === "xp" ? parseXpReason(reasonCode).trigger : reasonCode.split(":")[0];
  if (isEarnTrigger(trigger)) {
    const reason = kind === "points" ? reasonCode.split(":")[1] : undefined;
    return reason && reason in BONUS_REASONS ? `${EARN_LABELS[trigger]}: ${BONUS_REASONS[reason as keyof typeof BONUS_REASONS]}` : EARN_LABELS[trigger];
  }
  return "Award";
}

// ── Child card (parent and staff) ───────────────────────────────────────────

export async function getChildRewards(studentId: string) {
  if (!FEATURES.rewards) return OFF;
  const v = await viewerCtx();
  if (!v.ok) return v;
  const student = await scopedStudent(v, studentId);
  if (!student) return fail("Player not found");
  const { orgId } = student;
  const now = new Date();

  const [settings, pointsRows, xpRows, held, items, redemptions, optIn, rate] = await Promise.all([
    loadRewardsSettings(orgId),
    db.pointsLedger.findMany({
      where: { orgId, studentId: student.id },
      select: { id: true, delta: true, sourceType: true, sourceRef: true, reasonCode: true, note: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.xpLedger.findMany({
      where: { orgId, studentId: student.id },
      select: { id: true, delta: true, sourceType: true, reasonCode: true, note: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.studentBadge.findMany({
      where: { orgId, studentId: student.id, revokedAt: null },
      select: { awardedAt: true, reason: true, awardedById: true, badge: { select: { key: true, name: true, description: true, icon: true } } },
      orderBy: { awardedAt: "desc" },
    }),
    db.rewardItem.findMany({ where: { orgId, active: true }, orderBy: { costPoints: "asc" } }),
    db.redemption.findMany({ where: { orgId, studentId: student.id }, include: { rewardItem: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.leaderboardOptIn.findUnique({ where: { orgId_studentId: { orgId, studentId: student.id } } }),
    attendanceRate(orgId, student.id, now),
  ]);

  const state = simulatePoints(pointsRows, now);
  const soon = expiringSoon(pointsRows, now);
  const history = [
    ...pointsRows.slice(-60).map((r) => ({
      id: `p-${r.id}`,
      kind: "points" as const,
      at: r.createdAt.toISOString(),
      delta: r.delta,
      label: historyLabel("points", r.sourceType, r.reasonCode),
      note: r.note,
    })),
    ...xpRows.slice(-60).map((r) => ({
      id: `x-${r.id}`,
      kind: "xp" as const,
      at: r.createdAt.toISOString(),
      delta: r.delta,
      label: historyLabel("xp", r.sourceType, r.reasonCode),
      note: r.note && !r.note.startsWith("tags=") ? r.note : null,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 100);

  const catalogue = items
    .map((it) => {
      const e = parseEligibility(it.eligibility);
      const problems = eligibilityProblems(e, {
        active: it.active,
        costPoints: it.costPoints,
        stock: it.stock,
        balance: state.balance,
        level: topXpLevel(xpRows, e.sport),
        attendanceRate: rate,
        feeCreditsEnabled: settings.feeCreditsEnabled,
      });
      const pending = redemptions.some((r) => r.rewardItemId === it.id && r.status === "REQUESTED");
      return {
        id: it.id,
        name: it.name,
        description: it.description,
        costPoints: it.costPoints,
        kind: e.kind,
        kindLabel: REWARD_KIND_LABELS[e.kind],
        minLevel: e.minLevel ?? null,
        minAttendanceRate: e.minAttendanceRate ?? null,
        inStock: it.stock == null || it.stock > 0,
        problems: pending ? ["Already requested", ...problems] : problems,
      };
    })
    .filter((i) => i.kind !== "FEE_CREDIT" || settings.feeCreditsEnabled);

  return {
    ok: true as const,
    isParent: !("staff" in v),
    student: { id: student.id, name: student.name, batches: student.enrollments.map((e) => ({ id: e.batch.id, name: e.batch.name, sport: e.batch.sport })) },
    points: { balance: state.balance, expiringSoon: soon.amount, expiringFirstAt: iso(soon.firstAt) },
    levels: levelsBySport(xpRows, settings.tierNames),
    badges: held.map((b) => ({ key: b.badge.key, name: b.badge.name, description: b.badge.description, icon: b.badge.icon, awardedAt: b.awardedAt.toISOString(), reason: b.reason, byCoach: b.awardedById != null })),
    catalogue,
    redemptions: redemptions.map((r) => ({ id: r.id, item: r.rewardItem.name, costPoints: r.costPoints, status: r.status, createdAt: r.createdAt.toISOString(), cancelReason: r.cancelReason })),
    history,
    leaderboardOptIn: !!optIn && optIn.optedOutAt == null,
    attendanceRate: rate,
  };
}

// ── Coach bonus ─────────────────────────────────────────────────────────────

type PendingBonus = { id: string; createdAt: string; studentId: string; points: number; xp: number; reason: string; note: string | null; coachId: string; requestId: string; sport: string | null };

async function unresolvedPending(orgId: string, now = new Date()): Promise<PendingBonus[]> {
  const since = new Date(now.getTime() - 60 * DAY_MS);
  const [pend, done] = await Promise.all([
    db.auditLog.findMany({ where: { orgId, action: "REWARDS_BONUS_PENDING", createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.auditLog.findMany({ where: { orgId, action: "REWARDS_BONUS_REVIEWED", createdAt: { gte: since } }, select: { details: true } }),
  ]);
  const resolved = new Set(done.map((d) => parseJson(d.details).pendingId).filter(Boolean));
  return pend
    .filter((p) => !resolved.has(p.id))
    .map((p) => {
      const d = parseJson(p.details);
      return {
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        studentId: String(d.studentId ?? ""),
        points: Number(d.points) || 0,
        xp: Number(d.xp) || 0,
        reason: String(d.reason ?? ""),
        note: typeof d.note === "string" ? d.note : null,
        coachId: String(d.coachId ?? p.userId),
        requestId: String(d.requestId ?? ""),
        sport: typeof d.sport === "string" ? d.sport : null,
      };
    });
}

async function bonusUsage(orgId: string, coachId: string, studentId: string, now: Date) {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const { start, end } = monthWindow(now, await orgTimezone(orgId));
  const [week, dayAwards, month, pending] = await Promise.all([
    db.pointsLedger.aggregate({ _sum: { delta: true }, where: { orgId, studentId, sourceType: "MANUAL", createdById: coachId, delta: { gt: 0 }, createdAt: { gte: weekAgo } } }),
    db.auditLog.count({ where: { orgId, userId: coachId, action: "REWARDS_MANUAL_AWARD", createdAt: { gte: dayAgo } } }),
    db.pointsLedger.aggregate({ _sum: { delta: true }, where: { orgId, studentId, delta: { gt: 0 }, sourceType: { in: [...EARN_SOURCE_TYPES] }, createdAt: { gte: start, lt: end } } }),
    unresolvedPending(orgId, now),
  ]);
  const mine = pending.filter((p) => p.coachId === coachId);
  const pendWeek = mine.filter((p) => p.studentId === studentId && new Date(p.createdAt) >= weekAgo).reduce((s, p) => s + p.points, 0);
  const pendDay = mine.filter((p) => new Date(p.createdAt) >= dayAgo).length;
  return {
    weekPointsByCoach: (week._sum.delta ?? 0) + pendWeek,
    awardsByCoachToday: dayAwards + pendDay,
    monthRoom: Math.max(0, CAPS.pointsPerMonth - (month._sum.delta ?? 0)),
    pending: mine,
  };
}

/** Caps shown on the coach award sheet before they choose an amount. */
export async function getCoachBonusAllowance(studentId: string) {
  if (!FEATURES.rewards) return OFF;
  const c = await staffCtx();
  if (!c.ok) return c;
  const student = await scopedStudent(c, studentId);
  if (!student) return fail("Player not found");
  const settings = await loadRewardsSettings(student.orgId);
  const u = await bonusUsage(student.orgId, c.staff.userId, student.id, new Date());
  const rule = settings.earnRules.COACH_BONUS;
  return {
    ok: true as const,
    maxPoints: Math.min(rule.points, CAPS.coachBonusPointsPerAward),
    maxXp: Math.min(rule.xp, CAPS.coachBonusXpPerAward),
    weekLeft: Math.max(0, CAPS.coachBonusPointsPerWeek - u.weekPointsByCoach),
    monthRoom: u.monthRoom,
    reviewAtPoints: CAPS.reviewAtPoints,
    awardsToday: u.awardsByCoachToday,
    reviewable: c.staff.role === "COACH",
    reasons: Object.entries(BONUS_REASONS).map(([key, label]) => ({ key, label })),
  };
}

/**
 * A coach (or owner/manager) gives a bonus with a reason. Caps are enforced here, not just in the UI;
 * over a cap is refused. A coach's big award or 3rd award in a day is held for owner review instead of
 * being written. Retries with the same requestId never double-award.
 */
export async function coachBonus(input: { studentId: string; points: number; xp?: number; reason: string; note?: string; requestId?: string; sport?: string }) {
  if (!FEATURES.rewards) return OFF;
  const c = await staffCtx();
  if (!c.ok) return c;
  const { staff } = c;
  const student = await scopedStudent(c, input?.studentId);
  if (!student) return fail("Player not found");
  if (student.parentId === staff.userId) return fail("You can't award points to your own child");
  if (!isBonusReason(input.reason)) return fail("Pick a reason");
  const note = cleanNote(input.note);
  const requestId = safeRequestId(input.requestId);
  const now = new Date();
  const settings = await loadRewardsSettings(student.orgId);
  const usage = await bonusUsage(student.orgId, staff.userId, student.id, now);
  if (usage.pending.some((p) => p.requestId === requestId)) return { ok: true as const, status: "PENDING_REVIEW" as const };

  const check = checkCoachBonus({
    points: input.points,
    xp: input.xp,
    rule: settings.earnRules.COACH_BONUS,
    weekPointsByCoach: usage.weekPointsByCoach,
    awardsByCoachToday: usage.awardsByCoachToday,
    monthRoom: usage.monthRoom,
    reviewable: staff.role === "COACH",
  });
  if (!check.ok) return check;

  const ownBatch = student.enrollments.find((e) => staff.role !== "COACH" || e.batch.coachId === staff.userId);
  const sport = normalizeSport(input.sport) || normalizeSport(ownBatch?.batch.sport) || null;

  if (check.needsReview) {
    await writeAudit(db, {
      userId: staff.userId,
      orgId: student.orgId,
      action: "REWARDS_BONUS_PENDING",
      details: { studentId: student.id, points: check.points, xp: check.xp, reason: input.reason, note, coachId: staff.userId, requestId, sport },
    });
    revalidate();
    return { ok: true as const, status: "PENDING_REVIEW" as const };
  }

  const r = await recordAward({
    orgId: student.orgId,
    studentId: student.id,
    trigger: "COACH_BONUS",
    sourceId: requestId,
    sport,
    xp: check.xp,
    points: check.points,
    note,
    reasonCode: `COACH_BONUS:${input.reason}`,
    createdById: staff.userId,
    refuseIfCapped: true,
    now,
  });
  if (!r.ok) return r;
  if (r.status === "AWARDED") {
    await writeAudit(db, {
      userId: staff.userId,
      orgId: student.orgId,
      action: "REWARDS_MANUAL_AWARD",
      details: { studentId: student.id, points: r.points, xp: r.xp, reason: input.reason, note, requestId },
    });
  }
  revalidate();
  return { ok: true as const, status: r.status === "DUPLICATE" ? ("DUPLICATE" as const) : ("AWARDED" as const), points: r.points, xp: r.xp };
}

/** Owner/manager: coach bonuses held for review. */
export async function listPendingBonuses() {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const pending = await unresolvedPending(c.staff.orgId);
  const ids = [...new Set(pending.flatMap((p) => [p.studentId, p.coachId]))];
  const [students, users] = await Promise.all([
    db.student.findMany({ where: { id: { in: ids }, orgId: c.staff.orgId }, select: { id: true, name: true } }),
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
  ]);
  const sn = new Map(students.map((s) => [s.id, s.name]));
  const un = new Map(users.map((u) => [u.id, u.name]));
  return {
    ok: true as const,
    pending: pending
      .filter((p) => sn.has(p.studentId))
      .map((p) => ({ ...p, studentName: sn.get(p.studentId)!, coachName: un.get(p.coachId) ?? "Coach", reasonLabel: BONUS_REASONS[p.reason as keyof typeof BONUS_REASONS] ?? p.reason })),
  };
}

export async function reviewBonus(pendingId: string, approve: boolean) {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const p = (await unresolvedPending(c.staff.orgId)).find((x) => x.id === pendingId);
  if (!p) return fail("This bonus was already reviewed");
  const student = await db.student.findFirst({ where: { id: p.studentId, orgId: c.staff.orgId }, select: { id: true, parentId: true } });
  if (!student) return fail("Player not found");
  if (approve && student.parentId === c.staff.userId) return fail("You can't approve a bonus for your own child");
  let awarded = { points: 0, xp: 0 };
  if (approve) {
    const r = await recordAward({
      orgId: c.staff.orgId,
      studentId: p.studentId,
      trigger: "COACH_BONUS",
      sourceId: p.id,
      sport: p.sport,
      xp: Math.min(p.xp, CAPS.coachBonusXpPerAward),
      points: Math.min(p.points, CAPS.coachBonusPointsPerAward),
      note: p.note,
      reasonCode: `COACH_BONUS:${p.reason}`,
      createdById: p.coachId,
      refuseIfCapped: true,
    });
    if (!r.ok) return r;
    awarded = { points: r.points, xp: r.xp };
  }
  await writeAudit(db, {
    userId: c.staff.userId,
    orgId: c.staff.orgId,
    action: "REWARDS_BONUS_REVIEWED",
    details: { pendingId: p.id, decision: approve ? "APPROVED" : "REJECTED", studentId: p.studentId, coachId: p.coachId, ...awarded },
  });
  revalidate();
  return { ok: true as const };
}

/** Coach-awarded badge ("Team player", "Most improved"): one per child per term, with a reason. */
export async function awardCoachBadge(input: { studentId: string; badgeKey: string; reason: string }) {
  if (!FEATURES.rewards) return OFF;
  const c = await staffCtx();
  if (!c.ok) return c;
  const student = await scopedStudent(c, input?.studentId);
  if (!student) return fail("Player not found");
  if (student.parentId === c.staff.userId) return fail("You can't award a badge to your own child");
  const reason = cleanNote(input.reason) ?? "";
  const term = termOf(new Date());
  const defs = await badgeDefinitionsFor(student.orgId);
  const def = defs.find((d) => d.key === input.badgeKey);
  if (!def) return fail("Badge not found");
  const [held, termCount] = await Promise.all([
    db.studentBadge.findFirst({ where: { studentId: student.id, badgeId: def.id }, select: { id: true } }),
    db.studentBadge.count({
      where: { studentId: student.id, awardedById: { not: null }, awardedAt: { gte: term.start, lt: term.end }, badge: { key: { in: COACH_BADGE_KEYS } } },
    }),
  ]);
  const ok = canCoachAwardBadge({ badgeKey: def.key, reason, coachAwardedThisTerm: termCount, alreadyHeld: !!held });
  if (!ok.ok) return ok;
  try {
    await db.studentBadge.create({ data: { orgId: student.orgId, studentId: student.id, badgeId: def.id, awardedById: c.staff.userId, reason } });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("This player already has that badge");
    throw e;
  }
  await writeAudit(db, { userId: c.staff.userId, orgId: student.orgId, action: "REWARDS_BADGE_AWARDED", details: { studentId: student.id, badge: def.key, reason, term: term.key } });
  revalidate();
  return { ok: true as const };
}

/** Players the caller may award to: a coach's own batches, or every batch for owners/managers. */
export async function getAwardRoster() {
  if (!FEATURES.rewards) return OFF;
  const c = await staffCtx();
  if (!c.ok) return c;
  const batches = await db.batch.findMany({
    where: { orgId: c.staff.orgId, ...(c.staff.role === "COACH" ? { coachId: c.staff.userId } : {}) },
    select: { id: true, name: true, sport: true, enrollments: { select: { student: { select: { id: true, name: true, parentId: true } } } } },
    orderBy: { name: "asc" },
  });
  return {
    ok: true as const,
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      sport: b.sport,
      players: b.enrollments
        .map((e) => e.student)
        .filter((s) => s.parentId !== c.staff.userId)
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, z) => a.name.localeCompare(z.name)),
    })),
    coachBadges: COACH_BADGE_KEYS,
  };
}

// ── Catalogue (owner / manager) ─────────────────────────────────────────────

export async function listRewardItems(includeArchived = false) {
  if (!FEATURES.rewards) return OFF;
  const c = await staffCtx();
  if (!c.ok) return c;
  const items = await db.rewardItem.findMany({
    where: { orgId: c.staff.orgId, ...(includeArchived && c.staff.isManager ? {} : { active: true }) },
    orderBy: [{ active: "desc" }, { costPoints: "asc" }],
  });
  return {
    ok: true as const,
    items: items.map((i) => ({ id: i.id, name: i.name, description: i.description, costPoints: i.costPoints, stock: i.stock, active: i.active, eligibility: parseEligibility(i.eligibility) })),
  };
}

export async function saveRewardItem(input: { id?: string; name: string; description?: string | null; costPoints: number; stock?: number | string | null; eligibility?: unknown }) {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const parsed = parseRewardItemInput(input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (v.eligibility.kind === "FEE_CREDIT") {
    if (!c.staff.isOwner) return fail("Only the owner can set up fee-credit rewards");
    if (!(await loadRewardsSettings(c.staff.orgId)).feeCreditsEnabled) return fail("Turn on fee credits in Rules first");
  }
  const data = { name: v.name, description: v.description, costPoints: v.costPoints, stock: v.stock, eligibility: v.eligibility };
  let id = input.id;
  if (id) {
    const r = await db.rewardItem.updateMany({ where: { id, orgId: c.staff.orgId }, data });
    if (r.count === 0) return fail("Reward not found");
  } else {
    id = (await db.rewardItem.create({ data: { ...data, orgId: c.staff.orgId, createdById: c.staff.userId } })).id;
  }
  await writeAudit(db, { userId: c.staff.userId, orgId: c.staff.orgId, action: "REWARDS_ITEM_SAVED", details: { itemId: id, ...data } });
  revalidate();
  return { ok: true as const, id };
}

/** Archive (or restore) an item. Items are never deleted: redemptions keep pointing at them. */
export async function setRewardItemActive(id: string, active: boolean) {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const r = await db.rewardItem.updateMany({ where: { id, orgId: c.staff.orgId }, data: { active: !!active } });
  if (r.count === 0) return fail("Reward not found");
  await writeAudit(db, { userId: c.staff.userId, orgId: c.staff.orgId, action: "REWARDS_ITEM_SAVED", details: { itemId: id, active: !!active } });
  revalidate();
  return { ok: true as const };
}

/** Adds the spec's launch catalogue (skipping names that already exist). Fee credit is never added. */
export async function addSuggestedRewardItems() {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const have = new Set((await db.rewardItem.findMany({ where: { orgId: c.staff.orgId }, select: { name: true } })).map((i) => i.name.toLowerCase()));
  const add = SUGGESTED_ITEMS.filter((i) => !have.has(i.name.toLowerCase()));
  if (add.length) {
    await db.rewardItem.createMany({
      data: add.map((i) => ({ orgId: c.staff.orgId, name: i.name, description: i.description, costPoints: i.costPoints, stock: i.stock, eligibility: i.eligibility, createdById: c.staff.userId })),
    });
    await writeAudit(db, { userId: c.staff.userId, orgId: c.staff.orgId, action: "REWARDS_ITEM_SAVED", details: { added: add.map((i) => i.name) } });
  }
  revalidate();
  return { ok: true as const, added: add.length };
}

// ── Redemptions ─────────────────────────────────────────────────────────────

/** Parent requests a reward for their own child. Eligibility and balance are checked now, in a transaction. */
export async function requestRedemption(studentId: string, rewardItemId: string) {
  if (!FEATURES.rewards) return OFF;
  const v = await viewerCtx();
  if (!v.ok) return v;
  if ("staff" in v) return fail("Only a parent can request a reward for their child");
  const student = await scopedStudent(v, studentId);
  if (!student) return fail("Player not found");
  const { orgId } = student;
  const now = new Date();
  const [settings, xpRows, rate, open] = await Promise.all([
    loadRewardsSettings(orgId),
    db.xpLedger.findMany({ where: { orgId, studentId: student.id }, select: { delta: true, reasonCode: true } }),
    attendanceRate(orgId, student.id, now),
    db.redemption.findFirst({ where: { orgId, studentId: student.id, rewardItemId, status: "REQUESTED" }, select: { id: true } }),
  ]);
  if (open) return fail("You've already requested this reward");

  try {
    const id = await withSerializable(async (tx) => {
      const item = await tx.rewardItem.findFirst({ where: { id: rewardItemId, orgId } });
      if (!item) throw new UserError("Reward not found");
      const e = parseEligibility(item.eligibility);
      const rows = await loadPointsRows(tx, orgId, student.id);
      const problems = eligibilityProblems(e, {
        active: item.active,
        costPoints: item.costPoints,
        stock: item.stock,
        balance: simulatePoints(rows, now).balance,
        level: topXpLevel(xpRows, e.sport),
        attendanceRate: rate,
        feeCreditsEnabled: settings.feeCreditsEnabled,
      });
      if (problems.length) throw new UserError(problems[0]);
      const red = await tx.redemption.create({
        data: { orgId, studentId: student.id, rewardItemId: item.id, costPoints: item.costPoints, status: "REQUESTED", requestedById: v.parentId },
      });
      const debit = await tx.pointsLedger.create({
        data: {
          orgId,
          studentId: student.id,
          delta: -item.costPoints,
          sourceType: SOURCE.REDEMPTION,
          sourceRef: red.id,
          reasonCode: "redeemed",
          note: item.name,
          createdById: v.parentId,
          createdAt: now,
          idempotencyKey: redeemKey(red.id),
        },
      });
      await tx.redemption.update({ where: { id: red.id }, data: { pointsLedgerRef: debit.id } });
      return red.id;
    });
    revalidate();
    return { ok: true as const, id };
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    throw e;
  }
}

/** Staff list: coaches see their batches' players only. */
export async function listRedemptions(status?: string) {
  if (!FEATURES.rewards) return OFF;
  const c = await staffCtx();
  if (!c.ok) return c;
  const { staff } = c;
  let studentIds: string[] | undefined;
  if (staff.role === "COACH") {
    const rows = await db.batchEnrollment.findMany({ where: { batch: { coachId: staff.userId, orgId: staff.orgId } }, select: { studentId: true } });
    studentIds = [...new Set(rows.map((r) => r.studentId))];
  }
  const list = await db.redemption.findMany({
    where: {
      orgId: staff.orgId,
      ...(status && ["REQUESTED", "APPROVED", "FULFILLED", "CANCELLED"].includes(status) ? { status } : {}),
      ...(studentIds ? { studentId: { in: studentIds } } : {}),
    },
    include: { rewardItem: { select: { name: true, eligibility: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const students = await db.student.findMany({ where: { id: { in: [...new Set(list.map((r) => r.studentId))] }, orgId: staff.orgId }, select: { id: true, name: true, parentId: true } });
  const byId = new Map(students.map((s) => [s.id, s]));
  return {
    ok: true as const,
    redemptions: list
      .filter((r) => byId.has(r.studentId))
      .map((r) => {
        const kind = parseEligibility(r.rewardItem.eligibility).kind;
        const own = byId.get(r.studentId)!.parentId === staff.userId;
        return {
          id: r.id,
          studentName: byId.get(r.studentId)!.name,
          item: r.rewardItem.name,
          kind,
          costPoints: r.costPoints,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          approvedAt: iso(r.approvedAt),
          fulfilledAt: iso(r.fulfilledAt),
          cancelReason: r.cancelReason,
          canApprove: !own && (kind !== "FEE_CREDIT" || staff.isOwner),
        };
      }),
  };
}

async function refundInTx(tx: Parameters<Parameters<typeof withSerializable>[0]>[0], red: { id: string; orgId: string; studentId: string; costPoints: number; pointsLedgerRef: string | null }, by: string, now: Date, note: string) {
  if (!red.pointsLedgerRef) return 0;
  const rows = await loadPointsRows(tx, red.orgId, red.studentId);
  const debit = rows.find((r) => r.id === red.pointsLedgerRef);
  if (!debit || debit.delta >= 0) return 0;
  const state = simulatePoints(rows, now);
  await tx.pointsLedger.create({
    data: {
      orgId: red.orgId,
      studentId: red.studentId,
      delta: -debit.delta,
      sourceType: SOURCE.REFUND,
      sourceRef: red.id,
      reasonCode: "refund",
      note,
      createdById: by,
      createdAt: now,
      expiresAt: refundExpiry(state, debit.id, now),
      idempotencyKey: refundKey(red.id),
    },
  });
  return -debit.delta;
}

async function staffRedemption(staff: Staff, id: string) {
  const red = await db.redemption.findFirst({ where: { id, orgId: staff.orgId }, include: { rewardItem: true } });
  if (!red) return null;
  const student = await db.student.findFirst({ where: staffStudentWhere(staff, red.studentId), select: { id: true, parentId: true, name: true } });
  return student ? { red, student } : null;
}

async function transition(id: string, action: RedemptionAction, noteIn?: string) {
  if (!FEATURES.rewards) return OFF;
  const v = await viewerCtx();
  if (!v.ok) return v;
  const note = cleanNote(noteIn);
  const now = new Date();
  let red;
  let actor: string;
  let staff: Staff | null = null;
  if ("staff" in v) {
    staff = v.staff;
    const found = await staffRedemption(v.staff, id);
    if (!found) return fail("Request not found");
    red = found.red;
    actor = v.staff.userId;
    const kind = parseEligibility(red.rewardItem.eligibility).kind;
    if ((action === "approve" || action === "fulfil") && found.student.parentId === actor) return fail("You can't approve a reward for your own child");
    if (kind === "FEE_CREDIT" && (action === "approve" || action === "fulfil")) {
      if (!v.staff.isOwner) return fail("Only the owner can approve fee credits");
      if (!(await loadRewardsSettings(red.orgId)).feeCreditsEnabled) return fail("Fee credits are off at this academy");
    }
  } else {
    if (action !== "cancel") return fail("Only the academy can do this");
    red = await db.redemption.findFirst({ where: { id }, include: { rewardItem: true } });
    if (!red) return fail("Request not found");
    const own = await db.student.findFirst({ where: { id: red.studentId, parentId: v.parentId, orgId: red.orgId }, select: { id: true } });
    if (!own) return fail("Request not found");
    if (red.status !== "REQUESTED") return fail("This request has been approved; ask the academy to cancel it");
    actor = v.parentId;
  }

  const to = nextStatus(red.status, action);
  if (!to) return fail("This request was already handled");
  const from = red.status;
  const item = red.rewardItem;
  const e = parseEligibility(item.eligibility);

  try {
    await withSerializable(async (tx) => {
      const data =
        action === "approve"
          ? { status: to, approvedById: actor, approvedAt: now }
          : action === "fulfil"
            ? { status: to, fulfilledAt: now }
            : { status: to, cancelledAt: now, cancelReason: action === "decline" ? `Declined${note ? `: ${note}` : ""}` : note ?? "Cancelled" };
      const upd = await tx.redemption.updateMany({ where: { id: red.id, status: from }, data });
      if (upd.count === 0) throw new UserError("This request was already handled");

      if (action === "approve") {
        if (e.weeklyCapacity) {
          const taken = await tx.redemption.count({
            where: { rewardItemId: item.id, status: { in: ["APPROVED", "FULFILLED"] }, approvedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
          });
          if (taken > e.weeklyCapacity) throw new UserError("This week's capacity for this reward is full");
        }
        if (item.stock != null) {
          const s = await tx.rewardItem.updateMany({ where: { id: item.id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
          if (s.count === 0) throw new UserError("Out of stock");
        }
      }
      if (restocksOn(action, from) && item.stock != null) {
        await tx.rewardItem.update({ where: { id: item.id }, data: { stock: { increment: 1 } } });
      }
      let refunded = 0;
      if (action === "decline" || action === "cancel") refunded = await refundInTx(tx, red, actor, now, `${item.name} (${action === "decline" ? "declined" : "cancelled"})`);

      const auditAction = { approve: "REWARDS_REDEMPTION_APPROVED", decline: "REWARDS_REDEMPTION_DECLINED", fulfil: "REWARDS_REDEMPTION_FULFILLED", cancel: "REWARDS_REDEMPTION_CANCELLED" }[action];
      await writeAudit(tx, {
        userId: actor,
        orgId: red.orgId,
        action: auditAction,
        details: { redemptionId: red.id, studentId: red.studentId, item: item.name, costPoints: red.costPoints, from, to, note, refunded, by: staff ? staff.role : "PARENT" },
      });
      if (action === "fulfil" && e.kind === "FEE_CREDIT") {
        // Recorded for the owner to apply on the fee ledger by hand. This feature never writes fee tables.
        await writeAudit(tx, {
          userId: actor,
          orgId: red.orgId,
          action: "REWARDS_FEE_CREDIT_DUE",
          details: { redemptionId: red.id, studentId: red.studentId, amountMinor: e.feeCreditMinor ?? 0, reasonCode: "REWARD_FEE_CREDIT" },
        });
      }
    });
  } catch (err) {
    if (err instanceof UserError) return fail(err.message);
    throw err;
  }
  revalidate();
  return { ok: true as const, status: to };
}

export async function approveRedemption(id: string, note?: string) {
  return transition(id, "approve", note);
}
export async function declineRedemption(id: string, note?: string) {
  return transition(id, "decline", note);
}
export async function fulfilRedemption(id: string) {
  return transition(id, "fulfil");
}
/** Parent: own child's request while still REQUESTED. Staff: REQUESTED or APPROVED (restocks). Refund is a new row. */
export async function cancelRedemption(id: string, reason?: string) {
  return transition(id, "cancel", reason);
}

// ── Leaderboards ────────────────────────────────────────────────────────────

/** Parent opts their own child in or out (separate from photo consent). Off by default. */
export async function setLeaderboardOptIn(studentId: string, optedIn: boolean) {
  if (!FEATURES.rewards) return OFF;
  const v = await viewerCtx();
  if (!v.ok) return v;
  if ("staff" in v) return fail("Only a parent can choose this");
  const student = await scopedStudent(v, studentId);
  if (!student) return fail("Player not found");
  const now = new Date();
  await db.leaderboardOptIn.upsert({
    where: { orgId_studentId: { orgId: student.orgId, studentId: student.id } },
    create: { orgId: student.orgId, studentId: student.id, optedInAt: now, optedOutAt: optedIn ? null : now, setById: v.parentId },
    update: optedIn ? { optedInAt: now, optedOutAt: null, setById: v.parentId } : { optedOutAt: now, setById: v.parentId },
  });
  revalidate();
  return { ok: true as const, optedIn: !!optedIn };
}

/** One batch, split by age group. XP in the batch's sport and attendance streak; names are first + initial. */
export async function getLeaderboard(batchId: string) {
  if (!FEATURES.rewards) return OFF;
  const v = await viewerCtx();
  if (!v.ok) return v;
  const batch = await db.batch.findFirst({ where: { id: batchId }, select: { id: true, name: true, sport: true, orgId: true, coachId: true } });
  if (!batch?.orgId) return fail("Batch not found");
  const orgId = batch.orgId;
  let viewerChildIds: Set<string> | null = null;
  if ("staff" in v) {
    if (v.staff.orgId !== orgId || (v.staff.role === "COACH" && batch.coachId !== v.staff.userId)) return fail("Batch not found");
  } else {
    const kids = await db.batchEnrollment.findMany({ where: { batchId, student: { parentId: v.parentId } }, select: { studentId: true } });
    if (!kids.length) return fail("Batch not found");
    viewerChildIds = new Set(kids.map((k) => k.studentId));
  }
  const now = new Date();
  const enrolled = await db.batchEnrollment.findMany({ where: { batchId }, select: { student: { select: { id: true, name: true, dob: true } } } });
  const ids = enrolled.map((e) => e.student.id);
  const optIns = await db.leaderboardOptIn.findMany({ where: { orgId, studentId: { in: ids }, optedOutAt: null }, select: { studentId: true } });
  const opted = new Set(optIns.map((o) => o.studentId));
  const optedIds = ids.filter((id) => opted.has(id));
  const sport = normalizeSport(batch.sport);
  const [xp, att] = await Promise.all([
    db.xpLedger.groupBy({ by: ["studentId"], where: { orgId, studentId: { in: optedIds }, reasonCode: { endsWith: `@${sport}` } }, _sum: { delta: true } }),
    db.attendance.findMany({
      where: { studentId: { in: optedIds }, session: { batchId, date: { gte: new Date(now.getTime() - 180 * DAY_MS), lte: now } } },
      select: { studentId: true, isPresent: true, status: true, session: { select: { date: true, status: true } } },
    }),
  ]);
  const xpBy = new Map(xp.map((x) => [x.studentId, x._sum.delta ?? 0]));
  const groups = buildLeaderboard(
    enrolled.map(({ student: s }) => ({
      studentId: s.id,
      name: s.name,
      dob: s.dob,
      optedIn: opted.has(s.id),
      xp: xpBy.get(s.id) ?? 0,
      streak: opted.has(s.id)
        ? summarizeAttendance(
            att.filter((a) => a.studentId === s.id).map((a) => ({ isPresent: a.isPresent, status: a.status, date: a.session.date, sessionStatus: a.session.status })),
            now,
          ).currentStreak
        : 0,
    })),
    now,
    viewerChildIds,
  );
  return { ok: true as const, batch: { id: batch.id, name: batch.name }, groups };
}

// ── Owner: settings, expiry, budget and audit ───────────────────────────────

export async function getRewardsSettings() {
  if (!FEATURES.rewards) return OFF;
  const c = await staffCtx();
  if (!c.ok) return c;
  return { ok: true as const, settings: await loadRewardsSettings(c.staff.orgId), ceilings: EARN_RULE_CEILINGS, caps: CAPS, isOwner: c.staff.isOwner };
}

export async function saveRewardsSettings(input: Partial<RewardsSettings>) {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const current = await loadRewardsSettings(c.staff.orgId);
  const next = parseSettings({ ...current, ...input });
  if (next.feeCreditsEnabled !== current.feeCreditsEnabled && !c.staff.isOwner) return fail("Only the owner can turn fee credits on or off");
  await writeAudit(db, { userId: c.staff.userId, orgId: c.staff.orgId, action: SETTINGS_ACTION, details: next as unknown as Record<string, unknown> });
  revalidate();
  return { ok: true as const, settings: next };
}

/** Runs this academy's expiry now (the cron does every academy daily). Idempotent. */
export async function runExpiry() {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const r = await runExpiryForOrg(c.staff.orgId);
  await writeAudit(db, { userId: c.staff.userId, orgId: c.staff.orgId, action: "REWARDS_EXPIRY_RUN", details: r });
  revalidate();
  return { ok: true as const, ...r };
}

/** Owner budget: points liability, fulfilled cost vs fee revenue (read-only), fee credits, and the audit trail. */
export async function getRewardsOverview() {
  if (!FEATURES.rewards) return OFF;
  const c = await managerCtx();
  if (!c.ok) return c;
  const orgId = c.staff.orgId;
  const now = new Date();
  const tz = await orgTimezone(orgId);
  const { start, end, key } = monthWindow(now, tz);
  const [settings, rows, byStatus, fulfilled, feeCredits, revenue, audit] = await Promise.all([
    loadRewardsSettings(orgId),
    db.pointsLedger.findMany({ where: { orgId }, select: { id: true, studentId: true, delta: true, sourceType: true, sourceRef: true, createdAt: true, expiresAt: true } }),
    db.redemption.groupBy({ by: ["status"], where: { orgId }, _count: { _all: true } }),
    db.redemption.aggregate({ where: { orgId, status: "FULFILLED", fulfilledAt: { gte: start, lt: end } }, _sum: { costPoints: true }, _count: { _all: true } }),
    db.auditLog.findMany({ where: { orgId, action: "REWARDS_FEE_CREDIT_DUE", createdAt: { gte: start, lt: end } }, select: { details: true } }),
    // Read-only: fee revenue for the share calculation. Rewards never write fee tables.
    db.feeRecord.aggregate({ where: { orgId, month: key, status: "PAID" }, _sum: { amount: true } }),
    db.auditLog.findMany({
      where: { orgId, action: { startsWith: "REWARDS_" } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);
  const byStudent = new Map<string, typeof rows>();
  for (const r of rows) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
  let liability = 0;
  let expiring = 0;
  let earnedThisMonth = 0;
  for (const list of byStudent.values()) {
    liability += simulatePoints(list, now).balance;
    expiring += expiringSoon(list, now).amount;
  }
  for (const r of rows) if (r.delta > 0 && (EARN_SOURCE_TYPES as readonly string[]).includes(r.sourceType) && r.createdAt >= start && r.createdAt < end) earnedThisMonth += r.delta;

  const fulfilledPoints = fulfilled._sum.costPoints ?? 0;
  const revenueMajor = revenue._sum.amount ?? 0;
  const pv = settings.pointValueMinor;
  const costMajor = pv ? (fulfilledPoints * pv) / 100 : null;
  return {
    ok: true as const,
    month: key,
    settings,
    liabilityPoints: liability,
    liabilityMajor: pv ? (liability * pv) / 100 : null,
    expiringIn30Days: expiring,
    earnedThisMonth,
    redemptions: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])),
    fulfilledThisMonth: { count: fulfilled._count._all, points: fulfilledPoints, costMajor },
    feeRevenueMajor: revenueMajor,
    costShareOfRevenue: costMajor != null && revenueMajor > 0 ? costMajor / revenueMajor : null,
    feeCreditsThisMonth: { count: feeCredits.length, amountMinor: feeCredits.reduce((s, f) => s + (Number(parseJson(f.details).amountMinor) || 0), 0) },
    audit: audit
      .map((a) => {
        const d = parseJson(a.details);
        return {
          id: a.id,
          at: a.createdAt.toISOString(),
          action: a.action.replace(/^REWARDS_/, ""),
          by: a.user?.name ?? "Unknown",
          summary: [d.item, d.points != null ? `${d.points} pts` : null, d.reason, d.decision, d.badge, d.note].filter(Boolean).join(" · ") || null,
        };
      }),
  };
}

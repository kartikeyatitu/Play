// Server-only loader for the weekly story. Callers check who may see the child first.
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { localDateString } from "@/lib/fee-aging";
import { nextSession } from "@/components/parent/home-summary";
import { reportAverage } from "@/lib/coach/assessment";
import { getFitnessTest } from "@/lib/body/tests";
import { addDays, buildWeeklyStory, type StorySession, type WeeklyStory } from "./weekly";

const day = (d: Date) => d.toISOString().slice(0, 10);
const asStatus = (s: string | null | undefined, present: boolean): StorySession["attendance"] => {
  const v = (s || (present ? "PRESENT" : "ABSENT")).toUpperCase();
  return (["PRESENT", "LATE", "ABSENT", "EXCUSED", "INJURED"] as const).find((x) => x === v) ?? null;
};

export async function loadWeeklyStory(studentId: string, weekStart: string, now = new Date()): Promise<{ story: WeeklyStory; academy: string | null; tz: string } | null> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      orgId: true,
      org: { select: { name: true, timezone: true } },
      enrollments: { select: { batchId: true, batch: { select: { id: true, name: true, schedule: true } } } },
    },
  });
  if (!student) return null;
  const tz = student.org?.timezone || "Asia/Kolkata";
  const today = localDateString(now, tz);
  const weekEnd = addDays(weekStart, 6);
  const from = new Date(`${weekStart}T00:00:00Z`);
  const to = new Date(`${addDays(weekEnd, 1)}T00:00:00Z`);
  const batchIds = student.enrollments.map((e) => e.batchId);

  const [sessions, reports, xp, pts, badges, upcoming] = await Promise.all([
    batchIds.length
      ? db.session.findMany({
          where: { batchId: { in: batchIds }, date: { gte: from, lt: to } },
          select: {
            id: true,
            date: true,
            status: true,
            recap: true,
            batch: { select: { name: true } },
            attendances: { where: { studentId }, select: { status: true, isPresent: true, notes: true } },
          },
        })
      : Promise.resolve([]),
    db.skillReport.findMany({
      where: { studentId, month: { lte: weekEnd.slice(0, 7) } },
      orderBy: { month: "desc" },
      take: 2,
      select: { month: true, sport: true, technique: true, fitness: true, discipline: true, metrics: true },
    }),
    FEATURES.rewards && student.orgId
      ? db.xpLedger.findMany({
          where: { orgId: student.orgId, studentId, createdAt: { gte: from, lt: to } },
          select: { delta: true, sourceType: true, sourceRef: true, reasonCode: true },
        })
      : Promise.resolve([]),
    FEATURES.rewards && student.orgId
      ? db.pointsLedger.aggregate({ where: { orgId: student.orgId, studentId, delta: { gt: 0 }, createdAt: { gte: from, lt: to } }, _sum: { delta: true } })
      : Promise.resolve(null),
    FEATURES.rewards && student.orgId
      ? db.studentBadge.findMany({
          where: { orgId: student.orgId, studentId, revokedAt: null, awardedAt: { gte: from, lt: to } },
          select: { badge: { select: { name: true } } },
        })
      : Promise.resolve([]),
    batchIds.length
      ? db.session.findMany({ where: { batchId: { in: batchIds }, date: { gte: new Date(`${today}T00:00:00Z`) } }, select: { batchId: true, date: true, status: true } })
      : Promise.resolve([]),
  ]);

  // Personal bests this week: the rewards ledger only records one when an earlier result was beaten.
  const pbRows = xp.filter((r) => r.sourceType === "PERFORMANCE" && r.delta > 0 && r.reasonCode !== "REVERSAL" && r.sourceRef);
  const pbIds = pbRows.map((r) => r.sourceRef!) as string[];
  const [fit, perf] = pbIds.length
    ? await Promise.all([
        FEATURES.fitnessTests ? db.fitnessResult.findMany({ where: { id: { in: pbIds }, studentId }, select: { testKey: true, recordedAt: true } }) : Promise.resolve([]),
        db.performanceResult.findMany({ where: { id: { in: pbIds }, studentId }, select: { eventName: true, recordedAt: true } }).catch(() => []),
      ])
    : [[], []];
  const personalBests = [
    ...fit.map((f) => ({ label: getFitnessTest(f.testKey)?.name ?? "Fitness test", date: day(f.recordedAt) })),
    ...perf.map((p) => ({ label: p.eventName, date: day(p.recordedAt) })),
  ];

  const avg = (r: (typeof reports)[number] | undefined) => {
    if (!r) return null;
    const a = reportAverage(r);
    return a == null ? null : { month: r.month, average: a };
  };

  const story = buildWeeklyStory({
    childName: student.name,
    weekStart,
    today,
    sessions: sessions.map((s) => {
      const a = s.attendances[0];
      return {
        date: day(s.date),
        batchName: s.batch.name,
        status: s.status,
        attendance: a ? asStatus(a.status, a.isPresent) : null,
        note: a?.notes ?? null,
        recap: s.recap ?? null,
      };
    }),
    skill: { latest: avg(reports[0]), previous: avg(reports[1]) },
    rewards: {
      xp: xp.reduce((n, r) => n + r.delta, 0),
      points: pts?._sum.delta ?? 0,
      badges: badges.map((b) => b.badge.name),
    },
    personalBests,
    next: nextSession(
      student.enrollments.map((e) => ({ id: e.batch.id, name: e.batch.name, schedule: e.batch.schedule })),
      upcoming,
      now,
      tz,
    ),
  });
  return { story, academy: student.org?.name ?? null, tz };
}

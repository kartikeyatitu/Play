/**
 * Server-only loader for at-risk students (analytics step 2). Scoped to one orgId; callers check permissions.
 * Parent phone numbers are only used to build a WhatsApp link when the caller may contact parents.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { istDateString } from "@/lib/fees";
import { waLink } from "@/lib/i18n";
import { addDays } from "@/lib/insights";
import { RECENT_WINDOW, parentMessage, scoreRisk, type RiskLevel, type RiskResult } from "@/lib/risk";

export type AtRiskStudent = {
  studentId: string;
  name: string;
  batches: string[];
  parentName: string;
  level: Exclude<RiskLevel, "none">;
  score: number;
  reasons: string[];
  lastPresent: string | null;
  message: string;
  /** Present only when the viewer may contact parents (students.manage). */
  whatsappUrl: string | null;
};

export type AtRiskSummary = { high: number; medium: number; low: number; checked: number; students: AtRiskStudent[] };

const MAX_LISTED = 100;

export async function loadAtRiskStudents(
  orgId: string,
  opts: { canContact: boolean; now?: Date; /** Limit to students in these batches (a coach's own). */ batchIds?: string[] },
): Promise<AtRiskSummary> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, timezone: true, country: true, currency: true, locale: true, phoneCountry: true },
  });
  const tz = org?.timezone || "Asia/Kolkata";
  const today = istDateString(opts.now ?? new Date(), tz);
  const currentMonth = today.slice(0, 7);
  // Sessions store their calendar day as UTC midnight; ~6 months back covers 16 sessions for any weekly batch.
  const since = new Date(`${addDays(today, -183)}T00:00:00.000Z`);
  const feeScope: Prisma.FeeRecordWhereInput = { OR: [{ orgId }, { student: { orgId } }] };

  const [students, marks, unpaid] = await Promise.all([
    db.student.findMany({
      where: { orgId, enrollments: { some: { batch: { orgId, ...(opts.batchIds ? { id: { in: opts.batchIds } } : {}) } } } },
      select: {
        id: true,
        name: true,
        parent: { select: { name: true, phone: true } },
        enrollments: {
          where: { batch: { orgId, ...(opts.batchIds ? { id: { in: opts.batchIds } } : {}) } },
          select: { joinedAt: true, batch: { select: { name: true } } },
        },
      },
    }),
    db.$queryRaw<{ studentId: string; present: boolean; date: string }[]>`
      WITH ranked AS (
        SELECT a."studentId" AS "studentId", a."isPresent" AS "present", to_char(s."date", 'YYYY-MM-DD') AS "date",
          ROW_NUMBER() OVER (PARTITION BY a."studentId" ORDER BY s."date" DESC) AS rn
        FROM "Attendance" a
        JOIN "Session" s ON s."id" = a."sessionId"
        JOIN "Batch" b ON b."id" = s."batchId"
        WHERE b."orgId" = ${orgId} AND s."status" <> 'CANCELLED' AND s."date" >= ${since}
      )
      SELECT "studentId", "present", "date" FROM ranked WHERE rn <= ${RECENT_WINDOW * 2}`,
    db.feeRecord.findMany({
      where: { AND: [feeScope, { status: { not: "PAID" } }, { month: { lt: currentMonth } }] },
      select: { studentId: true, month: true },
    }),
  ]);

  const marksBy = new Map<string, { date: string; present: boolean }[]>();
  for (const m of marks) {
    const list = marksBy.get(m.studentId) ?? [];
    list.push({ date: m.date, present: Boolean(m.present) });
    marksBy.set(m.studentId, list);
  }
  const unpaidBy = new Map<string, string[]>();
  for (const f of unpaid) {
    const list = unpaidBy.get(f.studentId) ?? [];
    list.push(f.month);
    unpaidBy.set(f.studentId, list);
  }

  const counts = { high: 0, medium: 0, low: 0 };
  const listed: (AtRiskStudent & { risk: RiskResult })[] = [];
  for (const s of students) {
    const joinedAt = s.enrollments.reduce<Date | null>((min, e) => (!min || e.joinedAt < min ? e.joinedAt : min), null);
    const risk = scoreRisk({ marks: marksBy.get(s.id) ?? [], unpaidMonths: unpaidBy.get(s.id) ?? [], joinedAt, today });
    if (risk.level === "none") continue;
    counts[risk.level]++;
    const batches = s.enrollments.map((e) => e.batch.name);
    const message = parentMessage({
      parentName: s.parent?.name ?? "",
      childName: s.name,
      batchName: batches[0] ?? null,
      academyName: org?.name || "your academy",
      signals: risk.signals,
      overdueMonths: risk.overdueMonths,
    });
    listed.push({
      studentId: s.id,
      name: s.name,
      batches,
      parentName: s.parent?.name ?? "",
      level: risk.level,
      score: risk.score,
      reasons: risk.reasons,
      lastPresent: risk.lastPresent,
      message,
      whatsappUrl: opts.canContact && s.parent?.phone ? waLink(s.parent.phone, message, org) : null,
      risk,
    });
  }

  listed.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return {
    ...counts,
    checked: students.length,
    students: listed.slice(0, MAX_LISTED).map((item) => {
      const { risk, ...rest } = item;
      void risk;
      return rest;
    }),
  };
}

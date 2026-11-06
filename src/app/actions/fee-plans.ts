"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission, requirePermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { billedAmount, concessionsByStudent } from "@/lib/concessions";
import {
  buildPlanSchedule,
  localDate,
  MAX_PLAN_MONTHS,
  MONTH_RE,
  PLAN_COVERED_METHOD,
  planKind,
  type ScheduleLine,
} from "@/lib/fee-plan-schedule";

// Fee plans: monthly (duration 1), quarterly (3) or term (any other 2–12 months). The plan kind is
// derived from FeePlan.duration; there is no separate column. Proration and instalment rules live in
// src/lib/fee-plan-schedule.ts (unit tested).
//
// Assignment uses existing fields only:
//   • Assigning creates the FeeRecords for the chosen period right away (dues + ₹0 PLAN_COVERED months).
//   • A MONTHLY plan is also kept for later months: Student.feeOverride (one student) or
//     Batch.monthlyFee (whole batch), which the monthly generator and cron already read.
//   • Quarterly/term plans have no column to remember them by, so the owner assigns the next period
//     when it comes (same screen). Each assignment is written to AuditLog (FEE_PLAN_ASSIGNED).

const PLAN_KINDS = ["MONTHLY", "QUARTERLY", "TERM"] as const;

export async function createFeePlan(data: { name: string; duration: number; amount: number; sport?: string; kind?: string }) {
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const name = String(data?.name || "").trim().slice(0, 80);
  const kind = PLAN_KINDS.includes(data?.kind as any) ? (data.kind as (typeof PLAN_KINDS)[number]) : null;
  const duration = kind === "MONTHLY" ? 1 : kind === "QUARTERLY" ? 3 : Math.round(Number(data?.duration));
  const amount = Math.round(Number(data?.amount) * 100) / 100;
  if (!name) return { success: false, error: "Please enter a plan name." };
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_PLAN_MONTHS)
    return { success: false, error: `Duration must be 1 to ${MAX_PLAN_MONTHS} months.` };
  if (kind === "TERM" && (duration === 1 || duration === 3))
    return { success: false, error: "A term plan is 2 or 4–12 months (use Monthly or Quarterly for 1 or 3)." };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Amount must be more than 0." };
  const sport = typeof data?.sport === "string" && data.sport.trim() ? data.sport.trim().slice(0, 40) : null;
  // Whitelist fields + force session org (never spread client data into Prisma)
  const plan = await db.feePlan.create({ data: { name, duration, amount, sport, orgId: session.orgId } });
  revalidatePath("/org");
  return { success: true, plan: { id: plan.id, name: plan.name, duration: plan.duration, amount: plan.amount, sport: plan.sport } };
}

export async function getFeePlans() {
  const { session } = await requirePermission("fees.manage");
  return db.feePlan.findMany({ where: { isActive: true, orgId: session.orgId }, orderBy: { duration: "asc" } });
}

export async function deleteFeePlan(id: string) {
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const result = await db.feePlan.updateMany({ where: { id, orgId: session.orgId }, data: { isActive: false } });
  if (result.count === 0) return { success: false, error: "Fee plan not found" };
  revalidatePath("/org");
  return { success: true };
}

/** Batches and students an owner can assign a plan to (names only, this academy only). */
export async function getPlanTargets() {
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const { session } = auth;
  const [batches, students] = await Promise.all([
    db.batch.findMany({ where: { orgId: session.orgId }, select: { id: true, name: true, _count: { select: { enrollments: true } } }, orderBy: { name: "asc" } }),
    db.student.findMany({ where: { orgId: session.orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 2000 }),
  ]);
  return {
    success: true as const,
    batches: batches.map((b) => ({ id: b.id, name: b.name, students: b._count.enrollments })),
    students,
  };
}

export interface PlanAssignmentInput {
  planId: string;
  target: { type: "student" | "batch"; id: string };
  startMonth: string;
  instalments?: number;
  /** Optional academy-local join date (YYYY-MM-DD) for a single student; overrides the enrolment date. */
  joinDate?: string | null;
}

export interface PlanAssignmentRow {
  studentId: string;
  studentName: string;
  joinDate: string | null;
  prorated: boolean;
  total: number;
  lines: Array<ScheduleLine & { conflict: boolean }>;
}

async function planAssignmentRows(orgId: string, input: PlanAssignmentInput) {
  if (!input || typeof input.planId !== "string" || !input.target || typeof input.target.id !== "string")
    return { error: "Choose a plan and who it is for." } as const;
  if (!MONTH_RE.test(String(input.startMonth))) return { error: "Start month must be YYYY-MM." } as const;
  const plan = await db.feePlan.findFirst({ where: { id: input.planId, orgId, isActive: true } });
  if (!plan) return { error: "Fee plan not found." } as const;

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  const tz = org?.timezone || "Asia/Kolkata";

  let students: Array<{ id: string; name: string; joinedAt: Date | null }> = [];
  if (input.target.type === "batch") {
    const batch = await db.batch.findFirst({
      where: { id: input.target.id, orgId },
      select: { id: true, enrollments: { select: { joinedAt: true, student: { select: { id: true, name: true, orgId: true } } } } },
    });
    if (!batch) return { error: "Batch not found in your academy." } as const;
    students = batch.enrollments
      .filter((e) => e.student.orgId === orgId)
      .map((e) => ({ id: e.student.id, name: e.student.name, joinedAt: e.joinedAt }));
  } else {
    const s = await db.student.findFirst({
      where: { id: input.target.id, orgId },
      select: { id: true, name: true, createdAt: true, enrollments: { select: { joinedAt: true } } },
    });
    if (!s) return { error: "Student not found in your academy." } as const;
    const firstJoin = s.enrollments.reduce<Date | null>((min, e) => (!min || e.joinedAt < min ? e.joinedAt : min), null);
    students = [{ id: s.id, name: s.name, joinedAt: firstJoin ?? s.createdAt }];
  }
  if (!students.length) return { error: "No students to bill." } as const;

  const concessions = FEATURES.inclusive
    ? concessionsByStudent(await db.feeConcession.findMany({ where: { orgId, studentId: { in: students.map((s) => s.id) }, revokedAt: null } }))
    : null;

  const existing = await db.feeRecord.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, month: { gte: input.startMonth } },
    select: { studentId: true, month: true },
  });
  const taken = new Set(existing.map((e) => `${e.studentId}|${e.month}`));

  const rows: PlanAssignmentRow[] = [];
  for (const s of students) {
    const joinDate =
      input.target.type === "student" && typeof input.joinDate === "string" && input.joinDate
        ? input.joinDate
        : s.joinedAt
          ? localDate(s.joinedAt, tz)
          : null;
    const sched = buildPlanSchedule({
      amount: plan.amount,
      duration: plan.duration,
      startMonth: input.startMonth,
      instalments: input.instalments ?? 1,
      joinDate,
    });
    if (!sched.ok) return { error: sched.error } as const;
    const lines = sched.lines.map((l) => {
      const amount = l.kind === "DUE" && concessions ? billedAmount(l.amount, concessions.get(s.id), l.month) : l.amount;
      return { ...l, amount, conflict: taken.has(`${s.id}|${l.month}`) };
    });
    rows.push({ studentId: s.id, studentName: s.name, joinDate, prorated: sched.proration.prorated, total: lines.reduce((t, l) => t + l.amount, 0), lines });
  }
  return { plan, rows } as const;
}

/** Preview the records an assignment would create (nothing is written). */
export async function previewPlanAssignment(input: PlanAssignmentInput) {
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const res = await planAssignmentRows(auth.session.orgId, input);
  if ("error" in res) return { success: false as const, error: res.error as string };
  return {
    success: true as const,
    plan: { id: res.plan.id, name: res.plan.name, duration: res.plan.duration, amount: res.plan.amount, kind: planKind(res.plan.duration) },
    rows: res.rows,
  };
}

/**
 * Assign a plan to a student or a whole batch and create its FeeRecords for the period.
 * Months that already have a record for a student are left untouched and reported as conflicts.
 */
export async function assignFeePlan(input: PlanAssignmentInput) {
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const { session } = auth;
  const res = await planAssignmentRows(session.orgId, input);
  if ("error" in res) return { success: false as const, error: res.error as string };
  const { plan, rows } = res;

  let created = 0;
  let covered = 0;
  let conflicts = 0;
  let billed = 0;
  for (const row of rows) {
    for (const l of row.lines) {
      if (l.conflict) {
        conflicts++;
        continue;
      }
      const isDue = l.kind === "DUE" && l.amount > 0;
      try {
        await db.feeRecord.create({
          data: isDue
            ? { orgId: session.orgId, studentId: row.studentId, month: l.month, amount: l.amount, status: "PENDING" }
            : { orgId: session.orgId, studentId: row.studentId, month: l.month, amount: 0, status: "PAID", paymentMethod: PLAN_COVERED_METHOD },
        });
        if (isDue) {
          created++;
          billed += l.amount;
        } else covered++;
      } catch (e: any) {
        // Unique (studentId, month) race with another writer: treat as a conflict, never overwrite.
        if (e?.code === "P2002") conflicts++;
        else throw e;
      }
    }
  }

  // Monthly plans carry on through the existing monthly generator.
  if (plan.duration === 1) {
    const monthly = Math.round(plan.amount);
    if (input.target.type === "batch") {
      await db.batch.updateMany({ where: { id: input.target.id, orgId: session.orgId }, data: { monthlyFee: monthly } });
    } else {
      await db.student.updateMany({ where: { id: input.target.id, orgId: session.orgId }, data: { feeOverride: monthly } });
    }
  }

  await db.auditLog
    .create({
      data: {
        userId: session.id,
        orgId: session.orgId,
        action: "FEE_PLAN_ASSIGNED",
        details: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          duration: plan.duration,
          target: input.target,
          startMonth: input.startMonth,
          instalments: input.instalments ?? 1,
          students: rows.length,
          created,
          covered,
          conflicts,
          billed,
        }),
      },
    })
    .catch((e) => console.error("[fee-plans] FEE_PLAN_ASSIGNED audit write failed:", e?.message || e));

  revalidatePath("/org");
  revalidatePath("/parent");
  return { success: true as const, students: rows.length, created, covered, conflicts, billed };
}

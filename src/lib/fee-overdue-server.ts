import { signPayToken } from "@/lib/pay-token";
import { db } from "@/lib/db";
import { buildAgingReport, type AgingFeeInput, type AgingReport } from "@/lib/fee-aging";
import { buildFamilyReminderText, familyWaLink, lastRemindedByFamily, FEE_REMINDER_ACTION } from "@/lib/fee-reminders";
import { getAppUrl } from "@/lib/app-url";

/**
 * Server-only loader for the owner's Overdue panel. Deliberately NOT a "use server" file: it takes an
 * orgId, so it must only be called from actions that have already checked the caller's permission.
 */

export interface OverdueFamilyView {
  familyId: string;
  familyName: string | null;
  hasPhone: boolean;
  total: number;
  maxDaysOverdue: number;
  lines: Array<{ feeRecordId: string; studentName: string; month: string; amount: number; daysOverdue: number }>;
  lastRemindedAt: string | null;
  /** wa.me link with the reminder text; null without a usable phone */
  waLink: string | null;
}

export interface OverdueBucketView {
  key: string;
  label: string;
  total: number;
  recordCount: number;
  familyCount: number;
  families: OverdueFamilyView[];
}

export interface OverdueView {
  today: string;
  total: number;
  buckets: OverdueBucketView[];
}

export async function loadOverdueReport(orgId: string, now = new Date()): Promise<{ report: AgingReport; view: OverdueView }> {
  const [org, records] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true, upiId: true, timezone: true, phoneCountry: true } }),
    db.feeRecord.findMany({
      where: { orgId, status: { notIn: ["PAID", "PENDING_VERIFICATION"] }, amount: { gt: 0 } },
      select: {
        id: true,
        month: true,
        amount: true,
        status: true,
        student: { select: { id: true, name: true, orgId: true, parentId: true, parent: { select: { name: true, phone: true } } } },
      },
    }),
  ]);
  const tz = org?.timezone || "Asia/Kolkata";
  const inputs: AgingFeeInput[] = records
    // Defence in depth: the student must belong to this academy too.
    .filter((r) => r.student && r.student.orgId === orgId)
    .map((r) => ({
      feeRecordId: r.id,
      studentId: r.student.id,
      studentName: r.student.name,
      familyId: r.student.parentId,
      familyName: r.student.parent?.name ?? null,
      familyPhone: r.student.parent?.phone ?? null,
      amount: r.amount,
      month: r.month,
      status: r.status,
    }));
  const report = buildAgingReport(inputs, now, tz);

  const allFamilies = report.buckets.flatMap((b) => b.families);
  const logs = allFamilies.length
    ? await db.auditLog.findMany({
        where: { orgId, action: FEE_REMINDER_ACTION, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
        select: { details: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      })
    : [];
  const last = lastRemindedByFamily(logs, allFamilies);
  let parentAppUrl: string | null = null;
  try {
    parentAppUrl = `${getAppUrl().replace(/\/+$/, "")}/parent`;
  } catch {
    parentAppUrl = null;
  }

  const view: OverdueView = {
    today: report.today,
    total: report.total,
    buckets: report.buckets.map((b) => ({
      key: b.key,
      label: b.label,
      total: b.total,
      recordCount: b.recordCount,
      familyCount: b.families.length,
      families: b.families.map((f) => {
        const text = buildFamilyReminderText({
          parentName: f.familyName,
          lines: f.lines.map((l) => ({ studentName: l.studentName, month: l.month, amount: l.amount })),
          academyName: org?.name || "the academy",
          upiId: org?.upiId,
          parentAppUrl,
          payUrl: parentAppUrl ? `${parentAppUrl.replace(/\/parent$/, "")}/pay/${signPayToken(orgId, f.familyId)}` : null,
        });
        return {
          familyId: f.familyId,
          familyName: f.familyName,
          hasPhone: String(f.familyPhone || "").replace(/\D/g, "").length >= 10,
          total: f.total,
          maxDaysOverdue: f.maxDaysOverdue,
          lines: f.lines.map((l) => ({ feeRecordId: l.feeRecordId, studentName: l.studentName, month: l.month, amount: l.amount, daysOverdue: l.daysOverdue })),
          lastRemindedAt: last.get(f.familyId) ?? null,
          waLink: familyWaLink(f.familyPhone, text, org?.phoneCountry || "91"),
        };
      }),
    })),
  };
  return { report, view };
}

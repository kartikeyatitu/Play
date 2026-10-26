import { db } from "@/lib/db";
import { resolveStudentFee } from "@/lib/fees";
import { billedAmount, concessionsByStudent } from "@/lib/concessions";
import { FEATURES } from "@/lib/features";

/**
 * Cron-only fee generation. Deliberately NOT in src/app/actions/*: functions exported from a
 * "use server" file are callable by any visitor as a server action, so this lives in a plain
 * server module imported only by the CRON_SECRET-protected route (src/app/api/cron/monthly-fees).
 */
export async function generateMonthlyFeesForOrg(orgId: string, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { feesCreated: 0 };
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { defaultMonthlyFee: true, isActive: true } });
  if (!org || org.isActive === false) return { feesCreated: 0 };

  const students = await db.student.findMany({
    where: { orgId },
    include: { enrollments: { include: { batch: true } } },
  });
  // V9 Brand Studio: scholarship / CSR concessions; a 100% waiver resolves to 0 and is skipped below.
  const concessions = FEATURES.inclusive
    ? concessionsByStudent(await db.feeConcession.findMany({ where: { orgId, revokedAt: null } }))
    : null;
  let feesCreated = 0;
  for (const student of students) {
    const base = resolveStudentFee(student, org.defaultMonthlyFee);
    const amount = concessions ? billedAmount(base, concessions.get(student.id), month) : base;
    if (amount <= 0) continue;
    const existing = await db.feeRecord.findUnique({
      where: { studentId_month: { studentId: student.id, month } },
      select: { id: true },
    });
    if (existing) continue;
    await db.feeRecord.create({
      data: { orgId, studentId: student.id, month, amount, status: "PENDING" },
    });
    feesCreated++;
  }
  return { feesCreated };
}

"use server"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requirePermission } from "@/lib/membership";
import { resolveStudentFee, istMonthString } from "@/lib/fees";
import { FEATURES } from "@/lib/features";
import { billedAmount, concessionsByStudent } from "@/lib/concessions";

/**
 * Creates this month's PENDING fee records for the admin's academy only.
 * Amount = student.feeOverride ?? batch.monthlyFee ?? org.defaultMonthlyFee.
 * Students with no fee configured are skipped (reported back) instead of inventing an amount.
 */
export async function generateMonthlyFees() {
  const { session } = await requirePermission("fees.manage");
  const org = await db.organization.findUnique({ where: { id: session.orgId }, select: { defaultMonthlyFee: true } })
  const students = await db.student.findMany({
    where: { orgId: session.orgId },
    include: { enrollments: { include: { batch: true } } },
  })
  const currentMonth = istMonthString()
  let count = 0
  // V9 Brand Studio: scholarship / CSR concessions (FeeConcession table exists only once the flag's SQL is applied).
  const concessions = FEATURES.inclusive
    ? concessionsByStudent(await db.feeConcession.findMany({ where: { orgId: session.orgId, revokedAt: null } }))
    : null

  for (const student of students) {
    const base = resolveStudentFee(student, org?.defaultMonthlyFee)
    const amount = concessions ? billedAmount(base, concessions.get(student.id), currentMonth) : base
    if (amount <= 0) continue // fee not set — admin must set batch/default fee first
    await db.feeRecord.upsert({
      where: {
        studentId_month: {
          studentId: student.id,
          month: currentMonth
        }
      },
      update: {},
      create: {
        orgId: session.orgId,
        studentId: student.id,
        month: currentMonth,
        amount,
        status: "PENDING"
      }
    })
    count++
  }

  revalidatePath("/")
  revalidatePath("/org")
  return count
}

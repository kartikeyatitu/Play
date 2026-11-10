"use server"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requirePermission } from "@/lib/membership";
import { istMonthString } from "@/lib/fees";
import { loadSiblingSettings, planMonthlyFees, recordSiblingDiscount } from "@/lib/monthly-fees-server";
import { SIBLING_SETTINGS_ACTION, validateSiblingSettings } from "@/lib/family/sibling-settings";

/**
 * Creates this month's PENDING fee records for the admin's academy only.
 * Amount = student.feeOverride ?? batch.monthlyFee ?? org.defaultMonthlyFee.
 * Students with no fee configured are skipped (reported back) instead of inventing an amount.
 */
export async function generateMonthlyFees() {
  const { session } = await requirePermission("fees.manage");
  const org = await db.organization.findUnique({ where: { id: session.orgId }, select: { defaultMonthlyFee: true } })
  const currentMonth = istMonthString()
  // Fee, less concessions, less the sibling discount when the academy has it on (src/lib/monthly-fees-server).
  const { lines, settings } = await planMonthlyFees(session.orgId, currentMonth, org?.defaultMonthlyFee)
  let count = 0
  for (const line of lines) {
    if (line.amount <= 0) continue // fee not set — admin must set batch/default fee first
    const existing = await db.feeRecord.findUnique({
      where: { studentId_month: { studentId: line.studentId, month: currentMonth } },
      select: { id: true },
    })
    if (!existing) {
      const row = await db.feeRecord.create({
        data: { orgId: session.orgId, studentId: line.studentId, month: currentMonth, amount: line.amount, status: "PENDING" },
        select: { id: true },
      })
      await recordSiblingDiscount(session.orgId, session.id, row.id, line, currentMonth, settings)
    }
    count++
  }

  revalidatePath("/")
  revalidatePath("/org")
  return count
}

/** The academy's sibling discount (off unless the owner turns it on). */
export async function getSiblingDiscountSettings() {
  const { session } = await requirePermission("fees.manage");
  return (await loadSiblingSettings(session.orgId)).settings
}

/** Turn the sibling discount on or off and set the percentages. Applies from the next fee generation. */
export async function saveSiblingDiscountSettings(input: { enabled?: unknown; secondChildPercent?: unknown; thirdPlusPercent?: unknown }) {
  const { session } = await requirePermission("fees.manage");
  const v = validateSiblingSettings(input ?? {})
  if (!v.ok) return { success: false as const, error: v.error }
  await db.auditLog.create({
    data: { userId: session.id, orgId: session.orgId, action: SIBLING_SETTINGS_ACTION, details: JSON.stringify(v.settings) },
  })
  revalidatePath("/org")
  return { success: true as const, settings: v.settings }
}

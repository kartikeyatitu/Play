import { db } from "@/lib/db";
import { resolveStudentFee } from "@/lib/fees";
import { billedAmount, concessionsByStudent } from "@/lib/concessions";
import { FEATURES } from "@/lib/features";
import { siblingDiscounts } from "@/lib/family/sibling-discount";
import { groupFamilies, parseSiblingSettings, SIBLING_DISCOUNT_ACTION, SIBLING_SETTINGS_ACTION, type SiblingSettings } from "@/lib/family/sibling-settings";

export type FeeLine = { studentId: string; amount: number; siblingDiscount: number };

/** The academy's sibling-discount setting and who set it (discount audit rows are attributed to them). */
export async function loadSiblingSettings(orgId: string): Promise<{ settings: SiblingSettings; setById: string | null }> {
  const row = await db.auditLog.findFirst({
    where: { orgId, action: SIBLING_SETTINGS_ACTION },
    orderBy: { createdAt: "desc" },
    select: { details: true, userId: true },
  });
  return row ? { settings: parseSiblingSettings(row.details), setById: row.userId } : { settings: parseSiblingSettings(null), setById: null };
}

/**
 * What each student is billed for a month: their fee (student override, batch fee or academy
 * default), less concessions, less the sibling discount when the academy has switched it on.
 * Students whose fee resolves to 0 are left out. Shared by the cron and the owner's button.
 */
export async function planMonthlyFees(orgId: string, month: string, defaultMonthlyFee: number | null | undefined) {
  const students = await db.student.findMany({
    where: { orgId },
    include: { enrollments: { include: { batch: true } } },
  });
  // V9 Brand Studio: scholarship / CSR concessions; a 100% waiver resolves to 0 and is skipped below.
  const concessions = FEATURES.inclusive
    ? concessionsByStudent(await db.feeConcession.findMany({ where: { orgId, revokedAt: null } }))
    : null;
  const afterConcessions = students.map((st) => {
    const base = resolveStudentFee(st, defaultMonthlyFee);
    return { studentId: st.id, parentId: st.parentId, fee: concessions ? billedAmount(base, concessions.get(st.id), month) : base };
  });

  const { settings, setById } = await loadSiblingSettings(orgId);
  const discount = new Map<string, number>();
  if (settings.enabled) {
    const links = FEATURES.familyAccounts
      ? await db.guardianLink.findMany({ where: { studentId: { in: students.map((s) => s.id) } }, select: { userId: true, studentId: true } })
      : [];
    const byId = new Map(afterConcessions.map((l) => [l.studentId, l]));
    for (const family of groupFamilies(afterConcessions.map((l) => ({ id: l.studentId, parentId: l.parentId })), links)) {
      if (family.length < 2) continue;
      const rows = siblingDiscounts(
        family.map((id) => ({ studentId: id, fee: byId.get(id)!.fee })),
        { secondChildPercent: settings.secondChildPercent, thirdPlusPercent: settings.thirdPlusPercent },
      );
      for (const r of rows) if (r.discount > 0) discount.set(r.studentId, r.discount);
    }
  }

  const lines: FeeLine[] = afterConcessions
    .filter((l) => l.fee > 0)
    .map((l) => ({ studentId: l.studentId, amount: l.fee - (discount.get(l.studentId) ?? 0), siblingDiscount: discount.get(l.studentId) ?? 0 }));
  return { lines, settings, setById };
}

/** Records a sibling discount on a newly created fee line, so the owner can see why it is lower. */
export async function recordSiblingDiscount(orgId: string, userId: string | null, feeRecordId: string, line: FeeLine, month: string, settings: SiblingSettings) {
  if (!userId || line.siblingDiscount <= 0) return;
  try {
    await db.auditLog.create({
      data: {
        userId,
        orgId,
        action: SIBLING_DISCOUNT_ACTION,
        details: JSON.stringify({ feeRecordId, studentId: line.studentId, month, fee: line.amount + line.siblingDiscount, discount: line.siblingDiscount, rule: settings }),
      },
    });
  } catch (e) {
    console.error("monthly fees: sibling discount audit failed", e instanceof Error ? e.message : e);
  }
}

/**
 * Cron-only fee generation. Deliberately NOT in src/app/actions/*: functions exported from a
 * "use server" file are callable by any visitor as a server action, so this lives in a plain
 * server module imported only by the CRON_SECRET-protected route (src/app/api/cron/monthly-fees).
 */
export async function generateMonthlyFeesForOrg(orgId: string, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { feesCreated: 0 };
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { defaultMonthlyFee: true, isActive: true } });
  if (!org || org.isActive === false) return { feesCreated: 0 };

  const { lines, settings, setById } = await planMonthlyFees(orgId, month, org.defaultMonthlyFee);
  let feesCreated = 0;
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const existing = await db.feeRecord.findUnique({
      where: { studentId_month: { studentId: line.studentId, month } },
      select: { id: true },
    });
    if (existing) continue;
    const row = await db.feeRecord.create({
      data: { orgId, studentId: line.studentId, month, amount: line.amount, status: "PENDING" },
      select: { id: true },
    });
    await recordSiblingDiscount(orgId, setById, row.id, line, month, settings);
    feesCreated++;
  }
  return { feesCreated };
}

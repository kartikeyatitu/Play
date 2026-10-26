// Server-only helper: a student's monthly fee after any active scholarship / CSR concession (V9).
// Returns the plain resolved fee when FEATURES.inclusive is off (FeeConcession table may not exist yet).
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { resolveStudentFee } from "@/lib/fees";
import { billedAmount } from "@/lib/concessions";

export async function concessionAdjustedFee(student: any, orgDefault: number | null | undefined, month: string): Promise<number> {
  const base = resolveStudentFee(student, orgDefault);
  if (!FEATURES.inclusive || !student?.id || !student?.orgId) return base;
  const list = await db.feeConcession.findMany({ where: { orgId: student.orgId, studentId: student.id, revokedAt: null } });
  return billedAmount(base, list, month);
}

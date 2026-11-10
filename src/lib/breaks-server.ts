// Server-only reads for breaks and make-up credits. Writes happen in src/app/actions/breaks.ts.
import { db } from "@/lib/db";
import { BREAK_ACTION, MAKEUP_CREDIT_ACTION, MAKEUP_USED_ACTION, currentBreaks, openMakeups, type MakeupCredit, type StudentBreak } from "./breaks";

/** Each child's current or upcoming break in this academy. */
export async function loadBreaks(orgId: string, currentMonth: string): Promise<Map<string, StudentBreak>> {
  try {
    const rows = await db.auditLog.findMany({
      where: { orgId, action: BREAK_ACTION },
      orderBy: { createdAt: "desc" },
      select: { details: true },
      take: 5000,
    });
    return currentBreaks(rows, currentMonth);
  } catch (e) {
    console.error("breaks: load failed", e instanceof Error ? e.message : e);
    return new Map();
  }
}

/** Make-up sessions the academy still owes, optionally for some children only. */
export async function loadOpenMakeups(orgId: string, studentIds?: string[]): Promise<MakeupCredit[]> {
  try {
    const since = new Date(Date.now() - 120 * 86_400_000); // credits older than ~4 months drop off
    const [credits, used] = await Promise.all([
      db.auditLog.findMany({ where: { orgId, action: MAKEUP_CREDIT_ACTION, createdAt: { gte: since } }, select: { id: true, details: true }, orderBy: { createdAt: "asc" }, take: 5000 }),
      db.auditLog.findMany({ where: { orgId, action: MAKEUP_USED_ACTION, createdAt: { gte: since } }, select: { details: true }, take: 5000 }),
    ]);
    const open = openMakeups(credits, used);
    return studentIds ? open.filter((c) => studentIds.includes(c.studentId)) : open;
  } catch (e) {
    console.error("makeups: load failed", e instanceof Error ? e.message : e);
    return [];
  }
}

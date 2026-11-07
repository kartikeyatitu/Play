// Server-only DataRequest helpers. DataRequest has no studentId column, so the child an EXPORT is for
// is recorded on the creating AuditLog row (action DATA_REQUEST, event CREATED). Schema follow-up:
// add DataRequest.studentId so this lookup is not needed.
import { db } from "@/lib/db";
import { DATA_REQUEST_AUDIT_ACTION } from "./data-requests";

export async function recordDataRequestEvent(
  actorUserId: string,
  orgId: string | null,
  details: { event: "CREATED" | "STATUS" | "DOWNLOADED"; referenceId: string; [k: string]: unknown },
) {
  try {
    await db.auditLog.create({ data: { userId: actorUserId, orgId, action: DATA_REQUEST_AUDIT_ACTION, details: JSON.stringify(details) } });
  } catch (e) {
    console.error("DataRequest audit failed", e instanceof Error ? e.message : "unknown");
  }
}

/** referenceId -> studentId, from the CREATED audit rows. */
export async function studentIdsForRequests(referenceIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!referenceIds.length) return out;
  const rows = await db.auditLog.findMany({
    where: { action: DATA_REQUEST_AUDIT_ACTION, OR: referenceIds.slice(0, 200).map((r) => ({ details: { contains: `"referenceId":"${r}"` } })) },
    select: { details: true },
  });
  for (const r of rows) {
    try {
      const d = JSON.parse(r.details || "{}");
      if (d?.event === "CREATED" && typeof d.referenceId === "string" && typeof d.studentId === "string") out.set(d.referenceId, d.studentId);
    } catch {
      // ignore malformed rows
    }
  }
  return out;
}

/** Status-change history for the queue (newest first). */
export async function dataRequestHistory(referenceIds: string[]) {
  if (!referenceIds.length) return new Map<string, { at: Date; by: string; event: string; status?: string; note?: string }[]>();
  const rows = await db.auditLog.findMany({
    where: { action: DATA_REQUEST_AUDIT_ACTION, OR: referenceIds.slice(0, 200).map((r) => ({ details: { contains: `"referenceId":"${r}"` } })) },
    select: { details: true, createdAt: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const out = new Map<string, { at: Date; by: string; event: string; status?: string; note?: string }[]>();
  for (const r of rows) {
    try {
      const d = JSON.parse(r.details || "{}");
      if (typeof d?.referenceId !== "string") continue;
      const list = out.get(d.referenceId) ?? [];
      list.push({ at: r.createdAt, by: r.user.name, event: String(d.event ?? ""), status: d.to, note: d.note });
      out.set(d.referenceId, list);
    } catch {
      // ignore
    }
  }
  return out;
}

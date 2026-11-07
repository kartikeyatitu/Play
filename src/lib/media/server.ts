/**
 * Database side of consent-first media. Server only. Every function here is a no-op (or returns an
 * empty result) while FEATURES.media is off, because the Media* tables may not exist yet.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getMembership } from "@/lib/membership";
import type { MediaAuditAction } from "./constants";
import {
  ANONYMOUS_VIEWER,
  explainView,
  type ConsentForView,
  type MediaViewer,
  type SubjectForView,
} from "./policy";
import { purgeReason, retentionDeadline, shouldScheduleRetention, type PurgeReason } from "./retention";
import { blobMediaStorage, type MediaStorage } from "./storage";
import { allKeys } from "./validation";

export const mediaEnabled = () => FEATURES.media === true;

type Tx = Prisma.TransactionClient | typeof db;

export async function writeMediaAudit(
  client: Tx,
  entry: { orgId: string; mediaId?: string | null; actorUserId?: string | null; action: MediaAuditAction; details?: Prisma.InputJsonValue },
) {
  await client.mediaAudit.create({
    data: {
      orgId: entry.orgId,
      mediaId: entry.mediaId ?? null,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      details: entry.details,
    },
  });
}

/** Students this user is guardian of: Student.parentId, plus verified GuardianLinks when family accounts are on. */
export async function guardianStudentIds(userId: string): Promise<string[]> {
  const own = await db.student.findMany({ where: { parentId: userId }, select: { id: true } });
  const ids = new Set(own.map((s) => s.id));
  if (FEATURES.familyAccounts) {
    const links = await db.guardianLink.findMany({ where: { userId, verifiedAt: { not: null } }, select: { studentId: true } });
    for (const l of links) ids.add(l.studentId);
  }
  return [...ids];
}

export async function isGuardianOf(userId: string, studentId: string): Promise<boolean> {
  return (await guardianStudentIds(userId)).includes(studentId);
}

/** Builds the viewer for the given academies. Staff status comes from OrgMembership (src/lib/membership.ts). */
export async function loadViewer(userId: string | null, orgIds: string[]): Promise<MediaViewer> {
  if (!userId) return ANONYMOUS_VIEWER;
  const staffOrgIds: string[] = [];
  for (const orgId of new Set(orgIds)) {
    if (await getMembership(userId, orgId)) staffOrgIds.push(orgId);
  }
  const guardianOf = await guardianStudentIds(userId);
  const enrolments = guardianOf.length
    ? await db.batchEnrollment.findMany({ where: { studentId: { in: guardianOf } }, select: { batchId: true } })
    : [];
  return {
    userId,
    staffOrgIds,
    guardianOfStudentIds: guardianOf,
    childBatchIds: [...new Set(enrolments.map((e) => e.batchId))],
  };
}

type AssetRow = {
  id: string;
  orgId: string;
  contextType: string;
  status: string;
  deletedAt: Date | null;
  subjects: { studentId: string }[];
};

/** Subjects (with their batches in the asset's academy) and consents for a set of assets. */
export async function loadAccessData(assets: AssetRow[]) {
  const studentIds = [...new Set(assets.flatMap((a) => a.subjects.map((s) => s.studentId)))];
  const orgIds = [...new Set(assets.map((a) => a.orgId))];
  if (!studentIds.length) return { batchesByStudent: new Map<string, { batchId: string; orgId: string | null }[]>(), consents: [] as ConsentForView[] };
  const [enrolments, consents] = await Promise.all([
    db.batchEnrollment.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, batchId: true, batch: { select: { orgId: true } } },
    }),
    db.mediaConsent.findMany({
      where: { studentId: { in: studentIds }, orgId: { in: orgIds }, withdrawnAt: null },
      select: { orgId: true, studentId: true, scope: true, withdrawnAt: true },
    }),
  ]);
  const batchesByStudent = new Map<string, { batchId: string; orgId: string | null }[]>();
  for (const e of enrolments) {
    const list = batchesByStudent.get(e.studentId) ?? [];
    list.push({ batchId: e.batchId, orgId: e.batch.orgId });
    batchesByStudent.set(e.studentId, list);
  }
  return { batchesByStudent, consents };
}

export function subjectsFor(asset: AssetRow, batchesByStudent: Map<string, { batchId: string; orgId: string | null }[]>): SubjectForView[] {
  return asset.subjects.map((s) => ({
    studentId: s.studentId,
    batchIds: (batchesByStudent.get(s.studentId) ?? []).filter((b) => b.orgId === asset.orgId).map((b) => b.batchId),
  }));
}

/** Filters assets down to the ones this viewer may see. */
export async function filterVisible<T extends AssetRow>(viewer: MediaViewer, assets: T[]): Promise<T[]> {
  if (!assets.length) return [];
  const { batchesByStudent, consents } = await loadAccessData(assets);
  return assets.filter((a) => explainView(viewer, a, subjectsFor(a, batchesByStudent), consents).allowed);
}

/** One asset plus the access decision, for the file-streaming route. */
export async function loadAssetForViewer(assetId: string, userId: string | null) {
  const asset = await db.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      orgId: true,
      contextType: true,
      status: true,
      deletedAt: true,
      storageKey: true,
      variants: true,
      mimeType: true,
      subjects: { select: { studentId: true } },
    },
  });
  if (!asset) return null;
  const viewer = await loadViewer(userId, [asset.orgId]);
  const { batchesByStudent, consents } = await loadAccessData([asset]);
  const decision = explainView(viewer, asset, subjectsFor(asset, batchesByStudent), consents);
  return { asset, decision };
}

export interface PurgeSummary {
  skipped?: "FEATURE_OFF" | "STORAGE_NOT_CONFIGURED";
  scheduled: number;
  purged: Record<PurgeReason, number>;
  failed: number;
}

/**
 * Retention and clean-up job (cron). 1) Sets deleteAfter on READY assets whose tagged children have
 * all left. 2) Removes files and rows for assets past deleteAfter, soft-deleted assets whose file
 * delete failed earlier, and abandoned PENDING uploads. Files are removed from storage, not only marked.
 */
export async function purgeMedia(now = new Date(), storage: MediaStorage = blobMediaStorage, limit = 200): Promise<PurgeSummary> {
  const summary: PurgeSummary = { scheduled: 0, purged: { RETENTION: 0, DELETED: 0, ABANDONED: 0 }, failed: 0 };
  if (!mediaEnabled()) return { ...summary, skipped: "FEATURE_OFF" };
  if (!storage.configured()) return { ...summary, skipped: "STORAGE_NOT_CONFIGURED" };

  // 1) Schedule retention.
  const ready = await db.mediaAsset.findMany({
    where: { status: "READY", deleteAfter: null, subjects: { some: {} } },
    select: { id: true, orgId: true, status: true, deleteAfter: true, subjects: { select: { studentId: true } } },
    take: limit,
  });
  if (ready.length) {
    const ids = [...new Set(ready.flatMap((a) => a.subjects.map((s) => s.studentId)))];
    const enrolments = await db.batchEnrollment.findMany({
      where: { studentId: { in: ids } },
      select: { studentId: true, batch: { select: { orgId: true } } },
    });
    for (const a of ready) {
      const subjects = a.subjects.map((s) => ({
        enrolledBatchCount: enrolments.filter((e) => e.studentId === s.studentId && e.batch.orgId === a.orgId).length,
      }));
      if (!shouldScheduleRetention({ status: a.status, deleteAfter: a.deleteAfter, subjects })) continue;
      await db.mediaAsset.update({ where: { id: a.id }, data: { deleteAfter: retentionDeadline(now) } });
      summary.scheduled++;
    }
  }

  // 2) Purge.
  const abandonedBefore = new Date(now.getTime() - 24 * 3600_000);
  const candidates = await db.mediaAsset.findMany({
    where: {
      OR: [
        { status: "DELETED" },
        { deletedAt: { not: null } },
        { deleteAfter: { lte: now } },
        { status: "PENDING", createdAt: { lte: abandonedBefore } },
      ],
    },
    select: { id: true, orgId: true, status: true, deleteAfter: true, deletedAt: true, createdAt: true, storageKey: true, variants: true },
    take: limit,
  });
  for (const a of candidates) {
    const reason = purgeReason(a, now);
    if (!reason) continue;
    try {
      await storage.remove(allKeys(a));
      await db.$transaction(async (tx) => {
        await writeMediaAudit(tx, { orgId: a.orgId, mediaId: a.id, action: "PURGE", details: { reason, mediaId: a.id } });
        await tx.mediaAsset.delete({ where: { id: a.id } });
      });
      summary.purged[reason]++;
    } catch (e) {
      summary.failed++;
      console.error("[media purge] failed", a.id, e instanceof Error ? e.message : e);
    }
  }
  return summary;
}

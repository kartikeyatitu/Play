"use server";

/**
 * Consent-first photos (flag FEATURES.media). Coaches, managers and owners upload and tag; parents
 * cannot upload in v1. Files go straight from the browser to the private Blob store (see
 * /api/media/upload); this file creates the rows, confirms uploads, tags children and deletes.
 * Every function returns { ok: false } and touches no Media* table while the flag is off.
 */
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireMember } from "@/lib/membership";
import {
  isMediaContextType,
  MEDIA_CONTEXT_LABELS,
  MEDIA_MAX_TAGS,
  MEDIA_MAX_THUMB_BYTES,
  MEDIA_MAX_UPLOAD_BYTES,
  type MediaContextType,
} from "@/lib/media/constants";
import { canDeleteMedia, canUploadMedia } from "@/lib/media/policy";
import { filterVisible, guardianStudentIds, loadViewer, mediaEnabled, writeMediaAudit } from "@/lib/media/server";
import { blobMediaStorage } from "@/lib/media/storage";
import { allKeys, checkBatchSize, checkUploadMeta, cleanIds, mediaKeys, parseVariants } from "@/lib/media/validation";
import { initialStatusAfterUpload } from "@/lib/media/vendors";

type Fail = { ok: false; error: string };
const OFF: Fail = { ok: false, error: "Photos are not switched on for this academy yet." };
const ACCESS_ERRORS = new Set(["No academy found", "You are not an active member of this academy"]);

async function staffContext() {
  try {
    const ctx = await requireMember(["ADMIN", "COACH", "STAFF"]);
    return { ok: true as const, ...ctx };
  } catch (e: any) {
    if (typeof e?.message === "string" && ACCESS_ERRORS.has(e.message)) return { ok: false as const, error: e.message as string };
    throw e;
  }
}

async function uploaderContext() {
  const ctx = await staffContext();
  if (!ctx.ok) return ctx;
  if (!canUploadMedia(ctx.membership)) return { ok: false as const, error: "Only coaches and academy admins can add photos." };
  return ctx;
}

async function checkContext(orgId: string, contextType: MediaContextType, contextId: string | null): Promise<string | null> {
  if (contextType === "GALLERY") return contextId ? "Gallery photos don't belong to a session or match." : null;
  if (!contextId) return "Pick the session, match or tournament first.";
  const found =
    contextType === "SESSION"
      ? await db.session.findFirst({ where: { id: contextId, batch: { orgId } }, select: { id: true } })
      : contextType === "MATCH"
        ? await db.fixture.findFirst({ where: { id: contextId, orgId }, select: { id: true } })
        : await db.competition.findFirst({ where: { id: contextId, orgId }, select: { id: true } });
  return found ? null : "That session, match or tournament was not found in your academy.";
}

/** Students this member may tag: coaches only children in batches they coach; owners and managers anyone in the academy. */
async function taggableWhere(orgId: string, userId: string, role: string) {
  return role === "COACH"
    ? { orgId, enrollments: { some: { batch: { orgId, coachId: userId } } } }
    : { orgId };
}

export type BeginUploadInput = {
  contextType: string;
  contextId?: string | null;
  files: { mimeType: string; bytes: number; thumbBytes: number }[];
};

export async function beginMediaUploads(
  input: BeginUploadInput,
): Promise<{ ok: true; uploads: { assetId: string; webKey: string; thumbKey: string }[] } | Fail> {
  if (!mediaEnabled()) return OFF;
  const ctx = await uploaderContext();
  if (!ctx.ok) return ctx;
  if (!blobMediaStorage.configured()) return { ok: false, error: "Photo storage is not configured yet." };
  const orgId = ctx.session.orgId;

  if (!isMediaContextType(input?.contextType)) return { ok: false, error: "Unknown photo context." };
  const contextId = input.contextId ? String(input.contextId).slice(0, 64) : null;
  const files = Array.isArray(input.files) ? input.files : [];
  const size = checkBatchSize(files.length);
  if (!size.ok) return size;
  for (const f of files) {
    const c = checkUploadMeta(f);
    if (!c.ok) return c;
  }
  const ctxError = await checkContext(orgId, input.contextType, contextId);
  if (ctxError) return { ok: false, error: ctxError };

  const uploads = files.map((f) => {
    const assetId = randomBytes(12).toString("hex");
    const keys = mediaKeys(orgId, assetId, randomBytes(16).toString("hex"), f.mimeType);
    return { assetId, webKey: keys.web, thumbKey: keys.thumb, file: f };
  });
  await db.mediaAsset.createMany({
    data: uploads.map((u) => ({
      id: u.assetId,
      orgId,
      contextType: input.contextType,
      contextId,
      uploaderId: ctx.session.id,
      kind: "PHOTO",
      status: "PENDING",
      storageKey: u.webKey,
      mimeType: u.file.mimeType,
      bytes: Math.round(u.file.bytes),
      variants: { thumb: u.thumbKey },
    })),
  });
  return { ok: true, uploads: uploads.map(({ assetId, webKey, thumbKey }) => ({ assetId, webKey, thumbKey })) };
}

/** Called after the browser finished uploading: checks the files really are in storage, then marks READY. */
export async function completeMediaUploads(assetIds: string[]): Promise<{ ok: true; ready: string[]; failed: string[] } | Fail> {
  if (!mediaEnabled()) return OFF;
  const ctx = await uploaderContext();
  if (!ctx.ok) return ctx;
  const ids = cleanIds(assetIds, 50);
  const assets = await db.mediaAsset.findMany({
    where: { id: { in: ids }, orgId: ctx.session.orgId, uploaderId: ctx.session.id, status: "PENDING" },
    select: { id: true, orgId: true, storageKey: true, variants: true, mimeType: true, contextType: true, contextId: true },
  });
  const ready: string[] = [];
  const failed: string[] = ids.filter((id) => !assets.some((a) => a.id === id));
  const next = initialStatusAfterUpload();
  for (const a of assets) {
    const thumbKey = parseVariants(a.variants).thumb;
    const [web, thumb] = await Promise.all([
      blobMediaStorage.exists(a.storageKey),
      thumbKey ? blobMediaStorage.exists(thumbKey) : Promise.resolve(null),
    ]);
    const okFile = web && web.size <= MEDIA_MAX_UPLOAD_BYTES && web.contentType === a.mimeType;
    const okThumb = thumb && thumb.size <= MEDIA_MAX_THUMB_BYTES;
    if (!okFile || !okThumb) {
      failed.push(a.id);
      continue;
    }
    await db.$transaction(async (tx) => {
      // Automated moderation is disabled (vendors.ts), so photos go READY; review is manual.
      await tx.mediaAsset.update({ where: { id: a.id }, data: { status: next === "READY" ? "READY" : "PENDING", bytes: web.size } });
      await writeMediaAudit(tx, {
        orgId: a.orgId,
        mediaId: a.id,
        actorUserId: ctx.session.id,
        action: "UPLOAD",
        details: { contextType: a.contextType, contextId: a.contextId, bytes: web.size, mimeType: a.mimeType },
      });
    });
    ready.push(a.id);
  }
  revalidatePath("/org/media");
  return { ok: true, ready, failed };
}

/** Replaces the set of children tagged in a photo. Manual tagging only: there is no face recognition. */
export async function setMediaTags(assetId: string, studentIds: string[]): Promise<{ ok: true; added: number; removed: number } | Fail> {
  if (!mediaEnabled()) return OFF;
  const ctx = await uploaderContext();
  if (!ctx.ok) return ctx;
  const orgId = ctx.session.orgId;
  const asset = await db.mediaAsset.findFirst({
    where: { id: String(assetId), orgId, deletedAt: null, status: { not: "DELETED" } },
    select: { id: true, uploaderId: true, subjects: { select: { studentId: true } } },
  });
  if (!asset) return { ok: false, error: "Photo not found." };
  if (ctx.membership.role === "COACH" && asset.uploaderId !== ctx.session.id) {
    return { ok: false, error: "Coaches can tag only photos they uploaded." };
  }
  const wanted = cleanIds(studentIds, MEDIA_MAX_TAGS);
  const allowed = wanted.length
    ? await db.student.findMany({
        where: { id: { in: wanted }, ...(await taggableWhere(orgId, ctx.session.id, ctx.membership.role)) },
        select: { id: true },
      })
    : [];
  if (allowed.length !== wanted.length) return { ok: false, error: "You can tag only players from your academy (coaches: your batches)." };

  const current = new Set(asset.subjects.map((s) => s.studentId));
  const next = new Set(wanted);
  const added = wanted.filter((id) => !current.has(id));
  const removed = [...current].filter((id) => !next.has(id));
  if (!added.length && !removed.length) return { ok: true, added: 0, removed: 0 };

  await db.$transaction(async (tx) => {
    if (removed.length) await tx.mediaSubject.deleteMany({ where: { mediaId: asset.id, studentId: { in: removed } } });
    if (added.length) {
      await tx.mediaSubject.createMany({
        data: added.map((studentId) => ({ orgId, mediaId: asset.id, studentId, taggedById: ctx.session.id })),
        skipDuplicates: true,
      });
    }
    await writeMediaAudit(tx, { orgId, mediaId: asset.id, actorUserId: ctx.session.id, action: "TAG", details: { added, removed } });
  });
  revalidatePath("/org/media");
  return { ok: true, added: added.length, removed: removed.length };
}

/** Deletes the files from storage and the row. If storage fails, marks DELETED and the purge job retries. */
export async function deleteMediaAsset(assetId: string): Promise<{ ok: true } | Fail> {
  if (!mediaEnabled()) return OFF;
  const ctx = await uploaderContext();
  if (!ctx.ok) return ctx;
  const orgId = ctx.session.orgId;
  const asset = await db.mediaAsset.findFirst({
    where: { id: String(assetId), orgId },
    select: { id: true, uploaderId: true, storageKey: true, variants: true, subjects: { select: { studentId: true } } },
  });
  if (!asset) return { ok: false, error: "Photo not found." };
  if (!canDeleteMedia(ctx.membership, ctx.session.id, asset)) return { ok: false, error: "Coaches can delete only photos they uploaded." };

  let fileRemoved = true;
  try {
    await blobMediaStorage.remove(allKeys(asset));
  } catch (e) {
    fileRemoved = false;
    console.error("[media] file delete failed; purge job will retry", asset.id, e instanceof Error ? e.message : e);
  }
  await db.$transaction(async (tx) => {
    await writeMediaAudit(tx, {
      orgId,
      mediaId: asset.id,
      actorUserId: ctx.session.id,
      action: "DELETE",
      details: { mediaId: asset.id, taggedCount: asset.subjects.length, fileRemoved },
    });
    if (fileRemoved) await tx.mediaAsset.delete({ where: { id: asset.id } });
    else await tx.mediaAsset.update({ where: { id: asset.id }, data: { status: "DELETED", deletedAt: new Date() } });
  });
  revalidatePath("/org/media");
  return { ok: true };
}

export type StaffMediaItem = {
  id: string;
  status: string;
  createdAt: string;
  uploaderId: string;
  mine: boolean;
  contextType: string;
  contextId: string | null;
  tagged: { id: string; name: string }[];
};

/** Staff view of one context's photos (all statuses except deleted). Academy staff always see these. */
export async function listContextMedia(input: { contextType: string; contextId?: string | null }): Promise<{ ok: true; items: StaffMediaItem[] } | Fail> {
  if (!mediaEnabled()) return OFF;
  const ctx = await staffContext();
  if (!ctx.ok) return ctx;
  if (!isMediaContextType(input?.contextType)) return { ok: false, error: "Unknown photo context." };
  const rows = await db.mediaAsset.findMany({
    where: {
      orgId: ctx.session.orgId,
      contextType: input.contextType,
      contextId: input.contextId ? String(input.contextId) : null,
      deletedAt: null,
      status: { in: ["READY", "QUARANTINED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, status: true, createdAt: true, uploaderId: true, contextType: true, contextId: true, subjects: { select: { studentId: true } } },
  });
  const ids = [...new Set(rows.flatMap((r) => r.subjects.map((s) => s.studentId)))];
  const students = ids.length ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(students.map((s) => [s.id, s.name]));
  return {
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      uploaderId: r.uploaderId,
      mine: r.uploaderId === ctx.session.id,
      contextType: r.contextType,
      contextId: r.contextId,
      tagged: r.subjects.map((s) => ({ id: s.studentId, name: names.get(s.studentId) ?? "Player" })),
    })),
  };
}

export async function listTaggableStudents(): Promise<{ ok: true; students: { id: string; name: string }[] } | Fail> {
  if (!mediaEnabled()) return OFF;
  const ctx = await uploaderContext();
  if (!ctx.ok) return ctx;
  const students = await db.student.findMany({
    where: await taggableWhere(ctx.session.orgId, ctx.session.id, ctx.membership.role),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 1000,
  });
  return { ok: true, students };
}

export type GalleryItem = {
  id: string;
  createdAt: string;
  contextLabel: string;
  /** Only the viewer's own children are named; other children in the photo are never listed. */
  myChildren: string[];
};

/** Parent gallery: only photos canView allows for this guardian, newest first. */
export async function listMyGallery(): Promise<{ ok: true; items: GalleryItem[] } | Fail> {
  if (!mediaEnabled()) return OFF;
  const session = await requireAuth();
  const childIds = await guardianStudentIds(session.id);
  if (!childIds.length) return { ok: true, items: [] };
  const children = await db.student.findMany({
    where: { id: { in: childIds } },
    select: { id: true, name: true, orgId: true, enrollments: { select: { batchId: true } } },
  });
  const orgIds = [...new Set(children.map((c) => c.orgId).filter((o): o is string => !!o))];
  if (!orgIds.length) return { ok: true, items: [] };
  const batchIds = [...new Set(children.flatMap((c) => c.enrollments.map((e) => e.batchId)))];

  // Candidates: photos tagging my children or children in my children's batches. canView decides.
  const rows = await db.mediaAsset.findMany({
    where: {
      orgId: { in: orgIds },
      status: "READY",
      deletedAt: null,
      subjects: {
        some: {
          OR: [{ studentId: { in: childIds } }, ...(batchIds.length ? [{ studentId: { in: await classmateIds(batchIds) } }] : [])],
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, orgId: true, contextType: true, status: true, deletedAt: true, createdAt: true, subjects: { select: { studentId: true } } },
  });
  const viewer = await loadViewer(session.id, orgIds);
  const visible = await filterVisible(viewer, rows);
  const names = new Map(children.map((c) => [c.id, c.name]));
  return {
    ok: true,
    items: visible.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      contextLabel: isMediaContextType(r.contextType) ? MEDIA_CONTEXT_LABELS[r.contextType] : "Photo",
      myChildren: r.subjects.map((s) => names.get(s.studentId)).filter((n): n is string => !!n),
    })),
  };
}

async function classmateIds(batchIds: string[]): Promise<string[]> {
  const rows = await db.batchEnrollment.findMany({ where: { batchId: { in: batchIds } }, select: { studentId: true }, take: 5000 });
  return [...new Set(rows.map((r) => r.studentId))];
}

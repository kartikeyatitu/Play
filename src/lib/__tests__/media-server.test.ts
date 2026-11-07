import { describe, it, expect, vi, beforeEach } from "vitest";

const flags = vi.hoisted(() => ({ media: false, familyAccounts: false }));
const db = vi.hoisted(() => ({
  mediaAsset: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  mediaAudit: { create: vi.fn() },
  batchEnrollment: { findMany: vi.fn() },
  mediaConsent: { findMany: vi.fn() },
  student: { findMany: vi.fn() },
  guardianLink: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/features", () => ({ FEATURES: flags }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/membership", () => ({ getMembership: vi.fn(async () => null) }));
vi.mock("@vercel/blob", () => ({ del: vi.fn(), get: vi.fn(), head: vi.fn() }));

import { filterVisible, loadViewer, purgeMedia } from "@/lib/media/server";
import type { MediaStorage } from "@/lib/media/storage";

const storage = (over: Partial<MediaStorage> = {}): MediaStorage => ({
  configured: () => true,
  exists: vi.fn(),
  stream: vi.fn(),
  remove: vi.fn(async () => {}),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  flags.media = false;
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

describe("purgeMedia", () => {
  it("does nothing at all while the media flag is off", async () => {
    const s = storage();
    const r = await purgeMedia(new Date(), s);
    expect(r.skipped).toBe("FEATURE_OFF");
    expect(db.mediaAsset.findMany).not.toHaveBeenCalled();
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("skips when storage is not configured", async () => {
    flags.media = true;
    const r = await purgeMedia(new Date(), storage({ configured: () => false }));
    expect(r.skipped).toBe("STORAGE_NOT_CONFIGURED");
    expect(db.mediaAsset.findMany).not.toHaveBeenCalled();
  });

  it("schedules retention for photos whose children all left, and purges files then rows with an audit", async () => {
    flags.media = true;
    const now = new Date("2026-11-07T00:00:00Z");
    db.mediaAsset.findMany
      .mockResolvedValueOnce([
        { id: "left", orgId: "o1", status: "READY", deleteAfter: null, subjects: [{ studentId: "s1" }] },
        { id: "stay", orgId: "o1", status: "READY", deleteAfter: null, subjects: [{ studentId: "s2" }] },
      ])
      .mockResolvedValueOnce([
        { id: "old", orgId: "o1", status: "READY", deleteAfter: new Date("2026-11-01"), deletedAt: null, createdAt: new Date("2025-01-01"), storageKey: "k1", variants: { thumb: "k1t" } },
        { id: "fresh", orgId: "o1", status: "READY", deleteAfter: new Date("2027-01-01"), deletedAt: null, createdAt: new Date("2025-01-01"), storageKey: "k2", variants: null },
      ]);
    db.batchEnrollment.findMany.mockResolvedValueOnce([{ studentId: "s2", batch: { orgId: "o1" } }]);
    const s = storage();
    const r = await purgeMedia(now, s);

    expect(r.scheduled).toBe(1);
    expect(db.mediaAsset.update).toHaveBeenCalledWith({ where: { id: "left" }, data: { deleteAfter: new Date("2027-11-07T00:00:00Z") } });
    expect(s.remove).toHaveBeenCalledTimes(1);
    expect(s.remove).toHaveBeenCalledWith(["k1", "k1t"]);
    expect(db.mediaAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({ mediaId: "old", action: "PURGE", actorUserId: null }) });
    expect(db.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: "old" } });
    expect(r.purged.RETENTION).toBe(1);
  });

  it("keeps the row when the file delete fails, so the next run retries", async () => {
    flags.media = true;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    db.mediaAsset.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "x", orgId: "o1", status: "DELETED", deleteAfter: null, deletedAt: new Date(), createdAt: new Date(), storageKey: "k", variants: null }]);
    const r = await purgeMedia(new Date(), storage({ remove: vi.fn(async () => { throw new Error("blob down"); }) }));
    expect(r.failed).toBe(1);
    expect(db.mediaAsset.delete).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
});

describe("loadViewer and filterVisible", () => {
  it("a signed-out viewer has no staff or guardian access", async () => {
    const v = await loadViewer(null, ["o1"]);
    expect(v).toEqual({ userId: null, staffOrgIds: [], guardianOfStudentIds: [], childBatchIds: [] });
  });

  it("filters by consent and only counts batches inside the media's academy", async () => {
    db.student.findMany.mockResolvedValueOnce([{ id: "mine" }]);
    db.batchEnrollment.findMany
      .mockResolvedValueOnce([{ batchId: "b1" }]) // viewer's children's batches
      .mockResolvedValueOnce([
        { studentId: "a", batchId: "b1", batch: { orgId: "o1" } },
        { studentId: "c", batchId: "b1", batch: { orgId: "o2" } }, // same id, other academy: ignored
      ]);
    db.mediaConsent.findMany.mockResolvedValueOnce([
      { orgId: "o1", studentId: "a", scope: "parents_of_batch", withdrawnAt: null },
      { orgId: "o1", studentId: "c", scope: "parents_of_batch", withdrawnAt: null },
    ]);
    const viewer = await loadViewer("p1", ["o1"]);
    const assets = [
      { id: "1", orgId: "o1", contextType: "SESSION", status: "READY", deletedAt: null, subjects: [{ studentId: "a" }] },
      { id: "2", orgId: "o1", contextType: "SESSION", status: "READY", deletedAt: null, subjects: [{ studentId: "c" }] },
      { id: "3", orgId: "o1", contextType: "SESSION", status: "READY", deletedAt: null, subjects: [{ studentId: "mine" }] },
      { id: "4", orgId: "o1", contextType: "SESSION", status: "READY", deletedAt: null, subjects: [] },
    ];
    const visible = await filterVisible(viewer, assets);
    expect(visible.map((a) => a.id)).toEqual(["1", "3"]);
  });
});

import { describe, it, expect } from "vitest";
import {
  addMonthsUtc,
  MEDIA_RETENTION_MONTHS_AFTER_ENROLMENT,
  purgeReason,
  retentionDeadline,
  shouldScheduleRetention,
} from "@/lib/media/retention";

const d = (s: string) => new Date(s);

describe("retention deadline (placeholder: enrolment end + 12 months)", () => {
  it("uses 12 months", () => {
    expect(MEDIA_RETENTION_MONTHS_AFTER_ENROLMENT).toBe(12);
    expect(retentionDeadline(d("2026-03-15T10:00:00Z")).toISOString()).toBe("2027-03-15T10:00:00.000Z");
  });
  it("clamps month ends", () => {
    expect(addMonthsUtc(d("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonthsUtc(d("2028-02-29T00:00:00Z"), 12).toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });
});

describe("shouldScheduleRetention", () => {
  const base = { status: "READY", deleteAfter: null as Date | null };
  it("schedules only once every tagged child has left", () => {
    expect(shouldScheduleRetention({ ...base, subjects: [{ enrolledBatchCount: 0 }, { enrolledBatchCount: 0 }] })).toBe(true);
    expect(shouldScheduleRetention({ ...base, subjects: [{ enrolledBatchCount: 0 }, { enrolledBatchCount: 1 }] })).toBe(false);
  });
  it("never reschedules, and ignores untagged or non-READY assets", () => {
    expect(shouldScheduleRetention({ ...base, deleteAfter: new Date(), subjects: [{ enrolledBatchCount: 0 }] })).toBe(false);
    expect(shouldScheduleRetention({ ...base, subjects: [] })).toBe(false);
    expect(shouldScheduleRetention({ ...base, status: "PENDING", subjects: [{ enrolledBatchCount: 0 }] })).toBe(false);
  });
});

describe("purgeReason", () => {
  const now = d("2026-11-07T12:00:00Z");
  const asset = { status: "READY", deleteAfter: null as Date | null, deletedAt: null as Date | null, createdAt: d("2026-01-01T00:00:00Z") };
  it("keeps live assets", () => expect(purgeReason(asset, now)).toBeNull());
  it("purges past deleteAfter, not before", () => {
    expect(purgeReason({ ...asset, deleteAfter: d("2026-11-07T12:00:00Z") }, now)).toBe("RETENTION");
    expect(purgeReason({ ...asset, deleteAfter: d("2026-11-08T00:00:00Z") }, now)).toBeNull();
  });
  it("purges soft-deleted assets", () => {
    expect(purgeReason({ ...asset, status: "DELETED" }, now)).toBe("DELETED");
    expect(purgeReason({ ...asset, deletedAt: now }, now)).toBe("DELETED");
  });
  it("purges PENDING uploads after 24 hours only", () => {
    expect(purgeReason({ ...asset, status: "PENDING", createdAt: d("2026-11-06T12:00:00Z") }, now)).toBe("ABANDONED");
    expect(purgeReason({ ...asset, status: "PENDING", createdAt: d("2026-11-07T00:00:00Z") }, now)).toBeNull();
  });
});

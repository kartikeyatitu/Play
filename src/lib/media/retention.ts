/**
 * Media retention. PLACEHOLDER: docs/TRIQ_DATA_PRIVACY.md section 6 says no retention periods are set
 * yet. The 12 months after enrolment ends below is the working assumption from the wave 2 media spec,
 * kept in one constant so counsel can change it. COUNSEL: confirm the period per scope.
 *
 * BatchEnrollment has no end date (leaving deletes the row), so the purge job uses the first time it
 * sees that no tagged child is enrolled any more as the enrolment end.
 */
export const MEDIA_RETENTION_MONTHS_AFTER_ENROLMENT = 12;
/** PENDING uploads that never completed are removed after this long. */
export const MEDIA_PENDING_ABANDON_HOURS = 24;

/** Adds calendar months in UTC, clamping to the last day of the month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

export function retentionDeadline(enrolmentEnd: Date, months = MEDIA_RETENTION_MONTHS_AFTER_ENROLMENT): Date {
  return addMonthsUtc(enrolmentEnd, months);
}

/**
 * When to set deleteAfter on an asset: only once every tagged child has left (no enrolment left in the
 * academy). Untagged assets are never auto-scheduled here; staff delete them by hand.
 */
export function shouldScheduleRetention(asset: {
  status: string;
  deleteAfter: Date | null;
  subjects: { enrolledBatchCount: number }[];
}): boolean {
  if (asset.status !== "READY" || asset.deleteAfter) return false;
  if (asset.subjects.length === 0) return false;
  return asset.subjects.every((s) => s.enrolledBatchCount === 0);
}

export type PurgeReason = "RETENTION" | "DELETED" | "ABANDONED";

/** Why (if at all) the purge job should remove this asset's files and row now. */
export function purgeReason(
  asset: { status: string; deleteAfter: Date | null; deletedAt: Date | null; createdAt: Date },
  now: Date,
): PurgeReason | null {
  if (asset.deletedAt || asset.status === "DELETED") return "DELETED";
  if (asset.deleteAfter && asset.deleteAfter.getTime() <= now.getTime()) return "RETENTION";
  if (asset.status === "PENDING" && now.getTime() - asset.createdAt.getTime() >= MEDIA_PENDING_ABANDON_HOURS * 3600_000) {
    return "ABANDONED";
  }
  return null;
}

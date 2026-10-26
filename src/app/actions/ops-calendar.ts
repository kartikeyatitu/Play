"use server";

import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { addDaysStr, istDateOf, istHourOf, slotInstant } from "@/lib/turf";
import { ALLOCATION_GROUP_PREFIX, batchIdFromGroup } from "@/lib/facility-allocation";
import {
  OPS_CALENDAR_DISABLED_ERROR,
  buildOpsCalendar,
  calendarRange,
  firstNameOnly,
  type CalendarResult,
} from "@/lib/ops-calendar";

/**
 * V1 Business: operations calendar for the caller's academy (flag `opsCalendar`).
 * Read-only. Sessions, trials and holidays are stored at 00:00 UTC of their calendar day; court bookings are real
 * instants and are converted to IST calendar days.
 */
export async function getOpsCalendar(
  start: string,
  days: number = 7,
): Promise<({ success: true } & CalendarResult & { start: string }) | { success: false; error: string }> {
  if (!FEATURES.opsCalendar) return { success: false, error: OPS_CALENDAR_DISABLED_ERROR };
  const auth = await checkPermission("batches.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;

  const range = calendarRange(start, days);
  if (!range) return { success: false, error: "Pick a valid start date." };
  const endStr = addDaysStr(range.start, range.days);
  const from = new Date(`${range.start}T00:00:00.000Z`);
  const to = new Date(`${endStr}T00:00:00.000Z`);

  const [batches, sessions, trials, holidays, allocations, branchLinks] = await Promise.all([
    db.batch.findMany({
      where: { orgId },
      select: { id: true, name: true, sport: true, schedule: true, coach: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.session.findMany({
      where: { batch: { orgId }, date: { gte: from, lt: to } },
      select: { batchId: true, date: true, status: true, attendances: { select: { isPresent: true } } },
    }),
    db.trialBooking.findMany({
      where: { batch: { orgId }, date: { gte: from, lt: to } },
      select: { id: true, batchId: true, date: true, status: true, childName: true },
      take: 500,
    }),
    db.holiday.findMany({ where: { orgId, date: { gte: from, lt: to } }, select: { date: true, title: true } }),
    db.turfBooking.findMany({
      where: {
        orgId,
        leaseGroupId: { startsWith: ALLOCATION_GROUP_PREFIX },
        status: { in: ["CONFIRMED", "COMPLETED"] },
        startTime: { gte: slotInstant(range.start, 0), lt: slotInstant(endStr, 0) },
      },
      select: { leaseGroupId: true, startTime: true, endTime: true, status: true, facility: { select: { name: true } } },
      take: 1000,
    }),
    // Branch names only when the branches feature is on (its tables may not exist otherwise).
    FEATURES.branches
      ? db.batchBranch.findMany({ where: { orgId }, select: { batchId: true, branch: { select: { name: true } } } })
      : Promise.resolve([] as { batchId: string; branch: { name: string } }[]),
  ]);

  const branchByBatch = new Map(branchLinks.map((l) => [l.batchId, l.branch.name]));
  const result = buildOpsCalendar({
    start: range.start,
    days: range.days,
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      sport: b.sport,
      schedule: b.schedule,
      coachName: b.coach?.name ?? null,
      branchName: branchByBatch.get(b.id) ?? null,
    })),
    sessions: sessions.map((s) => ({
      batchId: s.batchId,
      date: s.date.toISOString().slice(0, 10),
      status: s.status,
      marked: s.attendances.length,
      present: s.attendances.filter((a) => a.isPresent).length,
    })),
    trials: trials.map((t) => ({
      id: t.id,
      batchId: t.batchId,
      date: t.date.toISOString().slice(0, 10),
      status: t.status,
      childFirstName: firstNameOnly(t.childName),
    })),
    holidays: holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), title: h.title })),
    allocations: allocations.map((a) => ({
      batchId: batchIdFromGroup(a.leaseGroupId),
      facilityName: a.facility.name,
      date: istDateOf(a.startTime),
      startHour: istHourOf(a.startTime),
      endHour: istHourOf(a.endTime) || 24,
      status: a.status,
    })),
  });

  return { success: true, start: range.start, ...result };
}

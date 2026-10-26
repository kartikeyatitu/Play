"use server";

import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { addDaysStr, slotInstant } from "@/lib/turf";
import { orgDateParts } from "@/lib/i18n";
import { BLOCK_SOURCE } from "@/lib/venue-policy";
import { ALLOCATION_GROUP_PREFIX, batchIdFromGroup } from "@/lib/facility-allocation";
import {
  OPS_CALENDAR_DISABLED_ERROR,
  buildOpsCalendar,
  calendarRange,
  firstNameOnly,
  OCCUPYING_BOOKING_STATUSES,
  type BookingKind,
  type CalendarResult,
} from "@/lib/ops-calendar";

/**
 * V1 Business: operations calendar for the caller's academy (flag `opsCalendar`).
 * Read-only. Sessions, trials and holidays are stored at 00:00 UTC of their calendar day; court bookings are real
 * UTC instants and are converted to the academy's timezone (Organization.timezone) for display.
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
  // Instants are bucketed by org-local day below; widen the query a day each side so any timezone is covered.
  const instantFrom = slotInstant(addDaysStr(range.start, -1), 0);
  const instantTo = slotInstant(addDaysStr(endStr, 1), 0);

  const [org, batches, sessions, trials, holidays, allocations, bookings, branchLinks] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } }),
    db.batch.findMany({
      where: { orgId },
      select: { id: true, name: true, sport: true, schedule: true, coachId: true, coach: { select: { name: true } } },
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
        startTime: { gte: instantFrom, lt: instantTo },
      },
      select: { leaseGroupId: true, startTime: true, endTime: true, status: true, facilityId: true, facility: { select: { name: true } } },
      take: 1000,
    }),
    // Everything else that occupies a court: customer bookings, academy leases, maintenance blocks.
    db.turfBooking.findMany({
      where: {
        orgId,
        status: { in: OCCUPYING_BOOKING_STATUSES },
        startTime: { gte: instantFrom, lt: instantTo },
        NOT: { leaseGroupId: { startsWith: ALLOCATION_GROUP_PREFIX } },
      },
      select: { id: true, facilityId: true, startTime: true, endTime: true, status: true, source: true, customerName: true, facility: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 1500,
    }),
    // Branch names only when the branches feature is on (its tables may not exist otherwise).
    FEATURES.branches
      ? db.batchBranch.findMany({ where: { orgId }, select: { batchId: true, branch: { select: { name: true } } } })
      : Promise.resolve([] as { batchId: string; branch: { name: string } }[]),
  ]);

  const branchByBatch = new Map(branchLinks.map((l) => [l.batchId, l.branch.name]));
  const tz = { timezone: org?.timezone };
  const local = (d: Date) => orgDateParts(d, tz);
  const result = buildOpsCalendar({
    start: range.start,
    days: range.days,
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      sport: b.sport,
      schedule: b.schedule,
      coachName: b.coach?.name ?? null,
      coachId: b.coachId,
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
    allocations: allocations.map((a) => {
      const s = local(a.startTime);
      const e = local(a.endTime);
      return {
        batchId: batchIdFromGroup(a.leaseGroupId),
        facilityName: a.facility.name,
        facilityId: a.facilityId,
        date: s.date,
        startHour: Math.floor(s.minutes / 60),
        endHour: e.date !== s.date ? 24 : Math.ceil(e.minutes / 60),
        status: a.status,
      };
    }),
    bookings: bookings.map((k) => {
      const s = local(k.startTime);
      const e = local(k.endTime);
      const kind: BookingKind = k.source === BLOCK_SOURCE ? "BLOCK" : k.source === "LEASE" ? "LEASE" : "BOOKING";
      return {
        id: k.id,
        facilityId: k.facilityId,
        facilityName: k.facility.name,
        date: s.date,
        startMinutes: s.minutes,
        endMinutes: e.date !== s.date ? 24 * 60 : e.minutes,
        kind,
        status: k.status,
        // First name only; phone numbers never leave the server. Blocks carry no customer.
        customerFirstName: kind === "BLOCK" ? null : firstNameOnly(k.customerName),
      };
    }),
  });

  return { success: true, start: range.start, ...result };
}

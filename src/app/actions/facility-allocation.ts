"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { reserveSlot } from "@/lib/turf-engine";
import { istDateOf, istHourOf, slotInstant, todayIstStr } from "@/lib/turf";
import {
  ALLOCATION_GROUP_PREFIX,
  FACILITY_ALLOCATION_DISABLED_ERROR,
  MAX_ALLOCATION_SLOTS,
  allocationDates,
  allocationGroupId,
  batchIdFromGroup,
  fitsOpeningHours,
  parseAllocationInput,
  weekdayOf,
  type AllocationInput,
  type AllocationRow,
} from "@/lib/facility-allocation";

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } }).catch(() => {});
}

/**
 * V1 Business (flag `facilityAllocation`): allocate a batch to a court for chosen weekdays over N weeks.
 * Each occurrence is a CONFIRMED LEASE TurfBooking with amount 0 created by the turf engine (advisory lock + overlap
 * check + exclusion constraint), so it blocks the court for public bookings and never adds revenue. Weeks that clash
 * with an existing booking are skipped and returned in `conflicts`.
 */
export async function allocateBatchToFacility(
  input: AllocationInput,
): Promise<{ success: true; created: number; conflicts: string[]; groupId: string } | { success: false; error: string }> {
  if (!FEATURES.facilityAllocation) return { success: false, error: FACILITY_ALLOCATION_DISABLED_ERROR };
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;

  const parsed = parseAllocationInput(input, todayIstStr());
  if (!parsed.ok) return { success: false, error: parsed.error };
  const a = parsed.data;

  const [batch, facility] = await Promise.all([
    db.batch.findFirst({ where: { id: a.batchId, orgId }, select: { id: true, name: true, coach: { select: { phone: true } } } }),
    db.facility.findFirst({ where: { id: a.facilityId, orgId, isActive: true }, select: { id: true, name: true, openHour: true, closeHour: true } }),
  ]);
  if (!batch) return { success: false, error: "Batch not found in your academy." };
  if (!facility) return { success: false, error: "Court not found." };
  if (!fitsOpeningHours(a.startHour, a.hours, facility)) {
    return { success: false, error: "That time is outside this court's opening hours." };
  }

  const dates = allocationDates(a.startDate, a.weekdays, a.weeks);
  if (dates.length === 0) return { success: false, error: "No dates match the days you picked." };
  if (dates.length > MAX_ALLOCATION_SLOTS) {
    return { success: false, error: `That is ${dates.length} slots; allocate at most ${MAX_ALLOCATION_SLOTS} at a time.` };
  }

  const groupId = allocationGroupId(batch.id, randomUUID());
  const customerName = `Batch: ${batch.name}`.slice(0, 80);
  const customerPhone = batch.coach?.phone ?? "";
  let created = 0;
  const conflicts: string[] = [];
  for (const d of dates) {
    const r = await reserveSlot({
      orgId,
      facilityId: facility.id,
      start: slotInstant(d, a.startHour),
      end: slotInstant(d, a.startHour + a.hours),
      customerName,
      customerPhone,
      amount: 0,
      advancePaid: 0,
      status: "CONFIRMED",
      source: "LEASE",
      notes: "Batch allocation",
      leaseGroupId: groupId,
    });
    if (r.ok) created++;
    else if (r.reason === "CONFLICT") conflicts.push(d);
    else {
      await audit(session.id, orgId, "FACILITY_ALLOCATED", { batchId: batch.id, facilityId: facility.id, groupId, created, conflicts, aborted: true });
      return { success: false, error: `Saved ${created} slot(s), then failed. Please check the bookings board and try again.` };
    }
  }

  await audit(session.id, orgId, "FACILITY_ALLOCATED", {
    batchId: batch.id,
    facilityId: facility.id,
    groupId,
    weekdays: a.weekdays,
    startHour: a.startHour,
    hours: a.hours,
    startDate: a.startDate,
    weeks: a.weeks,
    created,
    conflicts: conflicts.length,
  });
  if (created === 0) return { success: false, error: "Every one of those slots is already booked." };
  revalidatePath("/org");
  return { success: true, created, conflicts, groupId };
}


/** Upcoming batch allocations, plus the batches and active courts the form can offer. */
export async function listBatchAllocations(): Promise<
  | { success: true; rows: AllocationRow[]; batches: { id: string; name: string }[]; facilities: { id: string; name: string; openHour: number; closeHour: number }[] }
  | { success: false; error: string }
> {
  if (!FEATURES.facilityAllocation) return { success: false, error: FACILITY_ALLOCATION_DISABLED_ERROR };
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;

  const [bookings, batches, facilities] = await Promise.all([
    db.turfBooking.findMany({
      where: { orgId, leaseGroupId: { startsWith: ALLOCATION_GROUP_PREFIX }, status: "CONFIRMED", endTime: { gt: new Date() } },
      select: { leaseGroupId: true, startTime: true, endTime: true, facility: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 2000,
    }),
    db.batch.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.facility.findMany({ where: { orgId, isActive: true }, select: { id: true, name: true, openHour: true, closeHour: true }, orderBy: { name: "asc" } }),
  ]);

  const nameById = new Map(batches.map((b) => [b.id, b.name]));
  const groups = new Map<string, AllocationRow>();
  for (const b of bookings) {
    const gid = b.leaseGroupId as string;
    const date = istDateOf(b.startTime);
    let g = groups.get(gid);
    if (!g) {
      const batchId = batchIdFromGroup(gid);
      g = {
        groupId: gid,
        batchId,
        batchName: batchId ? nameById.get(batchId) ?? null : null,
        facilityName: b.facility.name,
        weekdays: [],
        startHour: istHourOf(b.startTime),
        endHour: istHourOf(b.endTime) || 24,
        nextDate: date,
        lastDate: date,
        upcoming: 0,
      };
      groups.set(gid, g);
    }
    g.upcoming++;
    g.lastDate = date;
    const wd = weekdayOf(date);
    if (!g.weekdays.includes(wd)) g.weekdays.push(wd);
  }
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const rows = [...groups.values()].map((g) => ({ ...g, weekdays: g.weekdays.sort((x, y) => order.indexOf(x) - order.indexOf(y)) }));
  return { success: true, rows, batches, facilities };
}

/** Cancel every future slot of one batch allocation (past and completed slots stay as history). */
export async function cancelBatchAllocation(groupId: string): Promise<{ success: true; cancelled: number } | { success: false; error: string }> {
  if (!FEATURES.facilityAllocation) return { success: false, error: FACILITY_ALLOCATION_DISABLED_ERROR };
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const gid = String(groupId ?? "");
  if (!batchIdFromGroup(gid)) return { success: false, error: "Allocation not found." };

  const res = await db.turfBooking.updateMany({
    where: { orgId: session.orgId, leaseGroupId: gid, status: "CONFIRMED", startTime: { gte: new Date() } },
    data: { status: "CANCELLED" },
  });
  if (res.count === 0) return { success: false, error: "No upcoming slots left in this allocation." };
  await audit(session.id, session.orgId, "FACILITY_ALLOCATION_CANCELLED", { groupId: gid, batchId: batchIdFromGroup(gid), cancelled: res.count });
  revalidatePath("/org");
  return { success: true, cancelled: res.count };
}

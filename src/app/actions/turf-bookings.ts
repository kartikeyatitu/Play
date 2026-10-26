"use server";

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { recordBookingEvents } from "@/lib/turf-audit";
import { BLOCK_SOURCE, blockAllows, cancellationQuote, rescheduleCheck, type CancellationQuote } from "@/lib/venue-policy";
import { computeUtilisation, type UtilRow } from "@/lib/venue-utilisation";
import { cleanIndianPhone } from "@/lib/import-utils";
import { reserveSlot, confirmUpiBooking, moveSlot, UPI_REPORTED } from "@/lib/turf-engine";
import {
  MAX_HOURS_PER_BOOKING,
  MAX_LEASE_WEEKS,
  addDaysStr,
  istDayRange,
  isValidDateStr,
  slotInstant,
  todayIstStr,
} from "@/lib/turf";

/** Owner-side turf/court booking actions. Every query is scoped to the signed-in owner's org. */

export type TurfFacility = {
  id: string;
  name: string;
  type: string;
  hourlyRate: number;
  openHour: number;
  closeHour: number;
  advanceAmount: number;
  isActive: boolean;
};

export type TurfBookingRow = {
  id: string;
  facilityId: string;
  startHour: number; // IST
  hours: number;
  date: string; // IST YYYY-MM-DD
  customerName: string;
  customerPhone: string;
  amount: number;
  advancePaid: number;
  status: string;
  source: string;
  notes: string | null;
  holdExpiresAt: string | null;
  /** Part of a weekly lease or a multi-day block (CANCEL_SERIES applies). */
  inSeries: boolean;
};

export type TurfBoard = {
  today: string;
  slug: string | null;
  orgName: string;
  razorpayConnected: boolean;
  upiId: string | null;
  facilities: TurfFacility[];
  bookings: TurfBookingRow[];
  /** Customers who say they paid by UPI and are waiting for the owner to verify and confirm. */
  pendingUpi: { id: string; customerName: string; customerPhone: string; date: string; startHour: number; hours: number; court: string; due: number; ref: string | null }[];
  attention: { id: string; customerName: string; customerPhone: string; date: string; startHour: number; note: string }[];
};

function istParts(d: Date): { date: string; hour: number } {
  const shifted = new Date(d.getTime() + 5.5 * 3600_000);
  return { date: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

export async function getTurfBoard(dateStr: string): Promise<TurfBoard | { error: string }> {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  const date = isValidDateStr(dateStr) ? dateStr : todayIstStr();
  const { start, end } = istDayRange(date);

  const [org, facilities, rows, conflicts, upiRows] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true, razorpayKeyId: true, razorpayKeySecretEnc: true, upiId: true },
    }),
    db.facility.findMany({ where: { orgId, isActive: true }, orderBy: { createdAt: "asc" } }),
    db.turfBooking.findMany({
      where: {
        orgId,
        startTime: { gte: start, lt: end },
        OR: [
          { status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW", "PAID_CONFLICT"] } },
          { status: "HOLD", holdExpiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { startTime: "asc" },
    }),
    db.turfBooking.findMany({
      where: { orgId, status: "PAID_CONFLICT" },
      orderBy: { startTime: "desc" },
      take: 10,
    }),
    db.turfBooking.findMany({
      where: { orgId, status: "HOLD", holdExpiresAt: { gt: new Date() }, providerPaymentId: { startsWith: UPI_REPORTED }, endTime: { gt: new Date() } },
      include: { facility: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 20,
    }),
  ]);

  return {
    today: todayIstStr(),
    slug: org?.slug ?? null,
    orgName: org?.name ?? "",
    razorpayConnected: Boolean(org?.razorpayKeyId && org?.razorpayKeySecretEnc),
    upiId: org?.upiId ?? null,
    pendingUpi: upiRows.map((b) => {
      const s = istParts(b.startTime);
      const ref = (b.providerPaymentId ?? "").split(":")[1] || null;
      return {
        id: b.id,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        date: s.date,
        startHour: s.hour,
        hours: Math.max(1, Math.round((b.endTime.getTime() - b.startTime.getTime()) / 3600_000)),
        court: b.facility.name,
        due: b.onlineDue,
        ref,
      };
    }),
    facilities: facilities.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      hourlyRate: f.hourlyRate,
      openHour: f.openHour,
      closeHour: f.closeHour,
      advanceAmount: f.advanceAmount,
      isActive: f.isActive,
    })),
    bookings: rows.map((b) => {
      const s = istParts(b.startTime);
      return {
        id: b.id,
        facilityId: b.facilityId,
        startHour: s.hour,
        hours: Math.max(1, Math.round((b.endTime.getTime() - b.startTime.getTime()) / 3600_000)),
        date: s.date,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        amount: b.amount,
        advancePaid: b.advancePaid,
        status: b.status,
        source: b.source,
        notes: b.notes,
        holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
        inSeries: Boolean(b.leaseGroupId),
      };
    }),
    attention: conflicts.map((b) => {
      const s = istParts(b.startTime);
      return { id: b.id, customerName: b.customerName, customerPhone: b.customerPhone, date: s.date, startHour: s.hour, note: b.notes || "Needs attention" };
    }),
  };
}

type SaveFacilityInput = {
  id?: string;
  name: string;
  type: string;
  hourlyRate: number;
  openHour: number;
  closeHour: number;
  advanceAmount: number;
};

export async function saveFacility(input: SaveFacilityInput): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const name = String(input?.name ?? "").trim();
  const type = String(input?.type ?? "TURF").trim().toUpperCase().slice(0, 20) || "TURF";
  const hourlyRate = Math.round(Number(input?.hourlyRate));
  const openHour = Math.round(Number(input?.openHour));
  const closeHour = Math.round(Number(input?.closeHour));
  const advanceAmount = Math.round(Number(input?.advanceAmount) || 0);

  if (name.length < 2 || name.length > 60) return { success: false, error: "Name must be 2-60 characters." };
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 200_000) return { success: false, error: "Enter a valid price per hour." };
  if (!(openHour >= 0 && openHour <= 23)) return { success: false, error: "Opening hour must be between 12 AM and 11 PM." };
  if (!(closeHour >= openHour + 1 && closeHour <= 24)) return { success: false, error: "Closing time must be after opening time." };
  if (advanceAmount < 0 || advanceAmount > hourlyRate * (closeHour - openHour) + 1) return { success: false, error: "Advance looks too high." };

  if (input.id) {
    const res = await db.facility.updateMany({
      where: { id: input.id, orgId: session.orgId },
      data: { name, type, hourlyRate, openHour, closeHour, advanceAmount },
    });
    if (res.count === 0) return { success: false, error: "Court not found." };
    return { success: true, id: input.id };
  }
  const f = await db.facility.create({
    data: { orgId: session.orgId, name, type, hourlyRate, openHour, closeHour, advanceAmount },
    select: { id: true },
  });
  return { success: true, id: f.id };
}

export async function archiveFacility(id: string): Promise<{ success: boolean; error?: string }> {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const future = await db.turfBooking.count({
    where: { facilityId: id, orgId: session.orgId, status: { in: ["HOLD", "CONFIRMED"] }, endTime: { gt: new Date() } },
  });
  if (future > 0) return { success: false, error: `This court has ${future} upcoming booking${future === 1 ? "" : "s"}. Cancel them first.` };
  const res = await db.facility.updateMany({ where: { id, orgId: session.orgId }, data: { isActive: false } });
  return res.count ? { success: true } : { success: false, error: "Court not found." };
}

type CounterInput = {
  facilityId: string;
  date: string;
  startHour: number;
  hours: number;
  customerName: string;
  customerPhone: string;
  amount: number;
  advancePaid: number;
  repeatWeeks?: number;
  notes?: string;
};

export type CounterResult =
  | { success: true; created: number; conflicts: string[] }
  | { success: false; error: string };

async function auditCreated(userId: string, orgId: string, bookingIds: string[], details: Record<string, unknown>) {
  if (bookingIds.length === 0) return;
  await db.auditLog
    .create({ data: { userId, orgId, action: "TURF_BOOKING_CREATED", details: JSON.stringify({ bookingIds, ...details }) } })
    .catch((e) => console.warn("audit TURF_BOOKING_CREATED failed:", e instanceof Error ? e.message : e));
  await recordBookingEvents(orgId, bookingIds, "CREATED", { type: "STAFF", userId }, details);
}

export async function createCounterBooking(input: CounterInput): Promise<CounterResult> {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const orgId = session.orgId;

    const date = String(input?.date ?? "");
    const startHour = Math.round(Number(input?.startHour));
    const hours = Math.round(Number(input?.hours));
    const repeatWeeks = Math.min(MAX_LEASE_WEEKS, Math.max(1, Math.round(Number(input?.repeatWeeks) || 1)));
    const customerName = String(input?.customerName ?? "").trim();
    const phone = cleanIndianPhone(input?.customerPhone);
    const amount = Math.round(Number(input?.amount));
    const advancePaid = Math.round(Number(input?.advancePaid) || 0);
    const notes = String(input?.notes ?? "").trim().slice(0, 200) || null;

    if (!isValidDateStr(date)) return { success: false, error: "Pick a valid date." };
    if (date < todayIstStr()) return { success: false, error: "That date has already passed." };
    if (customerName.length < 2 || customerName.length > 80) return { success: false, error: "Enter the customer's name." };
    if (!phone) return { success: false, error: "Enter a valid 10-digit mobile number." };
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return { success: false, error: "Enter a valid amount." };
    if (advancePaid < 0 || advancePaid > amount) return { success: false, error: "Amount received can't be more than the total." };
    if (!(hours >= 1 && hours <= MAX_HOURS_PER_BOOKING)) return { success: false, error: `Bookings can be 1 to ${MAX_HOURS_PER_BOOKING} hours.` };

    const facility = await db.facility.findFirst({ where: { id: String(input?.facilityId ?? ""), orgId, isActive: true } });
    if (!facility) return { success: false, error: "Court not found." };
    if (startHour < facility.openHour || startHour + hours > facility.closeHour) {
      return { success: false, error: "That time is outside this court's opening hours." };
    }

    const leaseGroupId = repeatWeeks > 1 ? randomUUID() : null;
    let created = 0;
    const createdIds: string[] = [];
    const conflicts: string[] = [];
    for (let i = 0; i < repeatWeeks; i++) {
      const d = addDaysStr(date, 7 * i);
      const r = await reserveSlot({
        orgId,
        facilityId: facility.id,
        start: slotInstant(d, startHour),
        end: slotInstant(d, startHour + hours),
        customerName,
        customerPhone: phone,
        amount,
        advancePaid: i === 0 ? advancePaid : 0,
        status: "CONFIRMED",
        source: repeatWeeks > 1 ? "LEASE" : "COUNTER",
        notes,
        leaseGroupId,
      });
      if (r.ok) {
        created++;
        createdIds.push(r.id);
      } else if (r.reason === "CONFLICT") conflicts.push(d);
      else {
        await auditCreated(session.id, orgId, createdIds, { facilityId: facility.id, date, startHour, hours, amount, advancePaid, repeatWeeks, conflicts, partial: true });
        return { success: false, error: "Couldn't save the booking. Please try again." };
      }
    }
    if (created === 0) return { success: false, error: "That slot is already booked." };
    await auditCreated(session.id, orgId, createdIds, { facilityId: facility.id, date, startHour, hours, amount, advancePaid, repeatWeeks, conflicts });
    return { success: true, created, conflicts };
  } catch (e) {
    console.error("createCounterBooking failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't save the booking. Please try again." };
  }
}

export type BookingAction = "CANCEL" | "NO_SHOW" | "COMPLETE" | "COLLECT_BALANCE" | "CANCEL_SERIES" | "CONFIRM_UPI" | "REJECT_UPI";

export async function updateBooking(id: string, action: BookingAction): Promise<{ success: boolean; error?: string }> {
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  try {
    const orgId = session.orgId;
    const b = await db.turfBooking.findFirst({ where: { id, orgId } });
    if (!b) return { success: false, error: "Booking not found." };
    const isBlock = b.source === BLOCK_SOURCE;
    if (isBlock && !blockAllows(action) && action !== "CANCEL_SERIES") return { success: false, error: "That doesn't apply to a blocked slot." };
    let quote: CancellationQuote | null = null;
    let affected: string[] = [id];

    if (action === "CANCEL") {
      if (!["HOLD", "CONFIRMED", "PAID_CONFLICT"].includes(b.status)) return { success: false, error: "This booking can't be cancelled." };
      // The quote is informational: TRIQ never changes advancePaid or marks a refund as paid.
      quote = cancellationQuote(b, new Date());
      await db.turfBooking.update({ where: { id }, data: { status: "CANCELLED" } });
    } else if (action === "CONFIRM_UPI") {
      const r = await confirmUpiBooking(id, orgId);
      if (!r.ok) {
        return {
          success: false,
          error: r.error === "SLOT_TAKEN" ? "That slot was booked by someone else meanwhile. Refund the customer and rebook them." : "Couldn't confirm this booking.",
        };
      }
    } else if (action === "REJECT_UPI") {
      if (!["HOLD", "PAID_CONFLICT"].includes(b.status)) return { success: false, error: "This booking can't be rejected." };
      await db.turfBooking.update({ where: { id }, data: { status: "CANCELLED", holdExpiresAt: null } });
    } else if (action === "CANCEL_SERIES") {
      if (!b.leaseGroupId) return { success: false, error: "This isn't part of a repeating lease." };
      const seriesWhere = { orgId, leaseGroupId: b.leaseGroupId, status: "CONFIRMED", startTime: { gte: b.startTime } };
      affected = (await db.turfBooking.findMany({ where: seriesWhere, select: { id: true } })).map((r) => r.id);
      await db.turfBooking.updateMany({ where: { ...seriesWhere, id: { in: affected } }, data: { status: "CANCELLED" } });
    } else if (action === "NO_SHOW") {
      if (b.status !== "CONFIRMED") return { success: false, error: "Only confirmed bookings can be marked no-show." };
      await db.turfBooking.update({ where: { id }, data: { status: "NO_SHOW" } });
    } else if (action === "COMPLETE") {
      if (b.status !== "CONFIRMED") return { success: false, error: "Only confirmed bookings can be completed." };
      await db.turfBooking.update({ where: { id }, data: { status: "COMPLETED", advancePaid: b.amount } });
    } else if (action === "COLLECT_BALANCE") {
      if (!["CONFIRMED", "COMPLETED"].includes(b.status)) return { success: false, error: "Nothing to collect on this booking." };
      await db.turfBooking.update({ where: { id }, data: { advancePaid: b.amount } });
    } else {
      return { success: false, error: "Unknown action." };
    }
    const auditAction = isBlock ? (action === "CANCEL" ? "TURF_BLOCK_REMOVED" : "TURF_BLOCK_SERIES_REMOVED") : `TURF_BOOKING_${action}`;
    const details = {
      bookingId: id,
      ...(affected.length > 1 ? { bookingIds: affected } : {}),
      ...(quote ? { refundDue: quote.refundDue, refundTier: quote.tier, hoursBefore: quote.hoursBefore, received: b.advancePaid } : {}),
    };
    await db.auditLog.create({ data: { userId: session.id, orgId, action: auditAction, details: JSON.stringify(details) } }).catch(() => {});
    await recordBookingEvents(orgId, affected, action, { type: "STAFF", userId: session.id }, details);
    return { success: true };
  } catch (e) {
    console.error("updateBooking failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't update the booking." };
  }
}

// ───────────────────────── TRIQ Spaces operator tools (flag spacesOps) ─────────────────────────

const MAX_BLOCK_DAYS = 31;

/**
 * Marks court time unavailable (maintenance, private event, rain…). Blocks are TurfBooking rows with
 * source BLOCK and amount 0, created through the same engine, so they can never overlap a booking and
 * public availability hides them automatically. Days that clash with an existing booking are skipped
 * and reported — nothing is overwritten.
 */
export async function blockSlots(input: {
  facilityId: string;
  date: string;
  startHour: number;
  hours: number;
  days?: number;
  reason: string;
}): Promise<{ success: true; created: number; conflicts: string[] } | { success: false; error: string }> {
  if (!FEATURES.spacesOps) return { success: false, error: "Not enabled." };
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  try {
    const date = String(input?.date ?? "");
    const startHour = Math.round(Number(input?.startHour));
    const hours = Math.round(Number(input?.hours));
    const days = Math.min(MAX_BLOCK_DAYS, Math.max(1, Math.round(Number(input?.days) || 1)));
    const reason = String(input?.reason ?? "").trim().replace(/\s+/g, " ");
    if (!isValidDateStr(date)) return { success: false, error: "Pick a valid date." };
    if (date < todayIstStr()) return { success: false, error: "That date has already passed." };
    if (reason.length < 2 || reason.length > 80) return { success: false, error: "Add a short reason (2–80 characters)." };

    const facility = await db.facility.findFirst({ where: { id: String(input?.facilityId ?? ""), orgId, isActive: true } });
    if (!facility) return { success: false, error: "Court not found." };
    if (!(hours >= 1) || startHour < facility.openHour || startHour + hours > facility.closeHour) {
      return { success: false, error: "Pick a time inside this court's opening hours." };
    }

    const groupId = days > 1 ? randomUUID() : null;
    const ids: string[] = [];
    const conflicts: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDaysStr(date, i);
      const r = await reserveSlot({
        orgId,
        facilityId: facility.id,
        start: slotInstant(d, startHour),
        end: slotInstant(d, startHour + hours),
        customerName: reason,
        customerPhone: "",
        amount: 0,
        advancePaid: 0,
        status: "CONFIRMED",
        source: "BLOCK",
        notes: reason,
        leaseGroupId: groupId,
      });
      if (r.ok) ids.push(r.id);
      else if (r.reason === "CONFLICT") conflicts.push(d);
      else break;
    }
    if (ids.length) {
      const details = { bookingIds: ids, facilityId: facility.id, date, startHour, hours, days, reason, conflicts };
      await db.auditLog.create({ data: { userId: session.id, orgId, action: "TURF_BLOCK_CREATED", details: JSON.stringify(details) } }).catch(() => {});
      await recordBookingEvents(orgId, ids, "CREATED", { type: "STAFF", userId: session.id }, { block: true, reason });
    }
    if (ids.length === 0) return { success: false, error: conflicts.length ? "Those hours already have bookings. Cancel or move them first." : "Couldn't block the slot. Please try again." };
    return { success: true, created: ids.length, conflicts };
  } catch (e) {
    console.error("blockSlots failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't block the slot. Please try again." };
  }
}

/** What the cancellation policy says for this booking right now (shown before the operator cancels). */
export async function getCancellationQuote(id: string): Promise<{ success: true; quote: CancellationQuote } | { success: false; error: string }> {
  if (!FEATURES.spacesOps) return { success: false, error: "Not enabled." };
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const b = await db.turfBooking.findFirst({
    where: { id: String(id ?? ""), orgId: auth.session.orgId },
    select: { status: true, source: true, startTime: true, endTime: true, advancePaid: true },
  });
  if (!b) return { success: false, error: "Booking not found." };
  return { success: true, quote: cancellationQuote(b, new Date()) };
}

/** Moves a confirmed booking to another time/court under the reschedule policy. Amount is unchanged. */
export async function rescheduleBooking(
  id: string,
  input: { date: string; startHour: number; facilityId?: string }
): Promise<{ success: true } | { success: false; error: string }> {
  if (!FEATURES.spacesOps) return { success: false, error: "Not enabled." };
  const auth = await checkPermission("bookings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const orgId = session.orgId;
  try {
    const b = await db.turfBooking.findFirst({ where: { id: String(id ?? ""), orgId } });
    if (!b) return { success: false, error: "Booking not found." };
    const date = String(input?.date ?? "");
    const startHour = Math.round(Number(input?.startHour));
    if (!isValidDateStr(date) || !Number.isInteger(startHour)) return { success: false, error: "Pick a valid date and time." };
    const facility = await db.facility.findFirst({ where: { id: String(input?.facilityId || b.facilityId), orgId, isActive: true } });
    if (!facility) return { success: false, error: "Court not found." };

    const hours = Math.max(1, Math.round((b.endTime.getTime() - b.startTime.getTime()) / 3600_000));
    const newStart = slotInstant(date, startHour);
    const newEnd = slotInstant(date, startHour + hours);
    const check = rescheduleCheck(
      b,
      { newStart, newEnd, startHour, openHour: facility.openHour, closeHour: facility.closeHour, sameSlot: facility.id === b.facilityId && newStart.getTime() === b.startTime.getTime() },
      new Date()
    );
    if (!check.ok) return { success: false, error: check.error };

    const r = await moveSlot({ id: b.id, orgId, facilityId: facility.id, start: newStart, end: newEnd });
    if (!r.ok) {
      return {
        success: false,
        error: r.reason === "CONFLICT" ? "That slot is already booked." : r.reason === "BAD_STATUS" ? "Only confirmed bookings can be rescheduled." : "Couldn't move the booking.",
      };
    }
    const details = { bookingId: b.id, from: { facilityId: r.fromFacilityId, start: r.fromStart.toISOString() }, to: { facilityId: facility.id, start: newStart.toISOString() } };
    await db.auditLog.create({ data: { userId: session.id, orgId, action: "TURF_BOOKING_RESCHEDULED", details: JSON.stringify(details) } }).catch(() => {});
    await recordBookingEvents(orgId, [b.id], "RESCHEDULED", { type: "STAFF", userId: session.id }, details);
    return { success: true };
  } catch (e) {
    console.error("rescheduleBooking failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't move the booking." };
  }
}

/**
 * Utilisation from real booking rows over the last (or next) `days` days, per court. Metric
 * definitions are in src/lib/venue-utilisation.ts. "Recorded" money is what staff/gateway recorded,
 * never presented as verified.
 */
export async function getVenueUtilisation(
  days: number,
  direction: "past" | "next" = "past"
): Promise<{ success: true; from: string; to: string; days: number; rows: UtilRow[]; total: UtilRow } | { success: false; error: string }> {
  if (!FEATURES.spacesOps) return { success: false, error: "Not enabled." };
  const auth = await checkPermission(null);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!hasPermission(auth.membership, "bookings.manage") && !hasPermission(auth.membership, "reports.view")) {
    return { success: false, error: "You don't have permission to do this" };
  }
  const orgId = auth.session.orgId;
  const n = [7, 30, 90].includes(Number(days)) ? Number(days) : 7;
  const today = todayIstStr();
  const from = direction === "next" ? today : addDaysStr(today, -(n - 1));
  const toExclusive = addDaysStr(from, n);

  const [facilities, bookings] = await Promise.all([
    db.facility.findMany({ where: { orgId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, openHour: true, closeHour: true } }),
    db.turfBooking.findMany({
      where: { orgId, startTime: { gte: slotInstant(from, 0), lt: slotInstant(toExclusive, 0) } },
      select: { facilityId: true, startTime: true, endTime: true, status: true, source: true, amount: true, advancePaid: true },
      take: 20_000,
    }),
  ]);
  const { rows, total } = computeUtilisation(facilities, bookings, n);
  return { success: true, from, to: addDaysStr(toExclusive, -1), days: n, rows, total };
}

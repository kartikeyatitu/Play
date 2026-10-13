"use server";

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { cleanIndianPhone } from "@/lib/import-utils";
import { reserveSlot, confirmUpiBooking, UPI_REPORTED } from "@/lib/turf-engine";
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
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { error: "No academy found for your account." };
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
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
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
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
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

export async function createCounterBooking(input: CounterInput): Promise<CounterResult> {
  const session = await requireAuth(["ADMIN"]);
  try {
    if (!session.orgId) return { success: false, error: "No academy found for your account." };
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
      if (r.ok) created++;
      else if (r.reason === "CONFLICT") conflicts.push(d);
      else return { success: false, error: "Couldn't save the booking. Please try again." };
    }
    if (created === 0) return { success: false, error: "That slot is already booked." };
    return { success: true, created, conflicts };
  } catch (e) {
    console.error("createCounterBooking failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't save the booking. Please try again." };
  }
}

export type BookingAction = "CANCEL" | "NO_SHOW" | "COMPLETE" | "COLLECT_BALANCE" | "CANCEL_SERIES" | "CONFIRM_UPI" | "REJECT_UPI";

export async function updateBooking(id: string, action: BookingAction): Promise<{ success: boolean; error?: string }> {
  const session = await requireAuth(["ADMIN"]);
  try {
    if (!session.orgId) return { success: false, error: "No academy found for your account." };
    const orgId = session.orgId;
    const b = await db.turfBooking.findFirst({ where: { id, orgId } });
    if (!b) return { success: false, error: "Booking not found." };

    if (action === "CANCEL") {
      if (!["HOLD", "CONFIRMED", "PAID_CONFLICT"].includes(b.status)) return { success: false, error: "This booking can't be cancelled." };
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
      await db.turfBooking.updateMany({
        where: { orgId, leaseGroupId: b.leaseGroupId, status: "CONFIRMED", startTime: { gte: b.startTime } },
        data: { status: "CANCELLED" },
      });
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
    await db.auditLog
      .create({ data: { userId: session.id, orgId, action: `TURF_BOOKING_${action}`, details: JSON.stringify({ bookingId: id }) } })
      .catch(() => {});
    return { success: true };
  } catch (e) {
    console.error("updateBooking failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't update the booking." };
  }
}

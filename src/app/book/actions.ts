"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { cleanIndianPhone } from "@/lib/import-utils";
import { reserveSlot, confirmPaidBooking, UPI_REPORTED } from "@/lib/turf-engine";
import { getOrgRazorpay } from "@/lib/razorpay-org";
import { createRazorpayOrder, verifyRazorpayCheckoutSignature } from "@/lib/gateways/razorpay";
import { buildUpiLink, isValidUpiId } from "@/lib/fees";
import {
  HOLD_MINUTES,
  UPI_HOLD_MINUTES,
  UPI_VERIFY_HOURS,
  MAX_HOURS_PER_BOOKING,
  addDaysStr,
  formatRange,
  istDayRange,
  isValidDateStr,
  slotInstant,
  todayIstStr,
} from "@/lib/turf";

/**
 * Public (no login) turf booking for customers. NEVER returns other customers' names or phones:
 * availability is just "which hours are taken".
 */

const MAX_DAYS_AHEAD = 30;

export type PublicVenue = {
  slug: string;
  name: string;
  city: string;
  phone: string | null;
  onlinePayments: boolean;
  /** True when the venue has a valid UPI ID (manual UPI payment, owner confirms). */
  upi: boolean;
  facilities: { id: string; name: string; type: string; hourlyRate: number; openHour: number; closeHour: number; advanceAmount: number }[];
  today: string;
  maxDate: string;
};

export async function getPublicVenue(slug: string): Promise<PublicVenue | null> {
  const org = await db.organization.findUnique({
    where: { slug: String(slug || "") },
    select: { id: true, slug: true, name: true, city: true, phone: true, isActive: true, razorpayKeyId: true, razorpayKeySecretEnc: true, upiId: true },
  });
  if (!org || !org.isActive) return null;
  const facilities = await db.facility.findMany({
    where: { orgId: org.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, type: true, hourlyRate: true, openHour: true, closeHour: true, advanceAmount: true },
  });
  if (facilities.length === 0) return null;
  const today = todayIstStr();
  return {
    slug: org.slug,
    name: org.name,
    city: org.city,
    phone: org.phone,
    onlinePayments: Boolean(org.razorpayKeyId && org.razorpayKeySecretEnc),
    upi: Boolean(org.upiId && isValidUpiId(org.upiId)),
    facilities,
    today,
    maxDate: addDaysStr(today, MAX_DAYS_AHEAD),
  };
}

/** For each court: the hours (0-23, IST) already taken on `date`. */
export async function getPublicAvailability(
  slug: string,
  date: string
): Promise<{ busy: Record<string, number[]>; nowHour: number | null } | { error: string }> {
  if (!isValidDateStr(date)) return { error: "Pick a valid date." };
  const today = todayIstStr();
  if (date < today || date > addDaysStr(today, MAX_DAYS_AHEAD)) return { error: "Pick a date in the next 30 days." };

  const org = await db.organization.findUnique({ where: { slug: String(slug || "") }, select: { id: true, isActive: true } });
  if (!org || !org.isActive) return { error: "Venue not found." };

  const { start, end } = istDayRange(date);
  const rows = await db.turfBooking.findMany({
    where: {
      orgId: org.id,
      startTime: { lt: end },
      endTime: { gt: start },
      OR: [{ status: "CONFIRMED" }, { status: "HOLD", holdExpiresAt: { gt: new Date() } }],
    },
    select: { facilityId: true, startTime: true, endTime: true },
  });

  const busy: Record<string, number[]> = {};
  for (const r of rows) {
    const from = Math.max(r.startTime.getTime(), start.getTime());
    const to = Math.min(r.endTime.getTime(), end.getTime());
    const list = (busy[r.facilityId] ||= []);
    for (let t = from; t < to; t += 3600_000) list.push(Math.floor((t - start.getTime()) / 3600_000));
  }
  const nowHour = date === today ? new Date(Date.now() + 5.5 * 3600_000).getUTCHours() : null;
  return { busy, nowHour };
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown").split(",")[0].trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export type StartBookingResult =
  | { success: false; error: string }
  | {
      success: true;
      bookingId: string;
      orderId: string;
      keyId: string;
      amountMinor: number;
      venue: string;
      description: string;
      prefill: { name: string; contact: string };
      holdMinutes: number;
    };

export async function startOnlineBooking(input: {
  slug: string;
  facilityId: string;
  date: string;
  startHour: number;
  hours: number;
  name: string;
  phone: string;
}): Promise<StartBookingResult> {
  try {
    const name = String(input?.name ?? "").trim();
    const phone = cleanIndianPhone(input?.phone);
    const date = String(input?.date ?? "");
    const startHour = Math.round(Number(input?.startHour));
    const hours = Math.round(Number(input?.hours));

    if (name.length < 2 || name.length > 80) return { success: false, error: "Please enter your name." };
    if (!phone) return { success: false, error: "Please enter a valid 10-digit mobile number." };
    if (!isValidDateStr(date)) return { success: false, error: "Pick a valid date." };
    const today = todayIstStr();
    if (date < today || date > addDaysStr(today, MAX_DAYS_AHEAD)) return { success: false, error: "Pick a date in the next 30 days." };
    if (!(hours >= 1 && hours <= MAX_HOURS_PER_BOOKING)) return { success: false, error: `You can book 1 to ${MAX_HOURS_PER_BOOKING} hours.` };

    const ip = await clientIp();
    if (!rateLimit(`turf:phone:${phone}`, 6, 10 * 60_000).allowed || !rateLimit(`turf:ip:${ip}`, 20, 60 * 60_000).allowed) {
      return { success: false, error: "Too many attempts. Please try again in a few minutes." };
    }

    const org = await db.organization.findUnique({ where: { slug: String(input?.slug || "") }, select: { id: true, name: true, isActive: true } });
    if (!org || !org.isActive) return { success: false, error: "Venue not found." };
    const facility = await db.facility.findFirst({ where: { id: String(input?.facilityId ?? ""), orgId: org.id, isActive: true } });
    if (!facility) return { success: false, error: "Court not found." };
    if (startHour < facility.openHour || startHour + hours > facility.closeHour) return { success: false, error: "That time is outside opening hours." };

    const start = slotInstant(date, startHour);
    const end = slotInstant(date, startHour + hours);
    if (start.getTime() <= Date.now()) return { success: false, error: "That time has already started. Pick a later slot." };

    const amount = facility.hourlyRate * hours;
    if (amount <= 0) return { success: false, error: "This court's price isn't set yet. Please contact the venue." };

    const creds = await getOrgRazorpay(org.id);
    if (!creds) return { success: false, error: "Online payment isn't available for this venue. Please contact them directly." };

    // Stop one person from locking up the whole day with unpaid holds.
    const openHolds = await db.turfBooking.count({
      where: { orgId: org.id, customerPhone: phone, status: "HOLD", holdExpiresAt: { gt: new Date() } },
    });
    if (openHolds >= 2) return { success: false, error: "You already have bookings waiting for payment. Finish or wait 10 minutes." };

    const onlineDue = facility.advanceAmount > 0 ? Math.min(facility.advanceAmount, amount) : amount;
    const hold = await reserveSlot({
      orgId: org.id,
      facilityId: facility.id,
      start,
      end,
      customerName: name,
      customerPhone: phone,
      amount,
      advancePaid: 0,
      onlineDue,
      status: "HOLD",
      source: "ONLINE",
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
    });
    if (!hold.ok) {
      return {
        success: false,
        error: hold.reason === "CONFLICT" ? "Sorry, that slot was just taken. Please pick another time." : "Couldn't hold the slot. Please try again.",
      };
    }

    try {
      const order = await createRazorpayOrder(creds, {
        amountMinor: onlineDue * 100,
        currency: "INR",
        receipt: `turf_${hold.id.slice(-12)}_${Date.now().toString(36)}`.slice(0, 40),
        notes: { kind: "turf", bookingId: hold.id, orgId: org.id },
      });
      await db.turfBooking.update({ where: { id: hold.id }, data: { providerOrderId: order.id } });
      return {
        success: true,
        bookingId: hold.id,
        orderId: order.id,
        keyId: creds.keyId,
        amountMinor: onlineDue * 100,
        venue: org.name,
        description: `${facility.name} · ${formatRange(startHour, hours)}`,
        prefill: { name, contact: phone },
        holdMinutes: HOLD_MINUTES,
      };
    } catch (e) {
      await db.turfBooking.updateMany({ where: { id: hold.id, status: "HOLD" }, data: { status: "EXPIRED" } }).catch(() => {});
      console.error("startOnlineBooking order failed:", e instanceof Error ? e.message : e);
      return { success: false, error: "Couldn't start the payment. Please try again." };
    }
  } catch (e) {
    console.error("startOnlineBooking failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

/** Customer closed the payment window: free the slot straight away instead of waiting for expiry. */
export async function releaseHold(bookingId: string): Promise<void> {
  try {
    if (!bookingId) return;
    await db.turfBooking.updateMany({ where: { id: String(bookingId), status: "HOLD", source: "ONLINE", advancePaid: 0, providerPaymentId: null }, data: { status: "EXPIRED" } });
  } catch {
    /* best effort: the hold expires on its own */
  }
}

export type ConfirmResult =
  | { success: true; summary: { venue: string; court: string; date: string; startHour: number; hours: number; paid: number; balance: number; venuePhone: string | null } }
  | { success: false; error: string };

export async function confirmTurfCheckout(a: { orderId: string; paymentId: string; signature: string }): Promise<ConfirmResult> {
  try {
    if (!a?.orderId || !a?.paymentId || !a?.signature) return { success: false, error: "Missing payment details." };
    const ip = await clientIp();
    if (!rateLimit(`turf:confirm:${ip}`, 30, 10 * 60_000).allowed) return { success: false, error: "Too many attempts." };

    const booking = await db.turfBooking.findUnique({ where: { providerOrderId: a.orderId }, include: { facility: true } });
    if (!booking) return { success: false, error: "Booking not found." };
    const creds = await getOrgRazorpay(booking.orgId);
    if (!creds || !verifyRazorpayCheckoutSignature(creds.keySecret, a.orderId, a.paymentId, a.signature)) {
      return { success: false, error: "We couldn't verify this payment. If money was deducted, your booking will be confirmed automatically or the venue will contact you." };
    }
    const res = await confirmPaidBooking({ providerOrderId: a.orderId, providerPaymentId: a.paymentId, amountMinor: booking.onlineDue * 100 });
    if (!res.ok) {
      return { success: false, error: "Your payment was received but the slot is no longer available. The venue will contact you to refund or reschedule." };
    }
    const org = await db.organization.findUnique({ where: { id: booking.orgId }, select: { name: true, phone: true } });
    const startIst = new Date(booking.startTime.getTime() + 5.5 * 3600_000);
    return {
      success: true,
      summary: {
        venue: org?.name ?? "",
        court: booking.facility.name,
        date: startIst.toISOString().slice(0, 10),
        startHour: startIst.getUTCHours(),
        hours: Math.max(1, Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / 3600_000)),
        paid: booking.onlineDue,
        balance: Math.max(0, booking.amount - booking.onlineDue),
        venuePhone: org?.phone ?? null,
      },
    };
  } catch (e) {
    console.error("confirmTurfCheckout failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Something went wrong confirming your payment." };
  }
}

// ───────────────────────── UPI (no gateway: customer pays the venue's UPI, owner confirms) ─────────────────────────

export type StartUpiResult =
  | { success: false; error: string }
  | {
      success: true;
      bookingId: string;
      upiId: string;
      payee: string;
      amount: number;
      upiLink: string;
      holdMinutes: number;
      description: string;
    };

export async function startUpiBooking(input: {
  slug: string;
  facilityId: string;
  date: string;
  startHour: number;
  hours: number;
  name: string;
  phone: string;
}): Promise<StartUpiResult> {
  try {
    const name = String(input?.name ?? "").trim();
    const phone = cleanIndianPhone(input?.phone);
    const date = String(input?.date ?? "");
    const startHour = Math.round(Number(input?.startHour));
    const hours = Math.round(Number(input?.hours));

    if (name.length < 2 || name.length > 80) return { success: false, error: "Please enter your name." };
    if (!phone) return { success: false, error: "Please enter a valid 10-digit mobile number." };
    if (!isValidDateStr(date)) return { success: false, error: "Pick a valid date." };
    const today = todayIstStr();
    if (date < today || date > addDaysStr(today, MAX_DAYS_AHEAD)) return { success: false, error: "Pick a date in the next 30 days." };
    if (!(hours >= 1 && hours <= MAX_HOURS_PER_BOOKING)) return { success: false, error: `You can book 1 to ${MAX_HOURS_PER_BOOKING} hours.` };

    const ip = await clientIp();
    if (!rateLimit(`turf:phone:${phone}`, 6, 10 * 60_000).allowed || !rateLimit(`turf:ip:${ip}`, 20, 60 * 60_000).allowed) {
      return { success: false, error: "Too many attempts. Please try again in a few minutes." };
    }

    const org = await db.organization.findUnique({ where: { slug: String(input?.slug || "") }, select: { id: true, name: true, isActive: true, upiId: true } });
    if (!org || !org.isActive) return { success: false, error: "Venue not found." };
    if (!org.upiId || !isValidUpiId(org.upiId)) return { success: false, error: "UPI payment isn't set up for this venue. Please contact them directly." };
    const facility = await db.facility.findFirst({ where: { id: String(input?.facilityId ?? ""), orgId: org.id, isActive: true } });
    if (!facility) return { success: false, error: "Court not found." };
    if (startHour < facility.openHour || startHour + hours > facility.closeHour) return { success: false, error: "That time is outside opening hours." };

    const start = slotInstant(date, startHour);
    const end = slotInstant(date, startHour + hours);
    if (start.getTime() <= Date.now()) return { success: false, error: "That time has already started. Pick a later slot." };

    const amount = facility.hourlyRate * hours;
    if (amount <= 0) return { success: false, error: "This court's price isn't set yet. Please contact the venue." };

    const openHolds = await db.turfBooking.count({
      where: { orgId: org.id, customerPhone: phone, status: "HOLD", holdExpiresAt: { gt: new Date() } },
    });
    if (openHolds >= 2) return { success: false, error: "You already have bookings waiting for payment. Finish or wait 15 minutes." };

    const onlineDue = facility.advanceAmount > 0 ? Math.min(facility.advanceAmount, amount) : amount;
    const hold = await reserveSlot({
      orgId: org.id,
      facilityId: facility.id,
      start,
      end,
      customerName: name,
      customerPhone: phone,
      amount,
      advancePaid: 0,
      onlineDue,
      status: "HOLD",
      source: "ONLINE",
      holdExpiresAt: new Date(Date.now() + UPI_HOLD_MINUTES * 60_000),
    });
    if (!hold.ok) {
      return {
        success: false,
        error: hold.reason === "CONFLICT" ? "Sorry, that slot was just taken. Please pick another time." : "Couldn't hold the slot. Please try again.",
      };
    }
    const note = `${facility.name} ${date} ${formatRange(startHour, hours)}`.slice(0, 60);
    return {
      success: true,
      bookingId: hold.id,
      upiId: org.upiId,
      payee: org.name,
      amount: onlineDue,
      upiLink: buildUpiLink({ upiId: org.upiId, payeeName: org.name, amount: onlineDue, note }),
      holdMinutes: UPI_HOLD_MINUTES,
      description: `${facility.name} · ${formatRange(startHour, hours)}`,
    };
  } catch (e) {
    console.error("startUpiBooking failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export type ReportUpiResult = { success: true; late: boolean } | { success: false; error: string };

/**
 * Customer says "I've paid". We can't see a UPI payment, so this only flags the booking for the owner and keeps the
 * slot blocked for a few hours while they check their bank/UPI app. The phone must match the one used to book.
 */
export async function reportUpiPaid(input: { bookingId: string; phone: string; utr?: string }): Promise<ReportUpiResult> {
  try {
    const phone = cleanIndianPhone(input?.phone);
    if (!input?.bookingId || !phone) return { success: false, error: "Missing details." };
    const ip = await clientIp();
    if (!rateLimit(`turf:upi:${ip}`, 20, 10 * 60_000).allowed) return { success: false, error: "Too many attempts." };

    const b = await db.turfBooking.findUnique({ where: { id: String(input.bookingId) } });
    if (!b || b.source !== "ONLINE" || b.customerPhone !== phone) return { success: false, error: "Booking not found." };
    if (b.status === "CONFIRMED" || b.status === "COMPLETED") return { success: true, late: false };

    const utr = String(input?.utr ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
    const marker = utr ? `${UPI_REPORTED}:${utr}` : UPI_REPORTED;

    if (b.status === "HOLD") {
      await db.turfBooking.update({
        where: { id: b.id },
        data: { providerPaymentId: marker, holdExpiresAt: new Date(Date.now() + UPI_VERIFY_HOURS * 3600_000) },
      });
      return { success: true, late: false };
    }
    if (b.status === "EXPIRED") {
      // They paid after the 15-minute hold lapsed. The slot may be gone, so park it for the owner.
      await db.turfBooking.update({
        where: { id: b.id },
        data: {
          status: "PAID_CONFLICT",
          providerPaymentId: marker,
          notes: `Customer says they paid ₹${b.onlineDue} by UPI after the hold expired${utr ? ` (ref ${utr})` : ""}. Check your UPI app, then confirm or refund.`.slice(0, 300),
        },
      });
      return { success: true, late: true };
    }
    return { success: false, error: "This booking can no longer be updated." };
  } catch (e) {
    console.error("reportUpiPaid failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

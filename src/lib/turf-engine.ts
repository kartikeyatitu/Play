import { db } from "@/lib/db";

/**
 * Turf booking engine (server only). The ONLY place that creates or confirms a live slot.
 *
 * Double-booking protection, in layers:
 *  1. A per-facility Postgres advisory lock held for the whole transaction, so two requests for the
 *     same court are processed one after the other, never at the same time.
 *  2. An explicit overlap check inside that lock (expired holds are released first).
 *  3. A Postgres exclusion constraint on (facilityId, time range) for ACTIVE rows
 *     (scripts/apply-turf-constraint.ts): even a bug or a manual SQL edit can't create an overlap.
 */

export type ReserveInput = {
  orgId: string;
  facilityId: string;
  start: Date;
  end: Date;
  customerName: string;
  customerPhone: string;
  amount: number;
  advancePaid: number;
  onlineDue?: number;
  status: "CONFIRMED" | "HOLD";
  source: "COUNTER" | "ONLINE" | "LEASE";
  holdExpiresAt?: Date | null;
  notes?: string | null;
  leaseGroupId?: string | null;
  providerOrderId?: string | null;
};

export type ReserveResult = { ok: true; id: string } | { ok: false; reason: "CONFLICT" | "ERROR" };

const ACTIVE = ["HOLD", "CONFIRMED"];

function isOverlapViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("turf_booking_no_overlap") || msg.includes("conflicting key value violates exclusion constraint");
}

export async function reserveSlot(input: ReserveInput): Promise<ReserveResult> {
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.facilityId}))`;

        // Release holds nobody paid for, so they stop blocking the court.
        await tx.turfBooking.updateMany({
          where: { facilityId: input.facilityId, status: "HOLD", holdExpiresAt: { lt: new Date() } },
          data: { status: "EXPIRED" },
        });

        const clash = await tx.turfBooking.findFirst({
          where: {
            facilityId: input.facilityId,
            status: { in: ACTIVE },
            startTime: { lt: input.end },
            endTime: { gt: input.start },
          },
          select: { id: true },
        });
        if (clash) return { ok: false, reason: "CONFLICT" } as const;

        const created = await tx.turfBooking.create({
          data: {
            orgId: input.orgId,
            facilityId: input.facilityId,
            startTime: input.start,
            endTime: input.end,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            amount: input.amount,
            advancePaid: input.advancePaid,
            onlineDue: input.onlineDue ?? 0,
            status: input.status,
            source: input.source,
            holdExpiresAt: input.holdExpiresAt ?? null,
            notes: input.notes ?? null,
            leaseGroupId: input.leaseGroupId ?? null,
            providerOrderId: input.providerOrderId ?? null,
          },
          select: { id: true },
        });
        return { ok: true, id: created.id } as const;
      },
      { maxWait: 10_000, timeout: 15_000 }
    );
  } catch (e) {
    if (isOverlapViolation(e)) return { ok: false, reason: "CONFLICT" };
    console.error("reserveSlot failed:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "ERROR" };
  }
}

export type ConfirmResult = { ok: boolean; status?: string; error?: "NOT_FOUND" | "AMOUNT_MISMATCH" | "INTERNAL" };

/**
 * Called after the customer's Razorpay advance succeeds (browser confirm AND webhook, any order, any
 * number of times, so it must be idempotent). The expected amount was fixed on the server when the hold
 * was created; anything else is parked for a human instead of confirming the slot.
 */
export async function confirmPaidBooking(a: {
  providerOrderId: string;
  providerPaymentId?: string | null;
  amountMinor: number;
}): Promise<ConfirmResult> {
  try {
    const existing = await db.turfBooking.findUnique({ where: { providerOrderId: a.providerOrderId } });
    if (!existing) return { ok: false, error: "NOT_FOUND" };
    if (existing.status === "CONFIRMED" || existing.status === "COMPLETED") return { ok: true, status: existing.status };

    if (a.amountMinor !== existing.onlineDue * 100) {
      await db.turfBooking.updateMany({
        where: { id: existing.id, status: { notIn: ["CONFIRMED", "COMPLETED"] } },
        data: {
          status: "PAID_CONFLICT",
          providerPaymentId: a.providerPaymentId ?? null,
          notes: `Gateway reported ₹${a.amountMinor / 100}, expected ₹${existing.onlineDue}. Check Razorpay and refund or fix manually.`.slice(0, 300),
        },
      });
      return { ok: false, status: "PAID_CONFLICT", error: "AMOUNT_MISMATCH" };
    }

    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.facilityId}))`;
        const b = await tx.turfBooking.findUnique({ where: { id: existing.id } });
        if (!b) return { ok: false, error: "NOT_FOUND" } as ConfirmResult;
        if (b.status === "CONFIRMED" || b.status === "COMPLETED") return { ok: true, status: b.status } as ConfirmResult;

        if (b.status !== "HOLD") {
          // Paid after the hold lapsed (or after a cancel). Only re-confirm if nobody else took the slot.
          const clash = await tx.turfBooking.findFirst({
            where: {
              facilityId: b.facilityId,
              id: { not: b.id },
              status: { in: ACTIVE },
              startTime: { lt: b.endTime },
              endTime: { gt: b.startTime },
            },
            select: { id: true },
          });
          if (clash) {
            await tx.turfBooking.update({
              where: { id: b.id },
              data: {
                status: "PAID_CONFLICT",
                providerPaymentId: a.providerPaymentId ?? null,
                notes: `Customer paid ₹${b.onlineDue} after the hold expired and the slot was taken. Refund them in Razorpay.`,
              },
            });
            return { ok: false, status: "PAID_CONFLICT" } as ConfirmResult;
          }
        }

        await tx.turfBooking.update({
          where: { id: b.id },
          data: {
            status: "CONFIRMED",
            advancePaid: b.onlineDue,
            providerPaymentId: a.providerPaymentId ?? null,
            holdExpiresAt: null,
          },
        });
        return { ok: true, status: "CONFIRMED" } as ConfirmResult;
      },
      { maxWait: 10_000, timeout: 15_000 }
    );
  } catch (e) {
    if (isOverlapViolation(e)) return { ok: false, status: "PAID_CONFLICT", error: "INTERNAL" };
    console.error("confirmPaidBooking failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "INTERNAL" };
  }
}

/** Marker stored in `providerPaymentId` when a customer says they paid by UPI (owner must verify in their bank/UPI app). */
export const UPI_REPORTED = "UPI_REPORTED";

export type ConfirmUpiResult = { ok: true } | { ok: false; error: "NOT_FOUND" | "SLOT_TAKEN" | "BAD_STATUS" | "INTERNAL" };

/**
 * Owner confirms they received the customer's UPI advance. Works on a live HOLD, and also on a hold that
 * lapsed (the customer paid late) as long as nobody else took the slot in the meantime.
 */
export async function confirmUpiBooking(id: string, orgId: string): Promise<ConfirmUpiResult> {
  try {
    const existing = await db.turfBooking.findFirst({ where: { id, orgId }, select: { facilityId: true } });
    if (!existing) return { ok: false, error: "NOT_FOUND" };
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.facilityId}))`;
        const b = await tx.turfBooking.findFirst({ where: { id, orgId } });
        if (!b) return { ok: false, error: "NOT_FOUND" } as ConfirmUpiResult;
        if (b.status === "CONFIRMED" || b.status === "COMPLETED") return { ok: true } as ConfirmUpiResult;
        if (!["HOLD", "EXPIRED", "PAID_CONFLICT"].includes(b.status)) return { ok: false, error: "BAD_STATUS" } as ConfirmUpiResult;

        const clash = await tx.turfBooking.findFirst({
          where: {
            facilityId: b.facilityId,
            id: { not: b.id },
            status: { in: ACTIVE },
            startTime: { lt: b.endTime },
            endTime: { gt: b.startTime },
          },
          select: { id: true },
        });
        if (clash) return { ok: false, error: "SLOT_TAKEN" } as ConfirmUpiResult;

        await tx.turfBooking.update({
          where: { id: b.id },
          data: { status: "CONFIRMED", advancePaid: b.onlineDue, holdExpiresAt: null, notes: b.status === "PAID_CONFLICT" ? null : b.notes },
        });
        return { ok: true } as ConfirmUpiResult;
      },
      { maxWait: 10_000, timeout: 15_000 }
    );
  } catch (e) {
    if (isOverlapViolation(e)) return { ok: false, error: "SLOT_TAKEN" };
    console.error("confirmUpiBooking failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "INTERNAL" };
  }
}

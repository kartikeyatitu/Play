import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";

/**
 * Booking history (server only). Staff actions also go to AuditLog in the action itself; this table
 * additionally covers customers, the gateway and the system, who have no User row. Best-effort: a
 * failure here (e.g. the SQL not applied yet) must never break a booking.
 */
export type BookingActor = { type: "STAFF"; userId: string } | { type: "CUSTOMER" | "GATEWAY" | "SYSTEM" };

export async function recordBookingEvents(
  orgId: string,
  bookingIds: string[],
  action: string,
  actor: BookingActor,
  details?: Record<string, unknown>
): Promise<void> {
  if (!FEATURES.spacesOps || bookingIds.length === 0) return;
  try {
    await db.turfBookingEvent.createMany({
      data: bookingIds.map((bookingId) => ({
        orgId,
        bookingId,
        action,
        actorType: actor.type,
        actorUserId: actor.type === "STAFF" ? actor.userId : null,
        details: details ? JSON.stringify(details).slice(0, 2000) : null,
      })),
    });
  } catch (e) {
    console.warn("[turf-audit] booking event not recorded:", e instanceof Error ? e.message : e);
  }
}

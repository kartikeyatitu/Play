/**
 * Event waitlist: database layer. Server-only.
 *
 * EVERY exported function checks FEATURES.eventWaitlist first and returns without touching the
 * database when it is off: the EventWaitlist table does not exist in production until the flag is on.
 *
 * "Full" marker: Event has no capacity column, so the organiser marks an event full (and reopens it).
 * Until an Event.capacity / waitlist column exists, that marker is kept as AuditLog rows
 * (EVENT_WAITLIST_FULL / EVENT_WAITLIST_OPEN, latest wins) - see isEventFull. When nobody is waiting
 * for a freed place, the event is reopened automatically so the place is not lost.
 */
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import {
  diffEntries,
  normaliseStatus,
  offerPlaces,
  expireOffers,
  type WaitlistEntry,
  type WaitlistResult,
} from "@/lib/events/waitlist";

export const FULL_ACTION = "EVENT_WAITLIST_FULL";
export const OPEN_ACTION = "EVENT_WAITLIST_OPEN";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Client = typeof db | Tx;

const SELECT = {
  id: true,
  studentId: true,
  position: true,
  status: true,
  offeredAt: true,
  offerExpiresAt: true,
  respondedAt: true,
  createdAt: true,
} as const;

function toEntry(r: {
  id: string;
  studentId: string;
  position: number;
  status: string;
  offeredAt: Date | null;
  offerExpiresAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
}): WaitlistEntry {
  return { ...r, status: normaliseStatus(r.status) };
}

export async function loadWaitlist(eventId: string, client: Client = db): Promise<WaitlistEntry[]> {
  if (!FEATURES.eventWaitlist) return [];
  const rows = await client.eventWaitlist.findMany({ where: { eventId }, select: SELECT });
  return rows.map(toEntry);
}

/**
 * Load the event's list, apply a pure step, write the difference, and (when an offer was accepted)
 * set that student's RSVP to GOING - all in one transaction.
 */
export async function runWaitlistStep(
  event: { id: string; orgId: string | null },
  userId: string | null,
  step: (entries: WaitlistEntry[]) => WaitlistResult,
): Promise<WaitlistResult | null> {
  if (!FEATURES.eventWaitlist) return null;
  return db.$transaction(async (tx) => {
    const before = await loadWaitlist(event.id, tx);
    const r = step(before);
    if (r.error) return r;
    for (const c of diffEntries(before, r.entries)) {
      if (c.kind === "create") {
        const e = c.entry;
        await tx.eventWaitlist.create({
          data: {
            orgId: event.orgId,
            eventId: event.id,
            studentId: e.studentId,
            position: e.position,
            status: e.status,
            offeredAt: e.offeredAt,
            offerExpiresAt: e.offerExpiresAt,
            respondedAt: e.respondedAt,
            createdAt: e.createdAt,
            createdById: userId,
          },
        });
      } else {
        await tx.eventWaitlist.update({ where: { id: c.id }, data: c.data });
      }
    }
    if (r.accepted) {
      await tx.rSVP.upsert({
        where: { eventId_studentId: { eventId: event.id, studentId: r.accepted } },
        update: { status: "GOING" },
        create: { eventId: event.id, studentId: r.accepted, status: "GOING", orgId: event.orgId },
      });
    }
    return r;
  });
}

// ---- "Full" marker (no capacity column) --------------------------------------------------------

async function latestMarker(eventId: string) {
  return db.auditLog.findFirst({
    where: { action: { in: [FULL_ACTION, OPEN_ACTION] }, details: { contains: `"eventId":"${eventId}"` } },
    orderBy: { createdAt: "desc" },
    select: { action: true, userId: true },
  });
}

/** True when the organiser has marked the event full (and it has not been reopened since). */
export async function isEventFull(eventId: string): Promise<boolean> {
  if (!FEATURES.eventWaitlist) return false;
  return (await latestMarker(eventId))?.action === FULL_ACTION;
}

export async function writeFullMarker(event: { id: string; orgId: string | null }, userId: string, full: boolean, reason: string) {
  if (!FEATURES.eventWaitlist) return;
  await db.auditLog.create({
    data: { userId, orgId: event.orgId, action: full ? FULL_ACTION : OPEN_ACTION, details: JSON.stringify({ eventId: event.id, reason }) },
  });
}

/** Reopen automatically (attributed to whoever marked it full) when freed places found nobody waiting. */
export async function reopenIfUnfilled(event: { id: string; orgId: string | null }, r: WaitlistResult | null) {
  if (!FEATURES.eventWaitlist || !r || r.error || r.unfilled <= 0) return;
  const m = await latestMarker(event.id);
  if (m?.action === FULL_ACTION) await writeFullMarker(event, m.userId, false, "no_one_waiting");
}

// ---- Hooks used by updateRSVP (src/app/actions/events.ts) --------------------------------------

/**
 * Before an RSVP change. Returns the previous GOING state, and an error when the event is full and
 * the student is trying to become GOING without going through the waitlist.
 */
export async function eventWaitlistRsvpGate(eventId: string, studentId: string, status: string): Promise<{ wasGoing: boolean; error?: string }> {
  if (!FEATURES.eventWaitlist) return { wasGoing: false };
  const prev = await db.rSVP.findUnique({ where: { eventId_studentId: { eventId, studentId } }, select: { status: true } });
  const wasGoing = prev?.status === "GOING";
  if (status === "GOING" && !wasGoing && (await isEventFull(eventId))) {
    const mine = await db.eventWaitlist.findUnique({ where: { eventId_studentId: { eventId, studentId } }, select: { status: true } });
    return {
      wasGoing,
      error: mine?.status === "OFFERED" ? "Accept your waitlist offer to take the place." : "This event is full. Join the waitlist instead.",
    };
  }
  return { wasGoing };
}

/** After an RSVP change: a GOING student who cancelled frees a place for the next family. */
export async function eventWaitlistAfterRsvp(event: { id: string; orgId: string | null }, userId: string, wasGoing: boolean, status: string) {
  if (!FEATURES.eventWaitlist) return;
  if (!wasGoing || status === "GOING") return;
  try {
    await onPlacesFreed(event, userId, 1);
  } catch (e) {
    // The RSVP itself is saved; the next cron run or the organiser can still offer the place.
    console.error("[event-waitlist] offer after cancel failed", e instanceof Error ? e.message : e);
  }
}

/** Places were freed (RSVP cancelled, organiser released places): offer them if the event is full. */
export async function onPlacesFreed(event: { id: string; orgId: string | null }, userId: string | null, places: number, now = new Date()) {
  if (!FEATURES.eventWaitlist) return null;
  if (!(await isEventFull(event.id))) return null; // no limit: anyone can RSVP directly
  const r = await runWaitlistStep(event, userId, (entries) => offerPlaces(entries, places, now));
  await reopenIfUnfilled(event, r);
  return r;
}

// ---- Expiry (cron) -----------------------------------------------------------------------------

/** Expire offers older than 24 h across all events and pass each place on. */
export async function processExpiredEventOffers(now = new Date()) {
  if (!FEATURES.eventWaitlist) return { enabled: false as const, events: 0, expired: 0, offered: 0 };
  const due = await db.eventWaitlist.findMany({
    where: { status: "OFFERED", offerExpiresAt: { lte: now } },
    select: { eventId: true },
    distinct: ["eventId"],
    take: 500,
  });
  let expired = 0;
  let offered = 0;
  for (const { eventId } of due) {
    try {
      const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, orgId: true } });
      if (!event) continue;
      const r = await runWaitlistStep(event, null, (entries) => expireOffers(entries, now));
      if (!r) continue;
      expired += r.expired.length;
      offered += r.offered.length;
      await reopenIfUnfilled(event, r);
    } catch (e) {
      console.error("[event-waitlist] expiry failed", eventId, e instanceof Error ? e.message : e);
    }
  }
  return { enabled: true as const, events: due.length, expired, offered };
}

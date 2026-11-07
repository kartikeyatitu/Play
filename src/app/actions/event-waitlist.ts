"use server";

/**
 * Event waitlist actions (flag eventWaitlist). Every action returns before any query when the flag
 * is off. Parents act only for their own children; organisers (admins, and coaches for their own
 * batches - same rule as createEvent) see and manage the list.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import {
  acceptOffer,
  activeQueue,
  declineOrLeave,
  familyView,
  joinWaitlist,
  offerPlaces,
  waitlistErrorText,
} from "@/lib/events/waitlist";
import { isEventFull, loadWaitlist, onPlacesFreed, reopenIfUnfilled, runWaitlistStep, writeFullMarker } from "@/lib/events/waitlist-server";

const OFF = { success: false as const, error: "Event waitlists are not enabled yet." };

function clean(id: unknown) {
  return typeof id === "string" ? id.trim().slice(0, 40) : "";
}

/** The parent's own child, and an upcoming event for a batch that child is enrolled in. */
async function parentScope(eventIdRaw: unknown, studentIdRaw: unknown) {
  const session = await requireAuth(["PARENT"]);
  const eventId = clean(eventIdRaw);
  const studentId = clean(studentIdRaw);
  if (!eventId || !studentId) return null;
  const student = await db.student.findFirst({ where: { id: studentId, parentId: session.id }, select: { id: true } });
  if (!student) return null;
  const event = await db.event.findFirst({
    where: { id: eventId, batch: { enrollments: { some: { studentId: student.id } } } },
    select: { id: true, orgId: true, date: true },
  });
  if (!event) return null;
  return { session, student, event };
}

/** An event the signed-in organiser may manage. */
async function organiserScope(eventIdRaw: unknown) {
  const session = await requireAuth(["ADMIN", "COACH"]);
  const eventId = clean(eventIdRaw);
  if (!eventId) return null;
  const orgId = session.orgId || "__no_org__";
  const event = await db.event.findFirst({
    where: { id: eventId, batch: session.role === "COACH" ? { orgId, coachId: session.id } : { orgId } },
    select: { id: true, orgId: true, date: true, title: true },
  });
  return event ? { session, event } : null;
}

function refresh() {
  revalidatePath("/parent");
  revalidatePath("/coach");
}

// ---- Parent ------------------------------------------------------------------------------------

export async function getEventWaitlistForFamily(eventId: string, studentId: string) {
  if (!FEATURES.eventWaitlist) return { enabled: false as const };
  const s = await parentScope(eventId, studentId);
  if (!s) return { enabled: true as const, error: "Event not found" };
  const [entries, full, rsvp] = await Promise.all([
    loadWaitlist(s.event.id),
    isEventFull(s.event.id),
    db.rSVP.findUnique({ where: { eventId_studentId: { eventId: s.event.id, studentId: s.student.id } }, select: { status: true } }),
  ]);
  const view = familyView(entries, s.student.id, new Date());
  return {
    enabled: true as const,
    full,
    upcoming: s.event.date.getTime() >= Date.now(),
    rsvpStatus: rsvp?.status ?? null,
    status: view.status,
    position: view.position,
    waiting: view.waiting,
    offerExpiresAt: view.offerExpiresAt ? view.offerExpiresAt.toISOString() : null,
  };
}

export async function joinEventWaitlist(eventId: string, studentId: string) {
  if (!FEATURES.eventWaitlist) return OFF;
  const s = await parentScope(eventId, studentId);
  if (!s) return { success: false as const, error: "Event not found" };
  if (s.event.date.getTime() < Date.now()) return { success: false as const, error: "This event has already happened." };
  if (!(await isEventFull(s.event.id))) return { success: false as const, error: "There are places left. RSVP Going instead." };
  const rsvp = await db.rSVP.findUnique({
    where: { eventId_studentId: { eventId: s.event.id, studentId: s.student.id } },
    select: { status: true },
  });
  if (rsvp?.status === "GOING") return { success: false as const, error: "Your child is already going." };
  const r = await runWaitlistStep(s.event, s.session.id, (entries) => joinWaitlist(entries, s.student.id, new Date()));
  if (!r) return OFF;
  if (r.error) return { success: false as const, error: waitlistErrorText(r.error) };
  refresh();
  const position = activeQueue(r.entries).findIndex((e) => e.studentId === s.student.id) + 1;
  return { success: true as const, position };
}

export async function acceptEventWaitlistOffer(eventId: string, studentId: string) {
  if (!FEATURES.eventWaitlist) return OFF;
  const s = await parentScope(eventId, studentId);
  if (!s) return { success: false as const, error: "Event not found" };
  const r = await runWaitlistStep(s.event, s.session.id, (entries) => acceptOffer(entries, s.student.id, new Date()));
  if (!r) return OFF;
  if (r.error) return { success: false as const, error: waitlistErrorText(r.error) };
  refresh();
  return { success: true as const };
}

/** Decline an offer (the place goes to the next family) or leave the list. */
export async function leaveEventWaitlist(eventId: string, studentId: string) {
  if (!FEATURES.eventWaitlist) return OFF;
  const s = await parentScope(eventId, studentId);
  if (!s) return { success: false as const, error: "Event not found" };
  const r = await runWaitlistStep(s.event, s.session.id, (entries) => declineOrLeave(entries, s.student.id, new Date()));
  if (!r) return OFF;
  if (r.error) return { success: false as const, error: waitlistErrorText(r.error) };
  await reopenIfUnfilled(s.event, r); // a declined place nobody was waiting for reopens the event
  refresh();
  return { success: true as const };
}

// ---- Organiser ---------------------------------------------------------------------------------

export async function getEventWaitlistForOrganiser(eventId: string) {
  if (!FEATURES.eventWaitlist) return { enabled: false as const };
  const s = await organiserScope(eventId);
  if (!s) return { enabled: true as const, error: "Event not found" };
  const [entries, full] = await Promise.all([loadWaitlist(s.event.id), isEventFull(s.event.id)]);
  const ids = entries.map((e) => e.studentId);
  const students = ids.length
    ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(students.map((x) => [x.id, x.name]));
  const order = (e: (typeof entries)[number]) => (e.position > 0 ? e.position : 10_000);
  return {
    enabled: true as const,
    full,
    entries: entries
      .slice()
      .sort((a, b) => order(a) - order(b) || a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => ({
        studentId: e.studentId,
        name: names.get(e.studentId) ?? "Student",
        position: e.position,
        status: e.status,
        offerExpiresAt: e.offerExpiresAt ? e.offerExpiresAt.toISOString() : null,
        declined: e.status === "EXPIRED" && Boolean(e.respondedAt),
      })),
  };
}

/** Mark the event full (parents then join the waitlist) or reopen it (everyone waiting gets an offer). */
export async function setEventWaitlistFull(eventId: string, full: boolean) {
  if (!FEATURES.eventWaitlist) return OFF;
  const s = await organiserScope(eventId);
  if (!s) return { success: false as const, error: "Event not found" };
  if ((await isEventFull(s.event.id)) === Boolean(full)) return { success: true as const };
  if (!full) {
    // Reopening lifts the limit: everyone still waiting is offered a place.
    await runWaitlistStep(s.event, s.session.id, (entries) => offerPlaces(entries, entries.length, new Date()));
  }
  await writeFullMarker(s.event, s.session.id, Boolean(full), "organiser");
  refresh();
  return { success: true as const };
}

/** The organiser has room for more: offer `places` places to the next families. */
export async function offerNextEventPlaces(eventId: string, places = 1) {
  if (!FEATURES.eventWaitlist) return OFF;
  const s = await organiserScope(eventId);
  if (!s) return { success: false as const, error: "Event not found" };
  const n = Math.min(50, Math.max(1, Math.floor(Number(places) || 1)));
  const r = await onPlacesFreed(s.event, s.session.id, n);
  refresh();
  if (!r) return { success: false as const, error: "Mark the event full first; while it is open anyone can RSVP." };
  return { success: true as const, offered: r.offered.length };
}

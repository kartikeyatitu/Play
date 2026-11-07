/**
 * Event waitlist: pure state machine (no database, no React). Shared by the server layer
 * (src/lib/events/waitlist-server.ts), the cron route and tests.
 *
 * Statuses (EventWaitlist.status): WAITING | OFFERED | ACCEPTED | EXPIRED.
 * - A declined offer, or a family leaving the list, is stored as EXPIRED with respondedAt set.
 *   An offer that ran out is EXPIRED with respondedAt null.
 * - Only WAITING and OFFERED entries are "active" and hold a queue position (1..n). Inactive
 *   entries get position 0.
 *
 * Capacity: Event has no capacity column, so nothing here counts places. Callers say how many places
 * were freed (an RSVP cancelled, the organiser released a place) and the machine offers them in order.
 */

export const OFFER_HOURS = 24;
export const OFFER_MS = OFFER_HOURS * 60 * 60 * 1000;

export const WAITLIST_STATUSES = ["WAITING", "OFFERED", "ACCEPTED", "EXPIRED"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export type WaitlistEntry = {
  /** null for an entry that has not been saved yet. */
  id: string | null;
  studentId: string;
  position: number;
  status: WaitlistStatus;
  offeredAt: Date | null;
  offerExpiresAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
};

export type WaitlistError = "ALREADY_ON_LIST" | "NOT_ON_LIST" | "NO_OFFER" | "OFFER_EXPIRED";

export type WaitlistResult = {
  entries: WaitlistEntry[];
  /** Students newly offered a place by this step. */
  offered: string[];
  /** Student whose offer was accepted (their RSVP becomes GOING). */
  accepted: string | null;
  /** Students whose offer ran out in this step. */
  expired: string[];
  /** Freed places nobody was waiting for. */
  unfilled: number;
  error?: WaitlistError;
};

export function isActive(e: Pick<WaitlistEntry, "status">): boolean {
  return e.status === "WAITING" || e.status === "OFFERED";
}

export function normaliseStatus(s: string): WaitlistStatus {
  return (WAITLIST_STATUSES as readonly string[]).includes(s) ? (s as WaitlistStatus) : "EXPIRED";
}

function byQueue(a: WaitlistEntry, b: WaitlistEntry): number {
  return a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime() || a.studentId.localeCompare(b.studentId);
}

function clone(entries: WaitlistEntry[]): WaitlistEntry[] {
  return entries.map((e) => ({ ...e }));
}

function result(entries: WaitlistEntry[], extra: Partial<WaitlistResult> = {}): WaitlistResult {
  return { entries: recomputePositions(entries), offered: [], accepted: null, expired: [], unfilled: 0, ...extra };
}

/** Active entries in queue order (position, then join time). */
export function activeQueue(entries: WaitlistEntry[]): WaitlistEntry[] {
  return entries.filter(isActive).sort(byQueue);
}

/** Renumber active entries 1..n in queue order; inactive entries get 0. Returns new objects. */
export function recomputePositions(entries: WaitlistEntry[]): WaitlistEntry[] {
  const next = clone(entries);
  const order = new Map(activeQueue(next).map((e, i) => [e, i + 1]));
  for (const e of next) e.position = order.get(e) ?? 0;
  return next;
}

/** Offer up to `places` freed places to the next WAITING families, each with a 24 h expiry. */
export function offerPlaces(entries: WaitlistEntry[], places: number, now: Date): WaitlistResult {
  const next = clone(entries);
  const want = Math.max(0, Math.floor(places));
  const waiting = next.filter((e) => e.status === "WAITING").sort(byQueue).slice(0, want);
  for (const e of waiting) {
    e.status = "OFFERED";
    e.offeredAt = now;
    e.offerExpiresAt = new Date(now.getTime() + OFFER_MS);
    e.respondedAt = null;
  }
  return result(next, { offered: waiting.map((e) => e.studentId), unfilled: want - waiting.length });
}

/** Add a family at the end of the queue. A student already WAITING or OFFERED is not added twice. */
export function joinWaitlist(entries: WaitlistEntry[], studentId: string, now: Date): WaitlistResult {
  const next = recomputePositions(entries);
  const existing = next.find((e) => e.studentId === studentId);
  if (existing && isActive(existing)) return result(next, { error: "ALREADY_ON_LIST" });
  const position = activeQueue(next).length + 1;
  if (existing) {
    // Re-joining after leaving, an expired offer or a cancelled place: same row, back of the queue.
    Object.assign(existing, { status: "WAITING", position, offeredAt: null, offerExpiresAt: null, respondedAt: null, createdAt: now });
  } else {
    next.push({ id: null, studentId, position, status: "WAITING", offeredAt: null, offerExpiresAt: null, respondedAt: null, createdAt: now });
  }
  return result(next);
}

/** Accept a live offer: the entry becomes ACCEPTED and the caller sets the RSVP to GOING. */
export function acceptOffer(entries: WaitlistEntry[], studentId: string, now: Date): WaitlistResult {
  const next = clone(entries);
  const e = next.find((x) => x.studentId === studentId);
  if (!e || !isActive(e)) return result(next, { error: "NOT_ON_LIST" });
  if (e.status !== "OFFERED") return result(next, { error: "NO_OFFER" });
  if (!e.offerExpiresAt || e.offerExpiresAt.getTime() <= now.getTime()) return result(next, { error: "OFFER_EXPIRED" });
  e.status = "ACCEPTED";
  e.respondedAt = now;
  return result(next, { accepted: studentId });
}

/**
 * Decline an offer or leave the list. Declining an offer passes the place to the next family;
 * leaving while still WAITING frees nothing.
 */
export function declineOrLeave(entries: WaitlistEntry[], studentId: string, now: Date): WaitlistResult {
  const next = clone(entries);
  const e = next.find((x) => x.studentId === studentId);
  if (!e || !isActive(e)) return result(next, { error: "NOT_ON_LIST" });
  const hadOffer = e.status === "OFFERED";
  e.status = "EXPIRED";
  e.respondedAt = now;
  if (!hadOffer) return result(next);
  return offerPlaces(next, 1, now);
}

/** Expire offers whose 24 h ran out and offer each of those places to the next family. */
export function expireOffers(entries: WaitlistEntry[], now: Date): WaitlistResult {
  const next = clone(entries);
  const expired: string[] = [];
  for (const e of next) {
    if (e.status === "OFFERED" && (!e.offerExpiresAt || e.offerExpiresAt.getTime() <= now.getTime())) {
      e.status = "EXPIRED";
      expired.push(e.studentId);
    }
  }
  if (!expired.length) return result(next);
  const r = offerPlaces(next, expired.length, now);
  return { ...r, expired };
}

/** What a family sees for one child. Position is 1-based among active entries, or null. */
export function familyView(entries: WaitlistEntry[], studentId: string, now: Date) {
  const queue = activeQueue(entries);
  const idx = queue.findIndex((e) => e.studentId === studentId);
  const e = entries.find((x) => x.studentId === studentId) ?? null;
  const offerLive = Boolean(e && e.status === "OFFERED" && e.offerExpiresAt && e.offerExpiresAt.getTime() > now.getTime());
  return {
    status: e?.status ?? null,
    position: idx >= 0 ? idx + 1 : null,
    waiting: queue.length,
    offerExpiresAt: offerLive ? e!.offerExpiresAt : null,
  };
}

export type WaitlistChange =
  | { kind: "create"; entry: WaitlistEntry }
  | { kind: "update"; id: string; data: Partial<Omit<WaitlistEntry, "id" | "studentId">> };

const FIELDS = ["position", "status", "offeredAt", "offerExpiresAt", "respondedAt", "createdAt"] as const;

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  return a === b;
}

/** Writes needed to go from `before` (as loaded) to `after`. Never deletes. */
export function diffEntries(before: WaitlistEntry[], after: WaitlistEntry[]): WaitlistChange[] {
  const byId = new Map(before.filter((e) => e.id).map((e) => [e.id as string, e]));
  const out: WaitlistChange[] = [];
  for (const e of after) {
    const old = e.id ? byId.get(e.id) : undefined;
    if (!e.id || !old) {
      out.push({ kind: "create", entry: e });
      continue;
    }
    const data: Record<string, unknown> = {};
    for (const k of FIELDS) if (!same(old[k], e[k])) data[k] = e[k];
    if (Object.keys(data).length) out.push({ kind: "update", id: e.id, data: data as Partial<Omit<WaitlistEntry, "id" | "studentId">> });
  }
  return out;
}

export function waitlistErrorText(error: WaitlistError): string {
  switch (error) {
    case "ALREADY_ON_LIST":
      return "Already on the waitlist.";
    case "NOT_ON_LIST":
      return "Not on the waitlist.";
    case "NO_OFFER":
      return "There is no place on offer yet.";
    case "OFFER_EXPIRED":
      return "This offer has expired.";
  }
}

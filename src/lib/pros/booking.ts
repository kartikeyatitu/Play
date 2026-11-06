// TRIQ Connect booking requests on top of the WellnessAppointment lifecycle (src/lib/wellness.ts).
// Pure and client-safe. No clinical data: a request carries a time, who it is for, and an optional short
// reason the requester chooses to write. WellnessAppointment has no "for whom" column, so the child's
// short label is written as the first line of the (party-only) note; the audit row keeps the student id.

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_REASON = 300;
export const FOR_PREFIX = "For: ";

export type BookingSubject = { kind: "SELF" } | { kind: "CHILD"; studentId: string };

/**
 * Parents book for one of their own children only (never themselves or anyone else's child).
 * Other signed-in adults book for themselves.
 */
export function resolveBookingSubject(role: string, rawFor: unknown, ownChildIds: string[]): Result<BookingSubject> {
  const v = typeof rawFor === "string" ? rawFor.trim() : "";
  if (role === "PARENT") {
    if (!v || v === "SELF") return { ok: false, error: "Choose which of your children this is for" };
    if (!ownChildIds.includes(v)) return { ok: false, error: "You can only request sessions for your own child" };
    return { ok: true, value: { kind: "CHILD", studentId: v } };
  }
  if (v && v !== "SELF") return { ok: false, error: "You can only request sessions for yourself" };
  return { ok: true, value: { kind: "SELF" } };
}

/** First name and last initial (minors are never shown in full beyond the two parties). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Athlete";
  const firstName = parts[0].slice(0, 30);
  return parts.length > 1 ? `${firstName} ${parts[parts.length - 1][0].toUpperCase()}.` : firstName;
}

export function validateReason(raw: unknown): Result<string | null> {
  const s = typeof raw === "string" ? raw.trim().replace(/\r\n/g, "\n") : "";
  if (s.length > MAX_REASON) return { ok: false, error: `Keep the reason to ${MAX_REASON} characters or fewer` };
  return { ok: true, value: s || null };
}

export function composeBookingNote(forLabel: string | null, reason: string | null): string | null {
  const head = forLabel ? `${FOR_PREFIX}${forLabel.replace(/\n/g, " ")}` : null;
  if (head && reason) return `${head}\n${reason}`;
  return head ?? reason ?? null;
}

export function parseBookingNote(note: string | null): { forLabel: string | null; reason: string | null } {
  if (!note) return { forLabel: null, reason: null };
  const [firstLine, ...rest] = note.split("\n");
  if (firstLine.startsWith(FOR_PREFIX)) {
    const reason = rest.join("\n").trim();
    return { forLabel: firstLine.slice(FOR_PREFIX.length).trim() || null, reason: reason || null };
  }
  return { forLabel: null, reason: note };
}

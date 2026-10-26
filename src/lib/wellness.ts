// V6 TRIQ Wellness — provider profiles and the appointment lifecycle. Pure and client-safe.
// No clinical fields and no clinical decision-making: this is scheduling and access control only.

export const PROVIDER_CATEGORIES = ["PHYSIOTHERAPY", "NUTRITION", "RECOVERY", "PSYCHOLOGY"] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];
export const PROVIDER_CATEGORY_LABELS: Record<ProviderCategory, string> = {
  PHYSIOTHERAPY: "Physiotherapy & rehab",
  NUTRITION: "Sports nutrition",
  RECOVERY: "Recovery services",
  PSYCHOLOGY: "Sports psychology",
};
export const isProviderCategory = (v: unknown): v is ProviderCategory =>
  typeof v === "string" && (PROVIDER_CATEGORIES as readonly string[]).includes(v);

export const APPOINTMENT_STATUSES = ["REQUESTED", "CONFIRMED", "DECLINED", "COMPLETED", "CANCELLED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export const isAppointmentStatus = (v: unknown): v is AppointmentStatus =>
  typeof v === "string" && (APPOINTMENT_STATUSES as readonly string[]).includes(v);

export const APPOINTMENT_ACTIONS = ["CONFIRM", "DECLINE", "COMPLETE", "CANCEL"] as const;
export type AppointmentAction = (typeof APPOINTMENT_ACTIONS)[number];
export const isAppointmentAction = (v: unknown): v is AppointmentAction =>
  typeof v === "string" && (APPOINTMENT_ACTIONS as readonly string[]).includes(v);

export type AppointmentActor = "PROVIDER" | "REQUESTER";

export type Transition = { ok: true; to: AppointmentStatus } | { ok: false; error: string };

/**
 * The appointment state machine.
 * REQUESTED --CONFIRM(provider)--> CONFIRMED --COMPLETE(provider, at/after the time)--> COMPLETED
 * REQUESTED --DECLINE(provider)--> DECLINED
 * REQUESTED|CONFIRMED --CANCEL(either party)--> CANCELLED
 * DECLINED, COMPLETED, CANCELLED are terminal.
 */
export function transitionAppointment(
  from: string,
  action: string,
  actor: AppointmentActor,
  ctx: { now: Date; scheduledAt: Date },
): Transition {
  if (!isAppointmentStatus(from)) return { ok: false, error: "Unknown appointment status" };
  if (!isAppointmentAction(action)) return { ok: false, error: "Unknown action" };
  switch (action) {
    case "CONFIRM":
      if (actor !== "PROVIDER") return { ok: false, error: "Only the provider can confirm" };
      if (from !== "REQUESTED") return { ok: false, error: "Only requested appointments can be confirmed" };
      if (ctx.scheduledAt.getTime() <= ctx.now.getTime()) return { ok: false, error: "This time has already passed" };
      return { ok: true, to: "CONFIRMED" };
    case "DECLINE":
      if (actor !== "PROVIDER") return { ok: false, error: "Only the provider can decline" };
      if (from !== "REQUESTED") return { ok: false, error: "Only requested appointments can be declined" };
      return { ok: true, to: "DECLINED" };
    case "COMPLETE":
      if (actor !== "PROVIDER") return { ok: false, error: "Only the provider can mark an appointment complete" };
      if (from !== "CONFIRMED") return { ok: false, error: "Only confirmed appointments can be completed" };
      if (ctx.now.getTime() < ctx.scheduledAt.getTime()) return { ok: false, error: "The appointment has not happened yet" };
      return { ok: true, to: "COMPLETED" };
    case "CANCEL":
      if (from !== "REQUESTED" && from !== "CONFIRMED") return { ok: false, error: "This appointment can no longer be cancelled" };
      return { ok: true, to: "CANCELLED" };
  }
}

/** Actions a given actor can take right now (for rendering buttons). */
export function availableActions(from: string, actor: AppointmentActor, ctx: { now: Date; scheduledAt: Date }): AppointmentAction[] {
  return APPOINTMENT_ACTIONS.filter((a) => transitionAppointment(from, a, actor, ctx).ok);
}

/** Timestamp column stamped for each resulting status. */
export function timestampFieldFor(to: AppointmentStatus): "confirmedAt" | "declinedAt" | "completedAt" | "cancelledAt" | null {
  switch (to) {
    case "CONFIRMED":
      return "confirmedAt";
    case "DECLINED":
      return "declinedAt";
    case "COMPLETED":
      return "completedAt";
    case "CANCELLED":
      return "cancelledAt";
    default:
      return null;
  }
}

// ---- validation ---------------------------------------------------------------------------------

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export interface ProviderInput {
  displayName: string;
  category: ProviderCategory;
  services: string | null;
  bio: string | null;
  city: string | null;
  registrationBody: string | null;
  registrationNumber: string | null;
  isListed: boolean;
  acceptingRequests: boolean;
}

export function validateProvider(raw: Record<string, unknown>): Result<ProviderInput> {
  const displayName = str(raw.displayName);
  if (displayName.length < 2 || displayName.length > 80) return { ok: false, error: "Name must be 2–80 characters" };
  if (!isProviderCategory(raw.category)) return { ok: false, error: "Choose a service category" };
  const services = str(raw.services);
  const bio = str(raw.bio);
  const city = str(raw.city);
  const registrationBody = str(raw.registrationBody);
  const registrationNumber = str(raw.registrationNumber);
  if (services.length > 500) return { ok: false, error: "Services must be 500 characters or fewer" };
  if (bio.length > 2000) return { ok: false, error: "Bio must be 2000 characters or fewer" };
  if (city.length > 80) return { ok: false, error: "City must be 80 characters or fewer" };
  if (registrationBody.length > 120) return { ok: false, error: "Registration body must be 120 characters or fewer" };
  if (registrationNumber.length > 60) return { ok: false, error: "Registration number must be 60 characters or fewer" };
  const on = (v: unknown) => v === "on" || v === "true" || v === true;
  return {
    ok: true,
    value: {
      displayName,
      category: raw.category,
      services: services || null,
      bio: bio || null,
      city: city || null,
      registrationBody: registrationBody || null,
      registrationNumber: registrationNumber || null,
      isListed: on(raw.isListed),
      acceptingRequests: on(raw.acceptingRequests),
    },
  };
}

/** Whether a change to these fields must send the credential back to SUBMITTED for re-checking. */
export function credentialFieldsChanged(
  before: { registrationBody: string | null; registrationNumber: string | null; category: string },
  after: { registrationBody: string | null; registrationNumber: string | null; category: string },
): boolean {
  return before.registrationBody !== after.registrationBody || before.registrationNumber !== after.registrationNumber || before.category !== after.category;
}

export const MAX_BOOKING_AHEAD_DAYS = 180;

/**
 * Parses a `datetime-local` value entered in IST (Asia/Kolkata, UTC+5:30, no DST) into a Date.
 * Must be in the future and within MAX_BOOKING_AHEAD_DAYS.
 */
export function parseIstDateTime(raw: unknown, now: Date): Result<Date> {
  const s = str(raw);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return { ok: false, error: "Choose a date and time" };
  const [, y, mo, d, h, mi] = m.map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - (5 * 60 + 30) * 60 * 1000;
  const date = new Date(utcMs);
  const calendar = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(date.getTime()) || calendar.getUTCDate() !== d || calendar.getUTCMonth() !== mo - 1 || h > 23 || mi > 59) {
    return { ok: false, error: "Choose a valid date" };
  }
  if (date.getTime() <= now.getTime()) return { ok: false, error: "Choose a time in the future" };
  if (date.getTime() > now.getTime() + MAX_BOOKING_AHEAD_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, error: `Choose a time within ${MAX_BOOKING_AHEAD_DAYS} days` };
  }
  return { ok: true, value: date };
}

export function validateNote(raw: unknown, max = 500): Result<string | null> {
  const s = str(raw);
  if (s.length > max) return { ok: false, error: `Note must be ${max} characters or fewer` };
  return { ok: true, value: s || null };
}

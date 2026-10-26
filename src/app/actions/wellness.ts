"use server";

// V6 TRIQ Wellness server actions (provider profiles + appointment lifecycle). Async exports only.
// Audit rows carry ids, statuses and field names — never appointment notes or other health details.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { rateLimitDb } from "@/lib/rate-limit";
import {
  credentialFieldsChanged,
  parseIstDateTime,
  timestampFieldFor,
  transitionAppointment,
  validateNote,
  validateProvider,
} from "@/lib/wellness";

const PROVIDER = "/wellness/provider";

function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function back(path: string, error?: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}error=${encodeURIComponent(error)}` : `${path}${sep}saved=1`);
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function safeReturn(raw: unknown, fallback: string): string {
  return typeof raw === "string" && /^\/wellness(\/[a-zA-Z0-9_\-/]*)?$/.test(raw) ? raw : fallback;
}

async function signedIn() {
  if (!FEATURES.wellness) redirect("/");
  return requireAuth();
}

async function audit(userId: string, orgId: string | null, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
}

export async function saveProviderProfile(formData: FormData): Promise<void> {
  const session = await signedIn();
  const parsed = validateProvider(fields(formData));
  if (!parsed.ok) back(PROVIDER, parsed.error);
  const existing = await db.wellnessProvider.findUnique({ where: { userId: session.id } });
  let resetCredential = false;
  if (existing) {
    resetCredential = existing.credentialStatus !== "SUBMITTED" && credentialFieldsChanged(existing, parsed.value);
    await db.wellnessProvider.update({
      where: { id: existing.id },
      data: {
        ...parsed.value,
        // Changing registration details sends the credential back for re-checking.
        ...(resetCredential
          ? {
              credentialStatus: "SUBMITTED",
              credentialReviewedById: null,
              credentialReviewedAt: null,
              credentialVerifiedById: null,
              credentialVerifiedAt: null,
              credentialRejectReason: null,
            }
          : {}),
      },
    });
  } else {
    await db.wellnessProvider.create({ data: { userId: session.id, ...parsed.value, credentialStatus: "SUBMITTED" } });
  }
  await audit(session.id, session.orgId, "WELLNESS_PROVIDER_SAVED", {
    category: parsed.value.category,
    isListed: parsed.value.isListed,
    credentialReset: resetCredential,
  });
  revalidatePath(PROVIDER);
  revalidatePath("/wellness");
  back(PROVIDER);
}

export async function requestAppointment(formData: FormData): Promise<void> {
  const session = await signedIn();
  const providerId = formData.get("providerId");
  if (!validId(providerId)) back("/wellness", "Provider not found");
  const path = `/wellness/p/${providerId}`;
  const when = parseIstDateTime(formData.get("scheduledAt"), new Date());
  if (!when.ok) back(path, when.error);
  const note = validateNote(formData.get("note"));
  if (!note.ok) back(path, note.error);

  const limit = await rateLimitDb(`wellness-request:${session.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) back(path, "Too many requests in the last hour. Try again later.");

  const provider = await db.wellnessProvider.findFirst({
    where: { id: providerId, isListed: true, acceptingRequests: true },
    select: { id: true, userId: true, category: true },
  });
  if (!provider) back(path, "This provider is not accepting requests");
  if (provider.userId === session.id) back(path, "You cannot book yourself");
  const open = await db.wellnessAppointment.count({
    where: { providerId: provider.id, requesterId: session.id, status: { in: ["REQUESTED", "CONFIRMED"] } },
  });
  if (open >= 3) back(path, "You already have 3 open requests with this provider");

  const appt = await db.wellnessAppointment.create({
    data: {
      providerId: provider.id,
      providerUserId: provider.userId,
      requesterId: session.id,
      category: provider.category,
      scheduledAt: when.value,
      note: note.value,
      status: "REQUESTED",
    },
  });
  await audit(session.id, session.orgId, "WELLNESS_APPOINTMENT_REQUESTED", { appointmentId: appt.id, providerId: provider.id });
  revalidatePath("/wellness");
  back("/wellness");
}

/** Provider: CONFIRM | DECLINE | COMPLETE | CANCEL. Requester: CANCEL. */
export async function actOnAppointment(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  const action = String(formData.get("action") || "");
  const returnTo = safeReturn(formData.get("returnTo"), "/wellness");
  if (!validId(id)) back(returnTo, "Appointment not found");
  const reason = validateNote(formData.get("reason"), 300);
  if (!reason.ok) back(returnTo, reason.error);

  // Only the two parties can see or change an appointment.
  const appt = await db.wellnessAppointment.findFirst({
    where: { id, OR: [{ providerUserId: session.id }, { requesterId: session.id }] },
  });
  if (!appt) back(returnTo, "Appointment not found");
  const actor = appt.providerUserId === session.id ? "PROVIDER" : "REQUESTER";
  const t = transitionAppointment(appt.status, action, actor, { now: new Date(), scheduledAt: appt.scheduledAt });
  if (!t.ok) back(returnTo, t.error);

  const stampField = timestampFieldFor(t.to);
  // Compare-and-set on the current status so two concurrent clicks cannot both apply.
  const { count } = await db.wellnessAppointment.updateMany({
    where: { id: appt.id, status: appt.status },
    data: {
      status: t.to,
      ...(stampField ? { [stampField]: new Date() } : {}),
      ...(t.to === "CANCELLED" ? { cancelledById: session.id, cancelReason: reason.value } : {}),
    },
  });
  if (!count) back(returnTo, "The appointment changed meanwhile. Refresh and try again.");
  await audit(session.id, session.orgId, "WELLNESS_APPOINTMENT_STATUS_CHANGED", {
    appointmentId: appt.id,
    from: appt.status,
    to: t.to,
    actor,
  });
  revalidatePath("/wellness");
  revalidatePath(PROVIDER);
  back(returnTo);
}

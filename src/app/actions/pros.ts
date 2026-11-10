"use server";

// TRIQ Connect professional onboarding and booking requests. Async exports only.
// - userId always comes from the session, never the form.
// - Nothing here can set a credential or provider to VERIFIED: only /ops/credentials (SUPER_ADMIN) can.
// - Audit rows carry ids, statuses and field names only — never booking reasons or other health details.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { myChildrenWhere } from "@/lib/family/guardians";
import { requireAuth } from "@/lib/auth";
import { rateLimitDb } from "@/lib/rate-limit";
import { safeHttpUrl } from "@/lib/safe-url";
import { validateCredential, validateExperience } from "@/lib/careers";
import { parseIstDateTime, timestampFieldFor, transitionAppointment, validateNote } from "@/lib/wellness";
import { prosEnabled } from "@/lib/pros/flag";
import { joinBio, splitBio } from "@/lib/pros/meta";
import { providerNeedsRecheck, validateOnboarding, type RawForm } from "@/lib/pros/onboarding";
import { HEALTH_CATEGORY_BY_TYPE, credentialTitle, findCredentialType, isHealthType } from "@/lib/pros/types";
import { composeBookingNote, resolveBookingSubject, shortName, validateReason } from "@/lib/pros/booking";
import { loadListing } from "@/lib/pros/data";

const JOIN = "/pros/join";
const DASH = "/pros/dashboard";

function form(fd: FormData): RawForm {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

function single(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !(k in out)) out[k] = v;
  return out;
}

function back(path: string, error?: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}error=${encodeURIComponent(error)}` : `${path}${sep}saved=1`);
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

async function signedIn() {
  if (!prosEnabled()) redirect("/");
  return requireAuth();
}

async function audit(userId: string, orgId: string | null, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify({ source: "PROS", ...details }) } });
}

async function currentType(userId: string) {
  const p = await db.professionalProfile.findUnique({ where: { userId }, select: { bio: true } });
  return splitBio(p?.bio).meta?.type ?? null;
}

// ---- onboarding ----------------------------------------------------------------------------------

export async function saveProsProfile(formData: FormData): Promise<void> {
  const session = await signedIn();
  const parsed = validateOnboarding(form(formData));
  if (!parsed.ok) back(JOIN, parsed.error);
  const v = parsed.value;

  const existing = await db.professionalProfile.findUnique({ where: { userId: session.id }, select: { bio: true } });
  const prevType = splitBio(existing?.bio).meta?.type ?? null;
  const profileData = {
    headline: v.headline,
    bio: joinBio(v.bio, v.meta),
    sports: v.sports,
    city: v.city,
    yearsExperience: v.yearsExperience,
    isPublic: v.listed,
  };
  await db.professionalProfile.upsert({
    where: { userId: session.id },
    create: { userId: session.id, ...profileData },
    update: profileData,
  });

  const category = HEALTH_CATEGORY_BY_TYPE[v.type];
  const wp = await db.wellnessProvider.findUnique({ where: { userId: session.id } });
  let credentialReset = false;
  if (category) {
    const displayName = (session.name || "").trim().slice(0, 80) || "Professional";
    const providerData = {
      displayName: displayName.length >= 2 ? displayName : "Professional",
      category,
      services: v.meta.specialisations.join(", ").slice(0, 500) || null,
      bio: v.bio.slice(0, 2000) || null,
      city: v.city,
      registrationBody: v.registrationBody,
      registrationNumber: v.registrationNumber,
      isListed: v.listed,
      acceptingRequests: v.acceptingRequests,
    };
    if (wp) {
      credentialReset = providerNeedsRecheck({ type: prevType, ...wp }, { type: v.type, ...providerData });
      await db.wellnessProvider.update({
        where: { id: wp.id },
        data: {
          ...providerData,
          // Changed registration details or profession: back to SUBMITTED for a fresh ops check.
          ...(credentialReset
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
      await db.wellnessProvider.create({ data: { userId: session.id, ...providerData, credentialStatus: "SUBMITTED" } });
    }
  } else if (wp && prevType && isHealthType(prevType)) {
    // Moved from a health profession to a non-health one: stop listing the old health service.
    await db.wellnessProvider.update({ where: { id: wp.id }, data: { isListed: false, acceptingRequests: false } });
  }

  await audit(session.id, session.orgId, "PROS_PROFILE_SAVED", { type: v.type, listed: v.listed, credentialReset });
  revalidatePath(JOIN);
  revalidatePath("/pros");
  back(JOIN);
}

export async function addProsExperience(formData: FormData): Promise<void> {
  const session = await signedIn();
  const parsed = validateExperience(single(formData));
  if (!parsed.ok) back(JOIN, parsed.error);
  const count = await db.professionalExperience.count({ where: { userId: session.id } });
  if (count >= 30) back(JOIN, "You can list up to 30 roles");
  const row = await db.professionalExperience.create({ data: { userId: session.id, ...parsed.value } });
  await audit(session.id, session.orgId, "PROS_EXPERIENCE_ADDED", { experienceId: row.id });
  revalidatePath(JOIN);
  back(JOIN);
}

export async function removeProsExperience(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  if (!validId(id)) back(JOIN, "Not found");
  const { count } = await db.professionalExperience.deleteMany({ where: { id, userId: session.id } });
  if (!count) back(JOIN, "Not found");
  await audit(session.id, session.orgId, "PROS_EXPERIENCE_REMOVED", { experienceId: id });
  revalidatePath(JOIN);
  back(JOIN);
}

export async function addProsCredential(formData: FormData): Promise<void> {
  const session = await signedIn();
  const type = await currentType(session.id);
  if (!type) back(JOIN, "Save your profile first");
  const credType = findCredentialType(type, formData.get("credentialType"));
  if (!credType) back(JOIN, "Choose what this credential is");
  const raw = single(formData);
  const parsed = validateCredential({ ...raw, kind: credType.kind }, safeHttpUrl);
  if (!parsed.ok) back(JOIN, parsed.error);
  if (!parsed.value.evidenceUrl) back(JOIN, "Add a link to the evidence so Triq can check it");
  const count = await db.professionalCredential.count({ where: { userId: session.id } });
  if (count >= 30) back(JOIN, "You can add up to 30 credentials");
  const row = await db.professionalCredential.create({
    data: {
      userId: session.id,
      ...parsed.value,
      title: credentialTitle(credType, parsed.value.title),
      status: "SUBMITTED", // owners can only submit; ops decides
    },
  });
  await audit(session.id, session.orgId, "PROS_CREDENTIAL_SUBMITTED", { credentialId: row.id, credentialType: credType.id });
  revalidatePath(JOIN);
  back(JOIN);
}

export async function removeProsCredential(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  if (!validId(id)) back(JOIN, "Not found");
  const { count } = await db.professionalCredential.deleteMany({ where: { id, userId: session.id } });
  if (!count) back(JOIN, "Not found");
  await audit(session.id, session.orgId, "PROS_CREDENTIAL_REMOVED", { credentialId: id });
  revalidatePath(JOIN);
  back(JOIN);
}

// ---- booking requests (WellnessAppointment) -----------------------------------------------------

export async function requestProsBooking(formData: FormData): Promise<void> {
  const session = await signedIn();
  const profileId = formData.get("profileId");
  if (!validId(profileId)) back("/pros", "Professional not found");
  const path = `/pros/${profileId}`;

  const listing = await loadListing(profileId);
  if (!listing || !listing.acceptsRequests || !listing.providerId) back(path, "This professional is not taking requests");
  if (listing.userId === session.id) back(path, "You cannot book yourself");

  const when = parseIstDateTime(formData.get("scheduledAt"), new Date());
  if (!when.ok) back(path, when.error);
  const reason = validateReason(formData.get("reason"));
  if (!reason.ok) back(path, reason.error);

  const children =
    session.role === "PARENT" ? await db.student.findMany({ where: await myChildrenWhere(session.id), select: { id: true, name: true } }) : [];
  const subject = resolveBookingSubject(
    session.role,
    formData.get("for"),
    children.map((c) => c.id),
  );
  if (!subject.ok) back(path, subject.error);
  const studentId = subject.value.kind === "CHILD" ? subject.value.studentId : null;
  const child = studentId ? children.find((c) => c.id === studentId) ?? null : null;

  const limit = await rateLimitDb(`pros-request:${session.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) back(path, "Too many requests in the last hour. Try again later.");

  const provider = await db.wellnessProvider.findFirst({
    where: { id: listing.providerId, userId: listing.userId, isListed: true, acceptingRequests: true },
    select: { id: true, userId: true, category: true },
  });
  if (!provider) back(path, "This professional is not taking requests");
  const open = await db.wellnessAppointment.count({
    where: { providerId: provider.id, requesterId: session.id, status: { in: ["REQUESTED", "CONFIRMED"] } },
  });
  if (open >= 3) back(path, "You already have 3 open requests with this professional");

  const appt = await db.wellnessAppointment.create({
    data: {
      providerId: provider.id,
      providerUserId: provider.userId,
      requesterId: session.id,
      category: provider.category,
      scheduledAt: when.value,
      note: composeBookingNote(child ? shortName(child.name) : null, reason.value),
      status: "REQUESTED",
    },
  });
  await audit(session.id, session.orgId, "WELLNESS_APPOINTMENT_REQUESTED", {
    appointmentId: appt.id,
    providerId: provider.id,
    forStudentId: child?.id ?? null,
  });
  revalidatePath(DASH);
  back(DASH);
}

/** Provider: CONFIRM | DECLINE | COMPLETE | CANCEL. Requester: CANCEL. Same state machine as Wellness. */
export async function actOnProsBooking(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  const action = String(formData.get("action") || "");
  if (!validId(id)) back(DASH, "Request not found");
  const reason = validateNote(formData.get("reason"), 300);
  if (!reason.ok) back(DASH, reason.error);

  const appt = await db.wellnessAppointment.findFirst({
    where: { id, OR: [{ providerUserId: session.id }, { requesterId: session.id }] },
  });
  if (!appt) back(DASH, "Request not found");
  const actor = appt.providerUserId === session.id ? "PROVIDER" : "REQUESTER";
  const t = transitionAppointment(appt.status, action, actor, { now: new Date(), scheduledAt: appt.scheduledAt });
  if (!t.ok) back(DASH, t.error);

  const stampField = timestampFieldFor(t.to);
  const { count } = await db.wellnessAppointment.updateMany({
    where: { id: appt.id, status: appt.status },
    data: {
      status: t.to,
      ...(stampField ? { [stampField]: new Date() } : {}),
      ...(t.to === "CANCELLED" ? { cancelledById: session.id, cancelReason: reason.value } : {}),
    },
  });
  if (!count) back(DASH, "The request changed meanwhile. Refresh and try again.");
  await audit(session.id, session.orgId, "WELLNESS_APPOINTMENT_STATUS_CHANGED", { appointmentId: appt.id, from: appt.status, to: t.to, actor });
  revalidatePath(DASH);
  back(DASH);
}

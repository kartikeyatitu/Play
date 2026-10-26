"use server";

// V5 TRIQ Careers server actions. Async exports only (see agent brief: "use server" rules).
// Every action re-checks FEATURES.careers; userId always comes from the session, orgId for employer
// actions always comes from the active membership — never from the form.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { safeHttpUrl } from "@/lib/safe-url";
import { rateLimitDb } from "@/lib/rate-limit";
import {
  canTransitionApplication,
  canTransitionJob,
  validateCoverNote,
  validateCredential,
  validateExperience,
  validateJob,
  validateProfile,
} from "@/lib/careers";

const ME = "/careers/me";
const ORG = "/org/careers";

function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function back(path: string, error?: string, extra = ""): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}error=${encodeURIComponent(error)}${extra}` : `${path}${sep}saved=1${extra}`);
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

async function audit(userId: string, orgId: string | null, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
}

async function signedIn() {
  if (!FEATURES.careers) redirect("/");
  return requireAuth();
}

async function employer() {
  if (!FEATURES.careers) redirect("/");
  const auth = await checkPermission("careers.manage");
  if (!auth.ok) back(ORG, auth.error);
  return auth;
}

// ---- professional profile ----------------------------------------------------------------------

export async function saveProfessionalProfile(formData: FormData): Promise<void> {
  const session = await signedIn();
  const parsed = validateProfile(fields(formData));
  if (!parsed.ok) back(ME, parsed.error);
  await db.professionalProfile.upsert({
    where: { userId: session.id },
    create: { userId: session.id, ...parsed.value },
    update: parsed.value,
  });
  await audit(session.id, session.orgId, "PROFESSIONAL_PROFILE_SAVED", { isPublic: parsed.value.isPublic });
  revalidatePath(ME);
  back(ME);
}

export async function addExperience(formData: FormData): Promise<void> {
  const session = await signedIn();
  const parsed = validateExperience(fields(formData));
  if (!parsed.ok) back(ME, parsed.error);
  const count = await db.professionalExperience.count({ where: { userId: session.id } });
  if (count >= 30) back(ME, "You can list up to 30 roles");
  const row = await db.professionalExperience.create({ data: { userId: session.id, ...parsed.value } });
  await audit(session.id, session.orgId, "PROFESSIONAL_EXPERIENCE_ADDED", { experienceId: row.id });
  revalidatePath(ME);
  back(ME);
}

export async function removeExperience(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  if (!validId(id)) back(ME, "Not found");
  const { count } = await db.professionalExperience.deleteMany({ where: { id, userId: session.id } });
  if (count) await audit(session.id, session.orgId, "PROFESSIONAL_EXPERIENCE_REMOVED", { experienceId: id });
  revalidatePath(ME);
  back(ME);
}

export async function addCredential(formData: FormData): Promise<void> {
  const session = await signedIn();
  const parsed = validateCredential(fields(formData), safeHttpUrl);
  if (!parsed.ok) back(ME, parsed.error);
  const count = await db.professionalCredential.count({ where: { userId: session.id } });
  if (count >= 30) back(ME, "You can list up to 30 credentials");
  // Owners can only ever create SUBMITTED credentials (src/lib/credentials.ts).
  const row = await db.professionalCredential.create({ data: { userId: session.id, ...parsed.value, status: "SUBMITTED" } });
  await audit(session.id, session.orgId, "CREDENTIAL_SUBMITTED", { credentialId: row.id, kind: row.kind });
  revalidatePath(ME);
  back(ME);
}

export async function removeCredential(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  if (!validId(id)) back(ME, "Not found");
  const { count } = await db.professionalCredential.deleteMany({ where: { id, userId: session.id } });
  if (count) await audit(session.id, session.orgId, "CREDENTIAL_REMOVED", { credentialId: id });
  revalidatePath(ME);
  back(ME);
}

// ---- applications (professional side) -----------------------------------------------------------

export async function applyToJob(formData: FormData): Promise<void> {
  const session = await signedIn();
  const jobId = formData.get("jobId");
  if (!validId(jobId)) back("/careers", "Job not found");
  const path = `/careers/jobs/${jobId}`;
  const note = validateCoverNote(formData.get("coverNote"));
  if (!note.ok) back(path, note.error);

  const limit = await rateLimitDb(`careers-apply:${session.id}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) back(path, "Too many applications in the last hour. Try again later.");

  const job = await db.jobListing.findFirst({ where: { id: jobId, status: "OPEN" }, select: { id: true, orgId: true } });
  if (!job) back(path, "This job is not accepting applications");
  const existing = await db.jobApplication.findUnique({ where: { jobId_applicantId: { jobId: job.id, applicantId: session.id } } });
  if (existing) back(path, "You have already applied to this job");

  const app = await db.$transaction(async (tx) => {
    const created = await tx.jobApplication.create({
      data: { orgId: job.orgId, jobId: job.id, applicantId: session.id, coverNote: note.value, status: "APPLIED" },
    });
    await tx.jobApplicationEvent.create({
      data: { orgId: job.orgId, applicationId: created.id, fromStatus: null, toStatus: "APPLIED", actorId: session.id },
    });
    return created;
  });
  await audit(session.id, job.orgId, "JOB_APPLIED", { applicationId: app.id, jobId: job.id });
  revalidatePath(path);
  revalidatePath(ME);
  back(path);
}

export async function withdrawApplication(formData: FormData): Promise<void> {
  const session = await signedIn();
  const id = formData.get("id");
  if (!validId(id)) back(ME, "Application not found");
  const app = await db.jobApplication.findFirst({ where: { id, applicantId: session.id } });
  if (!app) back(ME, "Application not found");
  if (!canTransitionApplication(app.status, "WITHDRAWN", "APPLICANT")) back(ME, "This application can no longer be withdrawn");
  const changed = await db.$transaction(async (tx) => {
    const { count } = await tx.jobApplication.updateMany({ where: { id: app.id, status: app.status }, data: { status: "WITHDRAWN" } });
    if (!count) return false;
    await tx.jobApplicationEvent.create({
      data: { orgId: app.orgId, applicationId: app.id, fromStatus: app.status, toStatus: "WITHDRAWN", actorId: session.id },
    });
    return true;
  });
  if (!changed) back(ME, "The application changed meanwhile. Refresh and try again.");
  await audit(session.id, app.orgId, "JOB_APPLICATION_WITHDRAWN", { applicationId: app.id, from: app.status });
  revalidatePath(ME);
  back(ME);
}

// ---- employer side -------------------------------------------------------------------------------

export async function createJob(formData: FormData): Promise<void> {
  const { session } = await employer();
  const parsed = validateJob(fields(formData));
  if (!parsed.ok) back(ORG, parsed.error);
  const org = await db.organization.findUnique({ where: { id: session.orgId }, select: { currency: true } });
  const publish = formData.get("publish") === "1";
  const job = await db.jobListing.create({
    data: {
      ...parsed.value,
      orgId: session.orgId,
      currency: org?.currency || "INR",
      status: publish ? "OPEN" : "DRAFT",
      createdById: session.id,
    },
  });
  await audit(session.id, session.orgId, "JOB_CREATED", { jobId: job.id, status: job.status });
  revalidatePath(ORG);
  revalidatePath("/careers");
  back(ORG);
}

export async function setJobStatus(formData: FormData): Promise<void> {
  const { session } = await employer();
  const id = formData.get("id");
  const to = String(formData.get("status") || "");
  if (!validId(id)) back(ORG, "Job not found");
  const job = await db.jobListing.findFirst({ where: { id, orgId: session.orgId }, select: { id: true, status: true } });
  if (!job) back(ORG, "Job not found");
  if (!canTransitionJob(job.status, to)) back(ORG, "That status change is not allowed");
  const { count } = await db.jobListing.updateMany({ where: { id: job.id, orgId: session.orgId, status: job.status }, data: { status: to } });
  if (!count) back(ORG, "The job changed meanwhile. Refresh and try again.");
  await audit(session.id, session.orgId, "JOB_STATUS_CHANGED", { jobId: job.id, from: job.status, to });
  revalidatePath(ORG);
  revalidatePath("/careers");
  back(ORG);
}

export async function updateApplicationStatus(formData: FormData): Promise<void> {
  const { session } = await employer();
  const id = formData.get("id");
  const to = String(formData.get("status") || "");
  const noteRaw = String(formData.get("note") || "").trim();
  if (!validId(id)) back(ORG, "Application not found");
  if (noteRaw.length > 500) back(ORG, "Note must be 500 characters or fewer");
  const app = await db.jobApplication.findFirst({ where: { id, orgId: session.orgId } });
  if (!app) back(ORG, "Application not found");
  const path = `${ORG}?job=${app.jobId}`;
  if (!canTransitionApplication(app.status, to, "EMPLOYER")) back(path, "That status change is not allowed");
  const changed = await db.$transaction(async (tx) => {
    const { count } = await tx.jobApplication.updateMany({
      where: { id: app.id, orgId: session.orgId, status: app.status },
      data: { status: to },
    });
    if (!count) return false;
    await tx.jobApplicationEvent.create({
      data: { orgId: session.orgId, applicationId: app.id, fromStatus: app.status, toStatus: to, actorId: session.id, note: noteRaw || null },
    });
    return true;
  });
  if (!changed) back(path, "The application changed meanwhile. Refresh and try again.");
  await audit(session.id, session.orgId, "JOB_APPLICATION_STATUS_CHANGED", { applicationId: app.id, from: app.status, to });
  revalidatePath(ORG);
  back(path);
}

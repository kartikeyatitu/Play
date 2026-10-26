"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cleanIndianPhone, parseDob } from "@/lib/import-utils";
import { rateLimitDb } from "@/lib/rate-limit";
import { buildJoinLead, isOpenLeadStatus, JOIN_LIMITS } from "@/lib/join-request";

export type RegisterParentState = { error?: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Public parent self-registration. Records a pending enquiry (Lead, status NEW) that the academy
 * approves by converting it to a student. Returns {error} on failure; redirects to /join/success.
 */
export async function registerParent(
  _prevState: RegisterParentState,
  formData: FormData
): Promise<RegisterParentState> {
  const slug = String(formData.get("academy") ?? "").trim();
  const parentName = String(formData.get("parentName") ?? "").trim();
  const childName = String(formData.get("childName") ?? "").trim();
  const dobRaw = String(formData.get("dob") ?? "").trim();
  const batchId = String(formData.get("batchId") ?? "").trim();
  const phone = cleanIndianPhone(formData.get("parentPhone"));

  // --- Validation ---
  if (!slug) return { error: "Please use the registration link provided by your academy." };
  if (parentName.length < 2 || parentName.length > 80) return { error: "Parent name must be 2-80 characters." };
  if (childName.length < 2 || childName.length > 80) return { error: "Child's name must be 2-80 characters." };
  if (!phone) return { error: "Please enter a valid phone number." };

  let dob: Date | null = null;
  if (dobRaw) {
    dob = parseDob(dobRaw);
    if (!dob) return { error: "Please enter a valid date of birth (age should be between 2 and 70 years)." };
  }

  // --- Rate limit (per phone, per IP and per academy; DB-backed so it holds on serverless) ---
  let ip = "unknown";
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown").split(",")[0].trim() || "unknown";
  } catch {
    // headers() unavailable: fall back to "unknown" bucket
  }
  const HOUR = 60 * 60_000;
  if (
    !(await rateLimitDb(`join:phone:${phone}`, JOIN_LIMITS.perPhonePerHour, HOUR)).allowed ||
    !(await rateLimitDb(`join:ip:${ip}`, JOIN_LIMITS.perIpPerHour, HOUR)).allowed
  ) {
    return { error: "Too many attempts. Please try again later." };
  }

  // NOTE: redirect() throws, so it must stay outside this try/catch.
  try {
    const org = await db.organization.findUnique({ where: { slug }, select: { id: true, isActive: true } });
    if (!org || !org.isActive) return { error: "Academy not found." };
    if (!(await rateLimitDb(`join:org:${org.id}`, JOIN_LIMITS.perAcademyPerDay, 24 * HOUR)).allowed) {
      return { error: "This academy is receiving a lot of registrations right now. Please try again later." };
    }

    // Batch must belong to THIS academy (cross-tenant guard). It is only a preference: the academy
    // decides the batch when it approves the registration.
    let batch: { name: string; sport: string } | null = null;
    if (batchId) {
      batch = await db.batch.findFirst({ where: { id: batchId, orgId: org.id }, select: { name: true, sport: true } });
      if (!batch) return { error: "The selected batch is not available. Please choose another batch." };
    }

    // A public join only records an enquiry for the academy to review. It never creates accounts,
    // students or enrolments, and never says whether the phone number is already registered.
    const lead = buildJoinLead({ orgId: org.id, parentName, parentPhone: phone, childName, dob, batch, now: new Date() });
    const open = await db.lead.findMany({
      where: { orgId: org.id, parentPhone: phone, childName: { equals: lead.childName, mode: "insensitive" } },
      select: { status: true },
      take: 20,
    });
    if (!open.some((l) => isOpenLeadStatus(l.status))) {
      await db.lead.create({ data: lead });
    }
  } catch (err: any) {
    console.error("registerParent failed:", err);
    return { error: GENERIC_ERROR };
  }

  redirect(`/join/success?academy=${encodeURIComponent(slug)}`);
}

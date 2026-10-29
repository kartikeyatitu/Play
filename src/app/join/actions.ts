"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cleanIndianPhone, parseDob } from "@/lib/import-utils";
import { rateLimit } from "@/lib/rate-limit";

export type RegisterParentState = { error?: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Public parent self-registration. Returns {error} on failure; redirects to /join/success on success. */
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

  // --- Rate limit (per phone and per IP-ish key) ---
  let ip = "unknown";
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown").split(",")[0].trim() || "unknown";
  } catch {
    // headers() unavailable: fall back to "unknown" bucket
  }
  const HOUR = 60 * 60_000;
  if (!rateLimit(`join:phone:${phone}`, 5, HOUR).allowed || !rateLimit(`join:ip:${ip}`, 20, HOUR).allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  // NOTE: redirect() throws, so it must stay outside this try/catch.
  // A public sign-up never creates a student, parent account or batch enrolment. It creates a NEW lead
  // (Lead.status is the existing approval state) that the academy reviews and converts with
  // convertLeadToStudent (leads.manage), which is where the enrolment is approved.
  try {
    const org = await db.organization.findUnique({ where: { slug } });
    if (!org || !org.isActive) return { error: "Academy not found." };

    // Batch must belong to THIS academy (cross-tenant guard). Stored as a note, not as an enrolment.
    let batchName: string | null = null;
    if (batchId) {
      const batch = await db.batch.findFirst({ where: { id: batchId, orgId: org.id }, select: { name: true } });
      if (!batch) return { error: "The selected batch is not available. Please choose another batch." };
      batchName = batch.name;
    }

    // Don't stack duplicate pending sign-ups for the same child and phone.
    const pending = await db.lead.findFirst({
      where: { orgId: org.id, parentPhone: phone, status: "NEW", childName: { equals: childName, mode: "insensitive" } },
      select: { id: true },
    });
    if (!pending) {
      const childAge = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60_000)) : null;
      const notes = [
        "Public registration form (pending academy approval)",
        batchName ? `Preferred batch: ${batchName}` : null,
        dob ? `Date of birth: ${dob.toISOString().slice(0, 10)}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      await db.lead.create({
        data: {
          orgId: org.id,
          parentName,
          parentPhone: phone,
          childName,
          childAge: childAge !== null && childAge >= 0 && childAge < 100 ? childAge : null,
          source: "WEBSITE",
          status: "NEW",
          notes,
        },
      });
    }
  } catch (err: any) {
    console.error("registerParent failed:", err);
    return { error: GENERIC_ERROR };
  }

  redirect(`/join/success?academy=${encodeURIComponent(slug)}`);
}

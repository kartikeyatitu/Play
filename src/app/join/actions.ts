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
  if (!phone) return { error: "Please enter a valid 10-digit Indian mobile number." };

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
  try {
    const org = await db.organization.findUnique({ where: { slug } });
    if (!org || !org.isActive) return { error: "Academy not found." };

    // Batch must belong to THIS academy (cross-tenant guard)
    let batch: { id: string; name: string; capacity: number | null } | null = null;
    if (batchId) {
      batch = await db.batch.findFirst({
        where: { id: batchId, orgId: org.id },
        select: { id: true, name: true, capacity: true },
      });
      if (!batch) return { error: "The selected batch is not available. Please choose another batch." };

      if (batch.capacity) {
        const enrolled = await db.batchEnrollment.count({ where: { batchId: batch.id } });
        if (enrolled >= batch.capacity) {
          return {
            error: `${batch.name} is currently full. Please choose another batch, or ask the academy to add you to the waitlist.`,
          };
        }
      }
    }

    // Phone may be stored with or without country code
    const phoneVariants = [phone, `+91${phone}`, `91${phone}`, `+91 ${phone}`];
    const existingUser = await db.user.findFirst({ where: { phone: { in: phoneVariants } } });
    if (existingUser) {
      if (existingUser.orgId !== org.id) {
        return {
          error:
            "This phone number is already registered with a different academy. Please use another number or contact your academy.",
        };
      }
      if (existingUser.role !== "PARENT") {
        return { error: "This phone number belongs to a staff account. Please use a parent's phone number." };
      }
      // Duplicate child under same parent (case-insensitive)
      const dup = await db.student.findFirst({
        where: {
          parentId: existingUser.id,
          orgId: org.id,
          name: { equals: childName, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (dup) return { error: `${childName} is already registered with this phone number.` };
    }

    await db.$transaction(async (tx) => {
      const parent =
        existingUser ??
        (await tx.user.create({
          data: { name: parentName, phone, role: "PARENT", orgId: org.id },
        }));

      const student = await tx.student.create({
        data: { name: childName, parentId: parent.id, dob, orgId: org.id },
      });

      if (batch) {
        await tx.batchEnrollment.create({ data: { studentId: student.id, batchId: batch.id } });
      }
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { error: "This phone number is already registered. Please contact your academy." };
    }
    console.error("registerParent failed:", err);
    return { error: GENERIC_ERROR };
  }

  redirect(`/join/success?academy=${encodeURIComponent(slug)}`);
}

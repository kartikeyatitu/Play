"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { rateLimit } from "@/lib/rate-limit"

// PUBLIC (unauthenticated) actions used by the /trial?academy=<slug> page.
// They must never require auth, but must only expose/write data for the resolved org.

export async function getBatches(orgId?: string) {
  if (!orgId) return [];
  return db.batch.findMany({
    where: { orgId },
    // Only expose what the public trial form needs (no coach ids, fees, etc.)
    select: {
      id: true,
      name: true,
      sport: true,
      schedule: true,
      _count: {
        select: { enrollments: true }
      }
    }
  });
}

export async function getOrgBySlug(slug: string) {
  if (!slug) return null;
  // Public: only return non-sensitive fields (no UPI id, phone, plan, etc.)
  return db.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, sport: true, city: true, logo: true },
  });
}

export async function bookTrial(
  parentName: string,
  parentPhone: string,
  childName: string,
  childAge: number,
  batchId: string,
  dateStr: string
) {
  // The org is resolved from the batch — never from client input.
  const batch = await db.batch.findUnique({ where: { id: batchId } });
  if (!batch || !batch.orgId) {
    throw new Error("Batch not found");
  }

  // Public write into an academy's CRM: validate and rate-limit (per phone and per IP)
  parentName = String(parentName ?? "").trim().slice(0, 80);
  childName = String(childName ?? "").trim().slice(0, 80);
  parentPhone = String(parentPhone ?? "").replace(/[^\d+]/g, "").slice(0, 15);
  const date = new Date(dateStr);
  if (parentName.length < 2 || childName.length < 2 || parentPhone.replace(/\D/g, "").length < 10) {
    throw new Error("Please fill in your name, child's name and a valid phone number");
  }
  if (!Number.isInteger(childAge) || childAge < 2 || childAge > 25 || Number.isNaN(date.getTime())) {
    throw new Error("Please enter a valid age and date");
  }
  let ip = "unknown";
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown").split(",")[0].trim() || "unknown";
  } catch {
    // headers() unavailable: shared bucket
  }
  if (!rateLimit(`trial:phone:${parentPhone}`, 5, 60 * 60_000).allowed || !rateLimit(`trial:ip:${ip}`, 20, 60 * 60_000).allowed) {
    throw new Error("Too many requests. Please try again later.");
  }

  await db.trialBooking.create({
    data: {
      parentName,
      parentPhone,
      childName,
      childAge,
      batchId: batch.id,
      date,
    }
  });

  await db.lead.create({
    data: {
      parentName,
      parentPhone,
      childName,
      childAge,
      sport: batch.sport,
      source: "WEBSITE",
      status: "TRIAL_BOOKED",
      orgId: batch.orgId,
    }
  });

  revalidatePath("/trial");
  revalidatePath("/org");
}

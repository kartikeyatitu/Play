"use server";

// PUBLIC (unauthenticated) server actions for the academy directory.
// - requestTrial: parent free-trial enquiry for a ListedAcademy (unclaimed / pending).
//   Triq academies (Organizations) use the existing /trial?academy=<slug> booking flow instead.
// - claimListing: an owner claims a listing → ClaimRequest + SalesLead (source "directory_claim").
// Hardening: zod validation, phone check, honeypot, rate-limits by phone and IP.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimitDb } from "@/lib/rate-limit";
import { cleanIndianPhone, listingPath, parseSports } from "@/lib/directory";

export type DirectoryActionState = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<string, string>>;
  /** Increments on every response so clients can react to repeated identical results. */
  nonce?: number;
} | null;

const WINDOW_MS = 10 * 60_000;

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown";
  return h.get("x-real-ip")?.trim() || "unknown";
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

const phoneField = z
  .string()
  .transform((v) => cleanIndianPhone(v))
  .refine((v) => v !== null && v.length >= 7 && v.length <= 15, "Enter a valid phone number");

const idField = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);

function fieldErrors(issues: z.ZodError["issues"]): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

function fail(message: string, errors?: Partial<Record<string, string>>): DirectoryActionState {
  return { ok: false, message, errors, nonce: Date.now() };
}

function success(message: string): DirectoryActionState {
  return { ok: true, message, nonce: Date.now() };
}

// ---------------------------------------------------------------------------
// Free-trial enquiry
// ---------------------------------------------------------------------------

const trialSchema = z.object({
  listedAcademyId: idField,
  parentName: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
  phone: phoneField,
  childName: z.string().trim().max(80, "Name is too long").optional(),
  childAge: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d{1,2}$/.test(v) && Number(v) >= 3 && Number(v) <= 25), "Age should be between 3 and 25"),
  sport: z.string().trim().max(40).optional(),
  message: z.string().trim().max(500, "Keep the message under 500 characters").optional(),
});

export async function requestTrial(_prev: DirectoryActionState, formData: FormData): Promise<DirectoryActionState> {
  // Honeypot: bots fill every field. Pretend success, store nothing.
  if (str(formData, "company_website")) {
    return success("Request sent! We'll WhatsApp you shortly.");
  }

  const parsed = trialSchema.safeParse({
    listedAcademyId: str(formData, "listedAcademyId"),
    parentName: str(formData, "parentName"),
    phone: str(formData, "phone"),
    childName: str(formData, "childName") || undefined,
    childAge: str(formData, "childAge") || undefined,
    sport: str(formData, "sport") || undefined,
    message: str(formData, "message") || undefined,
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error.issues));
  const data = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimitDb(`dir-trial:ip:${ip}`, 10, WINDOW_MS)).allowed || !(await rateLimitDb(`dir-trial:phone:${data.phone}`, 3, WINDOW_MS)).allowed) {
    return fail("Too many requests. Please try again in a few minutes.");
  }

  const listing = await db.listedAcademy.findUnique({
    where: { id: data.listedAcademyId },
    select: { id: true, slug: true, name: true, city: true, sports: true, claimedOrgId: true },
  });
  if (!listing) return fail("This academy is no longer listed.");

  const listingSports = parseSports(listing.sports);
  const sport = data.sport && listingSports.includes(data.sport) ? data.sport : listingSports[0] ?? null;
  const childAge = data.childAge ? Number(data.childAge) : null;

  // De-dupe: same phone + same academy within 24h → treat as already received.
  const recent = await db.directoryLead.findFirst({
    where: { listedAcademyId: listing.id, phone: data.phone, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    select: { id: true },
  });
  if (recent) {
    return success(`We already have your request for ${listing.name}. We'll WhatsApp you shortly.`);
  }

  // If the listing has been claimed by a live Triq academy, route it to that academy too.
  let orgId: string | null = null;
  if (listing.claimedOrgId) {
    const org = await db.organization.findFirst({
      where: { id: listing.claimedOrgId, isActive: true },
      select: { id: true },
    });
    orgId = org?.id ?? null;
  }

  await db.directoryLead.create({
    data: {
      listedAcademyId: listing.id,
      orgId,
      parentName: data.parentName,
      phone: data.phone,
      childName: data.childName || null,
      childAge,
      sport,
      message: data.message || null,
    },
  });

  if (orgId) {
    // Surface it in the academy's own leads CRM (existing Lead model).
    await db.lead
      .create({
        data: {
          parentName: data.parentName,
          parentPhone: data.phone,
          childName: data.childName || "(not provided)",
          childAge,
          sport,
          source: "WEBSITE",
          status: "NEW",
          notes: data.message ? `Triq directory: ${data.message}` : "Triq directory enquiry",
          orgId,
        },
      })
      .catch((e) => console.error("[directory] org lead mirror failed", e));
  }

  return success(`Request sent to ${listing.name}! We'll WhatsApp you on +91 ${data.phone} to fix a trial slot.`);
}

// ---------------------------------------------------------------------------
// Claim a listing
// ---------------------------------------------------------------------------

const claimSchema = z.object({
  listedAcademyId: idField,
  name: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
  phone: phoneField,
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  role: z.enum(["OWNER", "COACH", "MANAGER"]).default("OWNER"),
});

export async function claimListing(_prev: DirectoryActionState, formData: FormData): Promise<DirectoryActionState> {
  if (str(formData, "company_website")) {
    return success("Thanks! Our team will call you to verify ownership.");
  }

  const parsed = claimSchema.safeParse({
    listedAcademyId: str(formData, "listedAcademyId"),
    name: str(formData, "name"),
    phone: str(formData, "phone"),
    email: str(formData, "email") || undefined,
    role: str(formData, "role") || undefined,
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrors(parsed.error.issues));
  const data = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimitDb(`dir-claim:ip:${ip}`, 5, WINDOW_MS)).allowed || !(await rateLimitDb(`dir-claim:phone:${data.phone}`, 3, WINDOW_MS)).allowed) {
    return fail("Too many requests. Please try again in a few minutes.");
  }

  const listing = await db.listedAcademy.findUnique({
    where: { id: data.listedAcademyId },
    select: { id: true, slug: true, name: true, city: true, sports: true, claimStatus: true },
  });
  if (!listing) return fail("This academy is no longer listed.");
  if (listing.claimStatus === "CLAIMED") {
    return fail("This listing has already been claimed. If you're the owner, please contact Triq support.");
  }

  const existing = await db.claimRequest.findFirst({
    where: { listedAcademyId: listing.id, phone: data.phone, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return success("We already have your claim. Our team will call you to verify ownership.");
  }

  const sports = parseSports(listing.sports);
  await db.$transaction([
    db.claimRequest.create({
      data: {
        listedAcademyId: listing.id,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        role: data.role,
      },
    }),
    db.salesLead.create({
      data: {
        name: data.name,
        phone: data.phone,
        academy: listing.name,
        city: listing.city,
        sport: sports[0] ?? null,
        source: "directory_claim",
        notes: `Claim for /academies listing "${listing.slug}" (role: ${data.role}${data.email ? `, email: ${data.email}` : ""})`,
      },
    }),
    // Only flip UNCLAIMED → PENDING; never downgrade CLAIMED.
    db.listedAcademy.updateMany({
      where: { id: listing.id, claimStatus: "UNCLAIMED" },
      data: { claimStatus: "PENDING" },
    }),
  ]);

  revalidatePath(listingPath(listing.city, sports, listing.slug));

  return success("Claim received! Our team will call you within 1 working day to verify ownership.");
}

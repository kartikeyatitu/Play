"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const BUSINESS_TYPES = ["ACADEMY", "TURF", "BOTH"] as const;
/** @deprecated Kept only for RESERVED_SLUGS and backward compat. City is now free-text. */
const ONBOARDING_CITIES_LEGACY = ["Gurgaon", "Noida", "Delhi", "Faridabad", "Ghaziabad", "Other"] as const;
const ONBOARDING_SPORTS = [
  "Football", "Cricket", "Badminton", "Tennis", "Basketball", "Swimming", "Martial Arts", "Athletics", "Other",
] as const;

const CITY_STATE: Record<string, string> = {
  Gurgaon: "Haryana",
  Faridabad: "Haryana",
  Noida: "Uttar Pradesh",
  Ghaziabad: "Uttar Pradesh",
  Delhi: "Delhi",
};

// Slugs that must never be handed to a new tenant (routes, the demo org, internal names).
const RESERVED_SLUGS = new Set([
  "triq-demo", "demo", "admin", "api", "org", "login", "register", "onboarding", "parent", "coach",
  "academy", "academies", "book", "gurgaon", "noida", "pricing", "contact", "ops", "triq",
]);

const onboardingSchema = z
  .object({
    academyName: z.string().trim().min(2, "Please enter a name (at least 2 characters).").max(80, "Name is too long (max 80 characters)."),
    businessType: z.enum(BUSINESS_TYPES, { message: "Please choose what you run." }),
    city: z.string().trim().min(1, "Please enter your city.").max(60, "City name is too long."),
    sports: z.array(z.enum(ONBOARDING_SPORTS)).min(1, "Pick at least one sport.").max(9),
    loadSampleData: z.boolean().optional(),
  })
  ;

export type OnboardingInput = z.input<typeof onboardingSchema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)
    .replace(/-$/g, "");
}

/** Always returns a free, non-reserved slug. Final uniqueness is still enforced by the DB unique index. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "academy";
  const suffix = () => Math.random().toString(36).slice(2, 6);
  let candidate = RESERVED_SLUGS.has(base) ? `${base}-${suffix()}` : base;
  for (let i = 0; i < 6; i++) {
    const taken = await db.organization.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = `${base}-${suffix()}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createAcademyWorkspace(input: OnboardingInput) {
  const session = await getSession();
  if (!session || !session.id) {
    return { success: false, error: "Please sign in to set up your academy." };
  }

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const { academyName, businessType, city, sports, loadSampleData = false } = parsed.data;
  const state = "";
  const sport = sports.join(", ");
  const primarySport = sports[0];

  try {
    // 0. Never trust the cookie's role: check the live user. Only a brand-new owner account
    //    (ADMIN, not yet attached to an academy) may create a workspace. Otherwise any logged-in
    //    parent/coach could promote themselves to ADMIN, or an owner could orphan their academy.
    const me = await db.user.findUnique({ where: { id: session.id }, select: { role: true, orgId: true } });
    if (!me) return { success: false, error: "Account not found. Please sign in again." };
    if (me.orgId) return { success: false, error: "Your account already belongs to an academy." };
    if (me.role !== "ADMIN") return { success: false, error: "Only an academy owner account can create an academy." };

    // 1 + 2 + 3. Create the Organization and make the user its Admin in one transaction, so a failure
    //            can't leave an orphan academy or a half-linked user. A slug race (P2002) retries once
    //            with a fresh slug.
    let org: Awaited<ReturnType<typeof db.organization.create>> | null = null;
    for (let attempt = 0; attempt < 2 && !org; attempt++) {
      const slug = await uniqueSlug(academyName);
      try {
        org = await db.$transaction(async (tx) => {
          const created = await tx.organization.create({
            data: {
              name: academyName,
              slug,
              sport,
              city,
              state,
              businessType,
              // Plan vocabulary reconciliation (plan audit §4.H):
              // canonical PlanId is lowercase "free" / "growth" / "academy". Trial state
              // lives on planExpiry (14 days from signup), not on the plan string.
              plan: "free",
              planExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
              isActive: true,
            },
          });
          // updateMany + orgId:null makes this a compare-and-set: a concurrent double-submit can't win twice.
          const linked = await tx.user.updateMany({
            where: { id: session.id, orgId: null, role: "ADMIN" },
            data: { orgId: created.id },
          });
          if (linked.count !== 1) throw new Error("Your account already belongs to an academy.");
          return created;
        });
      } catch (e: any) {
        if (e?.code === "P2002" && attempt === 0) continue; // slug taken in the meantime
        throw e;
      }
    }
    if (!org) return { success: false, error: "Could not create your workspace. Please try again." };

    // 4. Optionally seed isolated sample data for testing (best effort: the academy already exists)
    if (loadSampleData) {
      try {
        await seedSampleTenantData(org.id, session.id, primarySport, academyName);
      } catch (seedError) {
        console.error("Sample data failed (academy was still created):", seedError);
      }
    }

    revalidatePath("/org");
    // Academy owners (and both) land on the dashboard; turf-only owners go straight to bookings.
    const redirect = businessType === "TURF" ? "/org?tab=bookings" : "/org";
    return { success: true, redirect };
  } catch (error: any) {
    console.error("Failed to create academy workspace:", error);
    return { success: false, error: error.message || "Failed to create academy workspace." };
  }
}


/** Non-working sample phone (90001xxxxx; the 9000000xxx range is reserved for the demo academy) that is guaranteed not to collide with an existing user. */
async function safeSamplePhone(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const phone = `90001${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
    const taken = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (!taken) return phone;
  }
  throw new Error("Could not allocate a sample phone number.");
}

async function seedSampleTenantData(orgId: string, adminUserId: string, sport: string, academyName: string) {
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);

  // 1. Sample Coach
  const sampleCoach = await db.user.create({
    data: {
      name: "Coach Vikram Rathore",
      phone: await safeSamplePhone(),

      email: `vikram.${orgId.slice(-4)}@triqacademy.com`,
      role: "COACH",
      verified: true,
      orgId,
    },
  });

  // 2. Sample Batches
  const batch1 = await db.batch.create({
    data: {
      orgId,
      name: `Junior ${sport} Stars (U-12)`,
      sport,
      schedule: "Mon/Wed/Fri 4:00-5:30 PM",
      coachId: sampleCoach.id,
    },
  });

  const batch2 = await db.batch.create({
    data: {
      orgId,
      name: `Senior Development Squad`,
      sport,
      schedule: "Tue/Thu/Sat 5:30-7:00 PM",
      coachId: sampleCoach.id,
    },
  });

  // 3. Sample Fee Plans
  const feePlan1 = await db.feePlan.create({
    data: {
      orgId,
      name: "Monthly Regular Pass",
      amount: 2500,
      duration: 1,
      sport,
      isActive: true,
    },
  });

  await db.feePlan.create({
    data: {
      orgId,
      name: "Quarterly Excellence Pass",
      amount: 6500,
      duration: 3,
      sport,
      isActive: true,
    },
  });

  // 4. Sample Students & Parents (8 students)
  const studentNames = [
    { student: "Aarav Sharma", parent: "Rajesh Sharma", age: 11, batchId: batch1.id },
    { student: "Vivaan Gupta", parent: "Sunita Gupta", age: 10, batchId: batch1.id },
    { student: "Aditya Mehta", parent: "Kunal Mehta", age: 12, batchId: batch1.id },
    { student: "Diya Patel", parent: "Amit Patel", age: 9, batchId: batch1.id },
    { student: "Rohan Verma", parent: "Pooja Verma", age: 14, batchId: batch2.id },
    { student: "Ananya Iyer", parent: "Suresh Iyer", age: 15, batchId: batch2.id },
    { student: "Kabir Malhotra", parent: "Renu Malhotra", age: 13, batchId: batch2.id },
    { student: "Ishaan Singh", parent: "Harpreet Singh", age: 14, batchId: batch2.id },
  ];

  for (let i = 0; i < studentNames.length; i++) {
    const item = studentNames[i];
    const parentPhone = await safeSamplePhone();
    
    const parent = await db.user.create({
      data: {
        name: item.parent,
        phone: parentPhone,
        role: "PARENT",
        orgId,
      },
    });

    const birthYear = today.getFullYear() - item.age;
    const student = await db.student.create({
      data: {
        name: item.student,
        parentId: parent.id,
        dob: new Date(`${birthYear}-05-15`),
        orgId,
      },
    });

    await db.batchEnrollment.create({
      data: {
        studentId: student.id,
        batchId: item.batchId,
      },
    });

    // Fee record: Half Paid, Half Pending
    const isPaid = i % 2 === 0;
    await db.feeRecord.create({
      data: {
        orgId,
        studentId: student.id,
        month: currentMonth,
        amount: feePlan1.amount,
        status: isPaid ? "PAID" : "PENDING",
        paidAt: isPaid ? today : null,
      },
    });
  }

  // 5. Sample Facility & Equipment
  await db.facility.create({
    data: {
      orgId,
      name: `${sport} Training Turf 1`,
      type: "COURT",
    },
  });

  await db.equipment.create({
    data: {
      orgId,
      name: `Professional ${sport} Kit & Cones`,
      quantity: 15,
      assignedToId: sampleCoach.id,
    },
  });
}

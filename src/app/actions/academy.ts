"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth";
import { isOrgOwner } from "@/lib/membership";

export async function updateAcademy(orgId: string, formData: FormData) {
    const session = await requireAuth(['ADMIN']);
  const name = formData.get("name") as string;
  const sport = formData.get("sport") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const address = formData.get("address") as string;
  const pincode = formData.get("pincode") as string;
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string;
  const logo = formData.get("logo") as string;

  if (!orgId) throw new Error("orgId is required");
  if (!session.orgId || session.orgId !== orgId) throw new Error("Unauthorized organization access");
  if (!(await isOrgOwner(session.id, session.orgId))) throw new Error("Only the academy owner can change academy settings");
  if (!name || !city || !state) throw new Error("Required fields missing");

  await db.organization.update({
    where: { id: orgId },
    data: {
      name,
      sport: sport || null,
      city,
      state,
      address: address || null,
      pincode: pincode || null,
      phone: phone || null,
      email: email || null,
      logo: logo || null,
    }
  });

  revalidatePath("/org");
}

/** ADMIN only: update UPI ID, default monthly fee and coach per-session rate for the admin's own academy. */
export async function updateAcademyPayments(formData: FormData) {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
  if (!(await isOrgOwner(session.id, session.orgId))) return { success: false, error: "Only the academy owner can change this." };

  const upiRaw = String(formData.get("upiId") ?? "").trim();
  if (upiRaw && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(upiRaw)) {
    return { success: false, error: "That doesn't look like a valid UPI ID (e.g. academy@okicici)." };
  }

  const toInt = (key: string): number | null | "invalid" => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : "invalid";
  };
  const defaultMonthlyFee = toInt("defaultMonthlyFee");
  const coachSessionRate = toInt("coachSessionRate");
  if (defaultMonthlyFee === "invalid" || coachSessionRate === "invalid") {
    return { success: false, error: "Fees and rates must be whole numbers (₹)." };
  }

  await db.organization.update({
    where: { id: session.orgId },
    data: { upiId: upiRaw || null, defaultMonthlyFee, coachSessionRate },
  });
  revalidatePath("/org");
  revalidatePath("/parent");
  return { success: true };
}

/**
 * ADMIN only: update the academy's country / currency / timezone / locale / phone country.
 * The fields have DB defaults (India) so they're always set; this lets international
 * academies change them.
 */
export async function updateAcademyLocale(formData: FormData) {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };
  if (!(await isOrgOwner(session.id, session.orgId))) {
    return { success: false, error: "Only the academy owner can change this." };
  }

  const str = (key: string, max: number) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 && v.length <= max ? v : null;
  };

  const country = str("country", 2);
  const currency = str("currency", 3);
  const timezone = str("timezone", 64);
  const locale = str("locale", 32);
  const phoneCountry = str("phoneCountry", 4);

  if (!country || !currency || !timezone || !locale || !phoneCountry) {
    return { success: false, error: "All locale fields are required." };
  }

  await db.organization.update({
    where: { id: session.orgId },
    data: { country, currency, timezone, locale, phoneCountry },
  });

  revalidatePath("/org");
  revalidatePath("/parent");
  revalidatePath("/academies");
  return { success: true };
}

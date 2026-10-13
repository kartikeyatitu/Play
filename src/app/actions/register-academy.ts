"use server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { cleanIndianPhone } from "@/lib/import-utils";
import { rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function registerAcademy(formData: {
  academyName: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  city: string;
  state: string;
  sport: string;
  address?: string;
}): Promise<{ success: true; orgSlug: string } | { success: false; error: string }> {
  try {
    // --- Validation ---
    const academyName = String(formData?.academyName ?? "").trim();
    const ownerName = String(formData?.ownerName ?? "").trim();
    const email = String(formData?.email ?? "").trim().toLowerCase();
    const password = String(formData?.password ?? "");
    const city = String(formData?.city ?? "").trim();
    const state = String(formData?.state ?? "").trim();
    const sport = String(formData?.sport ?? "").trim();
    const address = String(formData?.address ?? "").trim().slice(0, 300);
    const phone = cleanIndianPhone(formData?.phone);

    if (academyName.length < 2 || academyName.length > 80) {
      return { success: false, error: "Academy name must be 2-80 characters." };
    }
    if (ownerName.length < 2 || ownerName.length > 80) {
      return { success: false, error: "Owner name must be 2-80 characters." };
    }
    if (!EMAIL_RE.test(email) || email.length > 120) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (!phone) {
      return { success: false, error: "Please enter a valid 10-digit Indian mobile number." };
    }
    if (password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }
    if (password.length > 100) {
      return { success: false, error: "Password is too long (max 100 characters)." };
    }
    if (!city) return { success: false, error: "City is required." };
    if (!state) return { success: false, error: "State is required." };
    if (!sport) return { success: false, error: "Primary sport is required." };

    // --- Rate limit: 5 per hour per email and per phone ---
    const HOUR = 60 * 60_000;
    const byEmail = rateLimit(`register:email:${email}`, 5, HOUR);
    const byPhone = rateLimit(`register:phone:${phone}`, 5, HOUR);
    if (!byEmail.allowed || !byPhone.allowed) {
      return { success: false, error: "Too many registration attempts. Please try again later." };
    }

    // --- Duplicate checks (phone may be stored with or without country code) ---
    const phoneVariants = [phone, `+91${phone}`, `91${phone}`, `+91 ${phone}`];
    const existingPhone = await db.user.findFirst({ where: { phone: { in: phoneVariants } }, select: { id: true } });
    if (existingPhone) return { success: false, error: "Phone number already registered. Please login instead." };
    const existingEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingEmail) return { success: false, error: "Email already registered. Please login instead." };

    // Create slug from academy name
    const slug = academyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50) || "academy";

    // Check slug uniqueness
    const slugExists = await db.organization.findUnique({ where: { slug } });
    const finalSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create organization + admin user atomically
    const { org, admin } = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: academyName,
          slug: finalSlug,
          sport,
          city,
          state,
          phone,
          email,
          address,
          plan: "FREE_TRIAL",
          planExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      });
      const admin = await tx.user.create({
        data: {
          name: ownerName,
          phone,
          email,
          password: hashedPassword,
          role: "ADMIN",
          orgId: org.id,
        },
      });
      return { org, admin };
    });

    // Set session cookie
    const cookieStore = await cookies();
    const { createSignedCookie, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } = await import("@/lib/auth");
    const cookieValue = createSignedCookie({
      id: admin.id,
      name: admin.name,
      role: "ADMIN",
      orgId: org.id,
      orgName: org.name,
    });
    cookieStore.set(SESSION_COOKIE_NAME, cookieValue, SESSION_COOKIE_OPTIONS); // 30 days, httpOnly

    return { success: true, orgSlug: finalSlug };
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { success: false, error: "Phone number or email already registered. Please login instead." };
    }
    console.error("registerAcademy failed:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

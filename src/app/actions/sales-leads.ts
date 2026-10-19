"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

type LeadField = "name" | "phone" | "academy" | "sport" | "students" | "city";
const LEAD_FIELDS: readonly LeadField[] = ["name", "phone", "academy", "sport", "students", "city"];

export type DemoFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<LeadField, string>>;
  /** Echo of submitted values so the form can repopulate after React 19 resets it. */
  values?: Partial<Record<LeadField, string>>;
};

/** Normalise Indian mobile numbers: "+91 98765-43210", "098765 43210", "9876543210" -> "9876543210". */
function normaliseIndianPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
    z.string().max(max, `Keep it under ${max} characters`).optional(),
  );

const leadSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80, "Name is too long"),
  phone: z
    .string()
    .trim()
    .transform(normaliseIndianPhone)
    .refine((p) => /^[6-9]\d{9}$/.test(p), "Enter a valid 10-digit Indian mobile number"),
  academy: optionalText(120),
  sport: optionalText(40),
  students: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number("Enter a number")
      .int("Enter a whole number")
      .min(1, "Enter at least 1")
      .max(20000, "That looks too high")
      .optional(),
  ),
  city: optionalText(60),
  utm: optionalText(600),
});

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "page"] as const;

/** Keep only known UTM keys with short string values, so we never store arbitrary blobs. */
function sanitiseUtm(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clean: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && value.length > 0) clean[key] = value.slice(0, 100);
    }
    return Object.keys(clean).length ? JSON.stringify(clean) : null;
  } catch {
    return null;
  }
}

export async function submitDemoRequest(_prev: DemoFormState, formData: FormData): Promise<DemoFormState> {
  // Honeypot: real users never see or fill this field. Pretend success so bots learn nothing.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { status: "success", message: "Thanks! We'll be in touch shortly." };
  }

  let ip = "unknown";
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  } catch {
    // headers() unavailable — fall back to a shared bucket
  }

  const { allowed } = rateLimit(`sales-lead:${ip}`, 5, 10 * 60_000);
  if (!allowed) {
    return { status: "error", message: "Too many requests. Please try again in a few minutes or message us on WhatsApp." };
  }

  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v.slice(0, 600) : "";
  };
  const values = {
    name: str("name"),
    phone: str("phone"),
    academy: str("academy"),
    sport: str("sport"),
    students: str("students"),
    city: str("city"),
  };

  const parsed = leadSchema.safeParse({ ...values, utm: str("utm") });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<LeadField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const field = LEAD_FIELDS.find((f) => f === key);
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const data = parsed.data;

  // Per-phone limit too, so one number can't be spammed from rotating IPs.
  if (!rateLimit(`sales-lead-phone:${data.phone}`, 3, 60 * 60_000).allowed) {
    return { status: "success", message: "We already have your request — we'll WhatsApp you shortly." };
  }

  try {
    await db.salesLead.create({
      data: {
        name: data.name,
        phone: `+91${data.phone}`,
        academy: data.academy ?? null,
        sport: data.sport ?? null,
        students: data.students ?? null,
        city: data.city ?? null,
        source: "landing",
        utm: sanitiseUtm(data.utm),
      },
    });
  } catch (error) {
    console.error("[sales-leads] Failed to save lead", error);
    return { status: "error", message: "Something went wrong on our side. Please try again or message us on WhatsApp.", values };
  }

  return {
    status: "success",
    message: `Thanks ${data.name.split(" ")[0]}! We'll WhatsApp you within one working day to pick a 15-minute slot.`,
  };
}

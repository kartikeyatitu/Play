// TRIQ Connect onboarding input validation. Pure and client-safe.

import { parseList } from "@/lib/careers";
import { MAX_USER_BIO, type ProMeta } from "./meta";
import {
  HEALTH_CATEGORY_BY_TYPE,
  isDeliveryMode,
  isLanguage,
  isProType,
  isSpecialisationFor,
  type DeliveryMode,
  type ProType,
} from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type RawForm = Record<string, string | string[] | undefined>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : Array.isArray(v) && typeof v[0] === "string" ? v[0].trim() : "");
const many = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);
const on = (v: unknown) => {
  const s = str(v);
  return s === "on" || s === "true" || s === "1";
};

export interface OnboardingInput {
  type: ProType;
  headline: string | null;
  bio: string;
  sports: string[];
  city: string | null;
  yearsExperience: number | null;
  meta: ProMeta;
  listed: boolean;
  acceptingRequests: boolean;
  registrationBody: string | null;
  registrationNumber: string | null;
}

export function validateOnboarding(raw: RawForm): Result<OnboardingInput> {
  const type = str(raw.type);
  if (!isProType(type)) return { ok: false, error: "Choose your profession" };
  const headline = str(raw.headline);
  if (headline.length > 120) return { ok: false, error: "Headline must be 120 characters or fewer" };
  const bio = str(raw.bio);
  if (bio.length > MAX_USER_BIO) return { ok: false, error: `About must be ${MAX_USER_BIO} characters or fewer` };
  const city = str(raw.city);
  if (city.length > 80) return { ok: false, error: "City must be 80 characters or fewer" };
  const yrs = str(raw.yearsExperience);
  let yearsExperience: number | null = null;
  if (yrs) {
    if (!/^\d{1,2}$/.test(yrs) || Number(yrs) > 60) return { ok: false, error: "Years of experience must be 0–60" };
    yearsExperience = Number(yrs);
  }
  const modes = Array.from(new Set(many(raw.modes).filter(isDeliveryMode))) as DeliveryMode[];
  if (modes.length === 0) return { ok: false, error: "Choose online, in person, or both" };
  if (modes.includes("IN_PERSON") && !city) return { ok: false, error: "Add your city for in-person sessions" };
  const languages = Array.from(new Set(many(raw.languages).filter(isLanguage)));
  if (languages.length === 0) return { ok: false, error: "Choose at least one language" };
  const specialisations = Array.from(new Set(many(raw.specialisations).filter((s) => isSpecialisationFor(type, s))));
  const sports = parseList(raw.sports, 10, 40);

  const health = HEALTH_CATEGORY_BY_TYPE[type] !== null;
  const registrationBody = health ? str(raw.registrationBody) : "";
  const registrationNumber = health ? str(raw.registrationNumber) : "";
  if (registrationBody.length > 120) return { ok: false, error: "Registration body must be 120 characters or fewer" };
  if (registrationNumber.length > 60) return { ok: false, error: "Registration number must be 60 characters or fewer" };

  return {
    ok: true,
    value: {
      type,
      headline: headline || null,
      bio,
      sports,
      city: city || null,
      yearsExperience,
      meta: { type, modes, languages, specialisations },
      listed: on(raw.listed),
      acceptingRequests: health && on(raw.acceptingRequests),
      registrationBody: registrationBody || null,
      registrationNumber: registrationNumber || null,
    },
  };
}

/**
 * Whether the WellnessProvider registration check must start again: the professional type, category or
 * registration details changed after ops had already looked at it. Mirrors wellness credentialFieldsChanged.
 */
export function providerNeedsRecheck(
  before: { type: ProType | null; category: string; registrationBody: string | null; registrationNumber: string | null; credentialStatus: string },
  after: { type: ProType; category: string; registrationBody: string | null; registrationNumber: string | null },
): boolean {
  if (before.credentialStatus === "SUBMITTED") return false;
  return (
    (before.type !== null && before.type !== after.type) ||
    before.category !== after.category ||
    before.registrationBody !== after.registrationBody ||
    before.registrationNumber !== after.registrationNumber
  );
}

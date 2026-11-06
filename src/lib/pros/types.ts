// TRIQ Connect — professional types and the credentials Triq asks each type for. Pure and client-safe.
// Nothing here verifies anyone: these lists only drive the onboarding form and the ops review checklist.

import type { ProviderCategory } from "@/lib/wellness";

export const PRO_TYPES = [
  "SPORTS_PSYCHOLOGIST",
  "COUNSELLOR",
  "PHYSIOTHERAPIST",
  "SPORTS_NUTRITIONIST",
  "SPORTS_SCIENTIST",
  "SC_COACH",
] as const;
export type ProType = (typeof PRO_TYPES)[number];

export const PRO_TYPE_LABELS: Record<ProType, string> = {
  SPORTS_PSYCHOLOGIST: "Sports psychologist",
  COUNSELLOR: "Counsellor",
  PHYSIOTHERAPIST: "Physiotherapist",
  SPORTS_NUTRITIONIST: "Sports nutritionist",
  SPORTS_SCIENTIST: "Sports scientist",
  SC_COACH: "Strength and conditioning coach",
};

export const isProType = (v: unknown): v is ProType => typeof v === "string" && (PRO_TYPES as readonly string[]).includes(v);

/**
 * Health categories get a WellnessProvider row (registration details, booking requests).
 * Non-health types (sports scientist, S&C coach) are profile-only and cannot take booking requests yet.
 */
export const HEALTH_CATEGORY_BY_TYPE: Record<ProType, ProviderCategory | null> = {
  SPORTS_PSYCHOLOGIST: "PSYCHOLOGY",
  COUNSELLOR: "PSYCHOLOGY",
  PHYSIOTHERAPIST: "PHYSIOTHERAPY",
  SPORTS_NUTRITIONIST: "NUTRITION",
  SPORTS_SCIENTIST: null,
  SC_COACH: null,
};

export const isHealthType = (t: ProType): boolean => HEALTH_CATEGORY_BY_TYPE[t] !== null;

// ---- credentials requested per type -------------------------------------------------------------

/** `kind` maps onto ProfessionalCredential.kind (QUALIFICATION | CERTIFICATION). */
export interface CredentialType {
  id: string;
  label: string;
  kind: "QUALIFICATION" | "CERTIFICATION";
  required: boolean;
  hint?: string;
}

const SAFEGUARDING: CredentialType = {
  id: "SAFEGUARDING",
  label: "Child safeguarding training",
  kind: "CERTIFICATION",
  required: false,
  hint: "Recommended for anyone working with under-18 athletes",
};
const FIRST_AID: CredentialType = { id: "FIRST_AID", label: "First aid / CPR certificate", kind: "CERTIFICATION", required: false };

export const CREDENTIAL_TYPES_BY_PRO: Record<ProType, CredentialType[]> = {
  SPORTS_PSYCHOLOGIST: [
    { id: "PSY_DEGREE", label: "Postgraduate degree in psychology", kind: "QUALIFICATION", required: true, hint: "e.g. MA / MSc / M.Phil in (sport) psychology" },
    { id: "PSY_REGISTRATION", label: "Professional registration", kind: "CERTIFICATION", required: true, hint: "Registration certificate from the body you are registered with" },
    { id: "SPORT_PSY_CERT", label: "Sport or performance psychology certification", kind: "CERTIFICATION", required: false },
    SAFEGUARDING,
  ],
  COUNSELLOR: [
    { id: "COUNSELLING_QUAL", label: "Degree or diploma in counselling or psychology", kind: "QUALIFICATION", required: true },
    { id: "COUNSELLING_MEMBERSHIP", label: "Counselling body membership or registration", kind: "CERTIFICATION", required: false },
    { id: "SUPERVISED_PRACTICE", label: "Supervised practice hours", kind: "CERTIFICATION", required: false },
    SAFEGUARDING,
  ],
  PHYSIOTHERAPIST: [
    { id: "PHYSIO_DEGREE", label: "Physiotherapy degree (BPT / MPT)", kind: "QUALIFICATION", required: true },
    { id: "PHYSIO_REGISTRATION", label: "Physiotherapy council registration", kind: "CERTIFICATION", required: true },
    { id: "SPORTS_PHYSIO_CERT", label: "Sports physiotherapy specialisation", kind: "CERTIFICATION", required: false },
    FIRST_AID,
    SAFEGUARDING,
  ],
  SPORTS_NUTRITIONIST: [
    { id: "NUTRITION_DEGREE", label: "Degree in nutrition or dietetics", kind: "QUALIFICATION", required: true },
    { id: "DIETITIAN_REGISTRATION", label: "Registered dietitian credential", kind: "CERTIFICATION", required: false },
    { id: "SPORTS_NUTRITION_CERT", label: "Sports nutrition certification", kind: "CERTIFICATION", required: false },
    SAFEGUARDING,
  ],
  SPORTS_SCIENTIST: [
    { id: "SPORT_SCIENCE_DEGREE", label: "Degree in sport or exercise science", kind: "QUALIFICATION", required: true },
    { id: "SPORT_SCIENCE_CERT", label: "Professional sport science accreditation", kind: "CERTIFICATION", required: false },
    SAFEGUARDING,
  ],
  SC_COACH: [
    { id: "SC_CERT", label: "Strength and conditioning certification", kind: "CERTIFICATION", required: true, hint: "e.g. NSCA-CSCS, UKSCA, ASCA, or equivalent" },
    { id: "SC_DEGREE", label: "Degree in sport or exercise science", kind: "QUALIFICATION", required: false },
    FIRST_AID,
    SAFEGUARDING,
  ],
};

export function credentialTypesFor(t: ProType): CredentialType[] {
  return CREDENTIAL_TYPES_BY_PRO[t];
}

export function findCredentialType(t: ProType, id: unknown): CredentialType | null {
  return CREDENTIAL_TYPES_BY_PRO[t].find((c) => c.id === id) ?? null;
}

const TITLE_SEP = " — ";

/** ProfessionalCredential.title stores "<credential type label> — <what the professional wrote>". */
export function credentialTitle(type: CredentialType, title: string): string {
  return `${type.label}${TITLE_SEP}${title}`.slice(0, 160);
}

/** Reverse of credentialTitle for the given professional type; null when it is not one of that type's labels. */
export function credentialTypeOfTitle(t: ProType, title: string): CredentialType | null {
  const i = title.indexOf(TITLE_SEP);
  if (i <= 0) return null;
  const label = title.slice(0, i);
  return CREDENTIAL_TYPES_BY_PRO[t].find((c) => c.label === label) ?? null;
}

// ---- registration bodies -------------------------------------------------------------------------

// COUNSEL/ADVISOR: confirm accepted registrations (e.g. RCI for clinical psychologists in India).
// These are suggestions shown in the onboarding form only. Triq ops still checks every registration with
// the issuing body before verifying; nothing here is treated as proof of registration.
export const REGISTRATION_BODIES: Record<ProType, string[]> = {
  SPORTS_PSYCHOLOGIST: [
    "Rehabilitation Council of India (RCI) — clinical psychologists",
    "National Commission for Allied and Healthcare Professions (NCAHP)",
    "Other (name it)",
  ],
  COUNSELLOR: ["Professional counselling association membership", "Other (name it)"],
  PHYSIOTHERAPIST: [
    "State physiotherapy council",
    "National Commission for Allied and Healthcare Professions (NCAHP)",
    "Indian Association of Physiotherapists (IAP) membership",
    "Other (name it)",
  ],
  SPORTS_NUTRITIONIST: ["Indian Dietetic Association (IDA) — registered dietitian", "Other (name it)"],
  SPORTS_SCIENTIST: [],
  SC_COACH: [],
};

// ---- specialisations, languages, delivery modes --------------------------------------------------

export const SPECIALISATIONS_BY_PRO: Record<ProType, string[]> = {
  SPORTS_PSYCHOLOGIST: ["Performance anxiety", "Focus and concentration", "Confidence", "Motivation", "Team dynamics", "Injury comeback mindset"],
  COUNSELLOR: ["Stress", "Academic and sport balance", "Family communication", "Transitions", "Burnout"],
  PHYSIOTHERAPIST: ["Injury rehabilitation", "Return to sport", "Injury prevention", "Mobility", "Sports massage"],
  SPORTS_NUTRITIONIST: ["Young athlete nutrition", "Match-day fuelling", "Hydration", "Weight-category sports", "Vegetarian athletes"],
  SPORTS_SCIENTIST: ["Performance testing", "Load monitoring", "Biomechanics", "Data analysis", "Talent identification"],
  SC_COACH: ["Youth athletic development", "Speed and agility", "Strength", "Conditioning", "Injury-prevention training"],
};

export function isSpecialisationFor(t: ProType, s: unknown): s is string {
  return typeof s === "string" && SPECIALISATIONS_BY_PRO[t].includes(s);
}

export const LANGUAGES = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Odia",
  "Arabic",
] as const;
export const isLanguage = (v: unknown): v is string => typeof v === "string" && (LANGUAGES as readonly string[]).includes(v);

export const DELIVERY_MODES = ["ONLINE", "IN_PERSON"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = { ONLINE: "Online", IN_PERSON: "In person" };
export const isDeliveryMode = (v: unknown): v is DeliveryMode => typeof v === "string" && (DELIVERY_MODES as readonly string[]).includes(v);

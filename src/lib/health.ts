// V6 TRIQ Wellness — rules for student medical data. Pure and client-safe.
// Health data is sensitive: whitelist what can be stored, and audit only WHICH fields changed,
// never their values.

/** Keys the MedicalForm writes into Student.medicalInfo (JSON). Anything else is dropped. */
export const MEDICAL_FIELDS = [
  "allergies",
  "medicalConditions",
  "emergencyContactName",
  "emergencyContactPhone",
  "doctorName",
  "doctorPhone",
  "insurancePolicyNumber",
  "signature",
  "consent",
] as const;
export type MedicalField = (typeof MEDICAL_FIELDS)[number];

const MAX_LEN = 500;

/** Keeps only whitelisted keys; strings trimmed and capped, `consent` coerced to boolean. */
export function whitelistMedical(raw: unknown): Partial<Record<MedicalField, string | boolean>> {
  const out: Partial<Record<MedicalField, string | boolean>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const key of MEDICAL_FIELDS) {
    if (!(key in src)) continue;
    const v = src[key];
    if (key === "consent") out.consent = v === true || v === "true" || v === "on";
    else if (typeof v === "string") out[key] = v.trim().slice(0, MAX_LEN);
    else if (v == null) out[key] = "";
  }
  return out;
}

/** Parses Student.medicalInfo (JSON string or legacy plain text) into an object. */
export function parseMedicalJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { legacyNote: raw };
  } catch {
    return { legacyNote: raw };
  }
}

const norm = (v: unknown) => (v === undefined || v === null || v === "" || v === false ? "" : String(v));

/** Names of fields whose value differs between before and after. Values are never returned. */
export function medicalFieldsChanged(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys)
    .filter((k) => norm(before[k]) !== norm(after[k]))
    .sort();
}

/** The only shape allowed in a MEDICAL_INFO_UPDATED audit row. */
export function medicalAuditDetails(studentId: string, fields: string[]): { studentId: string; fields: string[] } {
  return { studentId, fields: fields.filter((f) => typeof f === "string" && f.length <= 64) };
}

/**
 * Whether an academy user may see a student's medical data.
 * Flag off: unchanged behaviour (allowed). Flag on: ADMIN/STAFF-app users need health.view; coaches keep
 * access for their own batches (safety) and parents for their own children — enforced by the
 * caller's tenant `where`.
 */
export function canViewMedical(opts: { wellness: boolean; appRole: string; hasHealthView: boolean }): boolean {
  if (!opts.wellness) return true;
  if (opts.appRole === "ADMIN" || opts.appRole === "STAFF") return opts.hasHealthView;
  return opts.appRole === "COACH" || opts.appRole === "PARENT";
}

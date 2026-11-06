// Who sees how much of a student's medical record. Pure and client-safe, no DB access.
//
// Sprint 1 item 10 / audit permissions matrix: coaches see only safety-critical fields for their own
// athletes. The medical record (Student.medicalInfo, see src/lib/health.ts MEDICAL_FIELDS) has no
// "coach must know" flag on conditions, so for coaches the safety-critical set is allergies and the
// emergency contact. Blood group, conditions, doctor, insurance, signature and consent stay with
// owners/managers (subject to health.view when the wellness flag is on) and the athlete's parent.
// One exception (decision D-13): the coach's emergency SOS screen also shows blood group.

import { parseMedicalJson } from "@/lib/health";

/** full = whole record; safety = coach-safe fields only; none = nothing. */
export type MedicalView = "full" | "safety" | "none";

/** The only medical keys a coach ever receives. */
export const COACH_SAFE_MEDICAL_FIELDS = ["allergies", "emergencyContactName", "emergencyContactPhone"] as const;
export type CoachSafeMedicalField = (typeof COACH_SAFE_MEDICAL_FIELDS)[number];

/**
 * The medical view for an app role. `fullAllowed` is the existing full-view check for owners/managers
 * (canViewMedical in src/lib/health.ts: health.view when the wellness flag is on). Parents get the full
 * record of their own children (the caller's tenant filter enforces "own").
 */
export function medicalViewFor(opts: { appRole: string; fullAllowed: boolean }): MedicalView {
  switch (opts.appRole) {
    case "PARENT":
      return "full";
    case "ADMIN":
    case "STAFF":
      return opts.fullAllowed ? "full" : "none";
    case "COACH":
      return "safety";
    default:
      return "none";
  }
}

const ALLERGY_TEXT = /allerg|anaphyla|epi-?pen/i;

/**
 * Coach-safe copy of Student.medicalInfo as a JSON string with only allergies and the emergency contact,
 * or null when none of those is on file. Legacy plain-text notes cannot be split into fields, so they
 * are passed through as `allergies` only when they read as an allergy note, and dropped otherwise.
 */
export function coachSafeMedicalInfo(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const parsed = parseMedicalJson(text);
  const out: Partial<Record<CoachSafeMedicalField, string>> = {};
  if ("legacyNote" in parsed && Object.keys(parsed).length === 1) {
    const note = String(parsed.legacyNote ?? "").trim();
    if (note && ALLERGY_TEXT.test(note)) out.allergies = note.slice(0, 500);
  } else {
    for (const key of COACH_SAFE_MEDICAL_FIELDS) {
      const v = parsed[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 500);
    }
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

/** The medical fields of a student record as one viewer may receive them. */
export function medicalForView<T extends { medicalInfo: string | null; bloodGroup: string | null }>(
  record: T,
  view: MedicalView,
): { medicalInfo: string | null; bloodGroup: string | null } {
  if (view === "full") return { medicalInfo: record.medicalInfo, bloodGroup: record.bloodGroup };
  if (view === "safety") return { medicalInfo: coachSafeMedicalInfo(record.medicalInfo), bloodGroup: null };
  return { medicalInfo: null, bloodGroup: null };
}

/** Same student object with its medical fields reduced to what `view` allows (other fields untouched). */
export function withMedicalView<T extends { medicalInfo: string | null; bloodGroup: string | null }>(record: T, view: MedicalView): T {
  if (view === "full") return record;
  return { ...record, ...medicalForView(record, view) };
}

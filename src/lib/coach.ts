// Shared helpers for the coach view (server + client safe, no DB access).

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

/** Resolve the effective status of an attendance row (legacy rows only have isPresent). */
export function attendanceStatusOf(a: { status?: string | null; isPresent: boolean } | null | undefined): AttendanceStatus | null {
  if (!a) return null;
  if (a.status && (ATTENDANCE_STATUSES as string[]).includes(a.status)) return a.status as AttendanceStatus;
  return a.isPresent ? "PRESENT" : "ABSENT";
}

/** LATE counts as attended; EXCUSED and ABSENT don't. */
export function statusIsPresent(s: AttendanceStatus): boolean {
  return s === "PRESENT" || s === "LATE";
}

export type MedicalSeverity = "alert" | "info" | "none";

export interface MedicalSummary {
  hasAny: boolean;
  /** "alert" = coach must watch during sessions; "info" = historical/cleared; "none" = nothing on file. */
  severity: MedicalSeverity;
  summary: string; // human readable one-liner
  allergies?: string;
  conditions?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  doctorName?: string;
  doctorPhone?: string;
}

/**
 * Classify a free-text medical note. Allergies are always alerts. Notes that describe a
 * recovered / cleared / past issue are informational, not something to watch on the field.
 */
export function medicalSeverity(text: string | null | undefined): MedicalSeverity {
  const t = (text || "").trim().toLowerCase();
  if (!t || isNoneNote(t)) return "none";
  if (/allerg|anaphyla|epipen|asthma|inhaler|epilep|seizure|diabet|insulin|heart|cardiac/.test(t)) return "alert";
  if (/\b(recovered|cleared|healed|resolved|old|past|previous|history of|fully fit|no restrictions?)\b/.test(t)) return "info";
  return "alert";
}

/**
 * medicalInfo is stored as a JSON string by MedicalForm ({allergies, medicalConditions, ...}),
 * but older/seeded rows may contain plain text. Normalise both.
 */
export function parseMedicalInfo(raw: string | null | undefined): MedicalSummary {
  const text = (raw || "").trim();
  if (!text || text === "{}" || isNoneNote(text)) {
    return { hasAny: false, severity: "none", summary: "" };
  }
  if (text.startsWith("{")) {
    try {
      const o = JSON.parse(text) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const allergies = isNoneNote(str(o.allergies)) ? "" : str(o.allergies);
      const conditions = isNoneNote(str(o.medicalConditions)) ? "" : str(o.medicalConditions);
      const parts = [conditions, allergies ? `Allergies: ${allergies}` : ""].filter(Boolean);
      const severity: MedicalSeverity = allergies
        ? "alert"
        : conditions
          ? medicalSeverity(conditions)
          : "none";
      return {
        hasAny: parts.length > 0,
        severity,
        summary: parts.join(" · "),
        allergies: allergies || undefined,
        conditions: conditions || undefined,
        emergencyContactName: str(o.emergencyContactName) || undefined,
        emergencyContactPhone: str(o.emergencyContactPhone) || undefined,
        doctorName: str(o.doctorName) || undefined,
        doctorPhone: str(o.doctorPhone) || undefined,
      };
    } catch {
      // fall through to plain text
    }
  }
  return { hasAny: true, severity: medicalSeverity(text), summary: text, conditions: text };
}

/** Short label for a "to watch" row, e.g. "Peanut & tree nut allergy." → "allergy". */
export function shortMedicalLabel(summary: string): string {
  const t = summary.toLowerCase();
  if (/allerg/.test(t)) return "allergy";
  if (/asthma|inhaler/.test(t)) return "asthma";
  if (/epilep|seizure/.test(t)) return "epilepsy";
  if (/diabet|insulin/.test(t)) return "diabetes";
  if (/fractur|sprain|injur|strain|tear/.test(t)) return "injury";
  const first = summary.split(/[.,·(]/)[0].trim();
  return first.length > 18 ? `${first.slice(0, 18)}…` : first.toLowerCase();
}

/** Digits-only Indian phone with 91 prefix, or null if unusable. */
export function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length > 10) return d;
  return null;
}

/** Extract a display time like "4:00 PM" / "6-7 AM" from a free-text schedule. */
export function scheduleTime(schedule: string | null | undefined): string | null {
  if (!schedule) return null;
  const m = schedule.match(/\d{1,2}(:\d{2})?\s*(?:-\s*\d{1,2}(:\d{2})?\s*)?(am|pm)/i);
  return m ? m[0].toUpperCase().replace(/\s+/g, " ") : null;
}

/** Minutes since midnight for sorting sessions by start time (unknown → end of day). */
export function scheduleStartMinutes(schedule: string | null | undefined): number {
  if (!schedule) return 24 * 60;
  const m = schedule.match(/(\d{1,2})(?::(\d{2}))?\s*(?:-\s*\d{1,2}(?::\d{2})?\s*)?(am|pm)/i);
  if (!m) return 24 * 60;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "pm") h += 12;
  return h * 60 + Number(m[2] || 0);
}

/** "None", "No known conditions. Peak fitness.", "NA", "nil" … are not medical alerts. */
export function isNoneNote(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  return /^(none|nil|na|n\/a|no known( medical)? (conditions?|allergies|issues)|no (medical )?(conditions?|allergies|issues)|healthy)\b/.test(t);
}

/** Compact start time for tight UI, e.g. "06:30 - 08:00 AM" → { time: "6:30", period: "AM" }. */
export function shortStart(schedule: string | null | undefined): { time: string; period: string } | null {
  if (!schedule) return null;
  const m = schedule.match(/(\d{1,2})(?::(\d{2}))?\s*(?:-\s*\d{1,2}(?::\d{2})?\s*)?(am|pm)/i);
  if (!m) return null;
  return { time: `${Number(m[1])}${m[2] ? `:${m[2]}` : ""}`, period: m[3].toUpperCase() };
}

/** "Coach Rahul Sharma" → "Rahul". */
export function firstName(name: string): string {
  const parts = name.replace(/^(coach|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, "").trim().split(/\s+/);
  return parts[0] || name;
}

// V2 TRIQ Athlete: trials / scholarships board. Pure and client-safe: validation, eligibility and
// application status rules only.

import { safeHttpUrl } from "@/lib/safe-url";
import { parseDay, type Parsed } from "@/lib/athlete";

export const OPPORTUNITY_KINDS = ["TRIAL", "SCHOLARSHIP", "CAMP", "TOURNAMENT", "RECRUITMENT", "OTHER"] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];
export const OPPORTUNITY_KIND_LABELS: Record<OpportunityKind, string> = {
  TRIAL: "Trial", SCHOLARSHIP: "Scholarship", CAMP: "Camp", TOURNAMENT: "Tournament", RECRUITMENT: "Recruitment", OTHER: "Other",
};

export const OPPORTUNITY_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const APPLICATION_STATUSES = ["APPLIED", "SHORTLISTED", "SELECTED", "NOT_SELECTED", "WITHDRAWN"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied", SHORTLISTED: "Shortlisted", SELECTED: "Selected", NOT_SELECTED: "Not selected", WITHDRAWN: "Withdrawn",
};

export interface OpportunityInput {
  title: string;
  kind: OpportunityKind;
  sport: string | null;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  applyBy: Date;
  ageMin: number | null;
  ageMax: number | null;
  url: string | null;
  description: string | null;
  batchId: string | null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const optInt = (v: unknown, label: string): Parsed<number | null> => {
  if (v === null || v === undefined || str(String(v)) === "") return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 3 || n > 30) return { ok: false, error: `${label} must be a whole number between 3 and 30.` };
  return { ok: true, value: n };
};
const optDay = (v: unknown, label: string): Parsed<Date | null> => {
  if (!str(v)) return { ok: true, value: null };
  const d = parseDay(v);
  return d ? { ok: true, value: d } : { ok: false, error: `Enter a valid ${label}.` };
};

/** Validate an opportunity. `today` is the org's calendar day at 00:00 UTC; publishing requires applyBy ≥ today. */
export function parseOpportunityInput(raw: Record<string, unknown>, today: Date, opts: { publishing: boolean }): Parsed<OpportunityInput> {
  const title = str(raw.title);
  if (title.length < 3 || title.length > 120) return { ok: false, error: "Title must be 3–120 characters." };
  const kind = str(raw.kind) || "TRIAL";
  if (!(OPPORTUNITY_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Choose a valid type." };
  const sport = str(raw.sport);
  if (sport.length > 40) return { ok: false, error: "Sport must be at most 40 characters." };
  const location = str(raw.location);
  if (location.length > 120) return { ok: false, error: "Location must be at most 120 characters." };
  const description = str(raw.description);
  if (description.length > 2000) return { ok: false, error: "Description must be at most 2000 characters." };
  const applyBy = parseDay(raw.applyBy);
  if (!applyBy) return { ok: false, error: "Enter the last date to apply." };
  if (opts.publishing && applyBy.getTime() < today.getTime()) return { ok: false, error: "The apply-by date has already passed." };
  const start = optDay(raw.startDate, "start date");
  if (!start.ok) return start;
  const end = optDay(raw.endDate, "end date");
  if (!end.ok) return end;
  if (start.value && end.value && end.value < start.value) return { ok: false, error: "End date must be on or after the start date." };
  if (start.value && applyBy > start.value) return { ok: false, error: "Apply-by date must be on or before the start date." };
  const ageMin = optInt(raw.ageMin, "Minimum age");
  if (!ageMin.ok) return ageMin;
  const ageMax = optInt(raw.ageMax, "Maximum age");
  if (!ageMax.ok) return ageMax;
  if (ageMin.value !== null && ageMax.value !== null && ageMin.value > ageMax.value) return { ok: false, error: "Minimum age cannot be above maximum age." };
  let url: string | null = null;
  if (str(raw.url)) {
    url = safeHttpUrl(str(raw.url));
    if (!url) return { ok: false, error: "Link must be an http(s) URL." };
  }
  const batchId = str(raw.batchId) || null;
  return {
    ok: true,
    value: {
      title, kind: kind as OpportunityKind, sport: sport || null, location: location || null,
      startDate: start.value, endDate: end.value, applyBy, ageMin: ageMin.value, ageMax: ageMax.value,
      url, description: description || null, batchId,
    },
  };
}

/** Whole years of age on a given day (UTC calendar). */
export function ageOn(dob: Date | string, on: Date): number {
  const b = new Date(dob);
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export interface EligibilityOpportunity {
  status: string;
  applyBy: Date | string;
  startDate?: Date | string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  batchId?: string | null;
}

export type Eligibility = { ok: true; ageUnknown: boolean } | { ok: false; reason: string };

/** Can this child apply today? Age is checked on the start date (or apply-by date if no start). */
export function checkEligibility(opp: EligibilityOpportunity, child: { dob?: Date | string | null; batchIds: string[] }, today: Date): Eligibility {
  if (opp.status !== "OPEN") return { ok: false, reason: "Applications are closed." };
  if (new Date(opp.applyBy).getTime() < today.getTime()) return { ok: false, reason: "The apply-by date has passed." };
  if (opp.batchId && !child.batchIds.includes(opp.batchId)) return { ok: false, reason: "Only open to a specific batch." };
  const hasBand = opp.ageMin != null || opp.ageMax != null;
  if (!hasBand) return { ok: true, ageUnknown: false };
  if (!child.dob) return { ok: true, ageUnknown: true };
  const age = ageOn(child.dob, new Date(opp.startDate ?? opp.applyBy));
  if (opp.ageMin != null && age < opp.ageMin) return { ok: false, reason: `Minimum age is ${opp.ageMin}.` };
  if (opp.ageMax != null && age > opp.ageMax) return { ok: false, reason: `Maximum age is ${opp.ageMax}.` };
  return { ok: true, ageUnknown: false };
}

const ADMIN_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ["SHORTLISTED", "NOT_SELECTED"],
  SHORTLISTED: ["SELECTED", "NOT_SELECTED"],
  SELECTED: [],
  NOT_SELECTED: ["SHORTLISTED"],
  WITHDRAWN: [],
};

/** Allowed status change. Staff move the pipeline; only the guardian can withdraw (before a final decision). */
export function canTransitionApplication(from: string, to: string, by: "STAFF" | "GUARDIAN"): boolean {
  if (by === "GUARDIAN") return to === "WITHDRAWN" && (from === "APPLIED" || from === "SHORTLISTED");
  const allowed = ADMIN_TRANSITIONS[from as ApplicationStatus];
  return !!allowed && allowed.includes(to as ApplicationStatus);
}

export function isOpportunityStatus(v: unknown): v is OpportunityStatus {
  return typeof v === "string" && (OPPORTUNITY_STATUSES as readonly string[]).includes(v);
}

/** DRAFT → OPEN → CLOSED, and CLOSED → OPEN (re-open). */
export function canChangeOpportunityStatus(from: string, to: string): boolean {
  if (from === to) return false;
  if (from === "DRAFT") return to === "OPEN";
  if (from === "OPEN") return to === "CLOSED";
  if (from === "CLOSED") return to === "OPEN";
  return false;
}

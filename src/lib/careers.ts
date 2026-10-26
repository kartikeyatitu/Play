// V5 TRIQ Careers — pure rules and validation. Client-safe (no DB imports).

export const JOB_ROLES = [
  "HEAD_COACH",
  "COACH",
  "ASSISTANT_COACH",
  "FITNESS_TRAINER",
  "PHYSIO",
  "ACADEMY_MANAGER",
  "GROUNDSTAFF",
  "ANALYST",
  "OTHER",
] as const;
export type JobRole = (typeof JOB_ROLES)[number];
export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  HEAD_COACH: "Head coach",
  COACH: "Coach",
  ASSISTANT_COACH: "Assistant coach",
  FITNESS_TRAINER: "Fitness trainer",
  PHYSIO: "Physiotherapist",
  ACADEMY_MANAGER: "Academy manager",
  GROUNDSTAFF: "Groundstaff",
  ANALYST: "Performance analyst",
  OTHER: "Other",
};

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "VOLUNTEER"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  VOLUNTEER: "Volunteer",
};

export const JOB_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};

export const CREDENTIAL_KINDS = ["QUALIFICATION", "CERTIFICATION"] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

const inList = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
export const isJobRole = (v: unknown): v is JobRole => inList(JOB_ROLES, v);
export const isEmploymentType = (v: unknown): v is EmploymentType => inList(EMPLOYMENT_TYPES, v);
export const isJobStatus = (v: unknown): v is JobStatus => inList(JOB_STATUSES, v);
export const isApplicationStatus = (v: unknown): v is ApplicationStatus => inList(APPLICATION_STATUSES, v);
export const isCredentialKind = (v: unknown): v is CredentialKind => inList(CREDENTIAL_KINDS, v);

export type ApplicationActor = "EMPLOYER" | "APPLICANT";

const EMPLOYER_MOVES: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ["SHORTLISTED", "INTERVIEW", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "OFFERED", "REJECTED"],
  INTERVIEW: ["OFFERED", "REJECTED"],
  OFFERED: ["HIRED", "REJECTED"],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = ["HIRED", "REJECTED", "WITHDRAWN"];

/** Statuses `actor` may move an application to from `from`. */
export function allowedApplicationMoves(from: string, actor: ApplicationActor): ApplicationStatus[] {
  if (!isApplicationStatus(from)) return [];
  if (actor === "APPLICANT") return TERMINAL_APPLICATION_STATUSES.includes(from) ? [] : ["WITHDRAWN"];
  return EMPLOYER_MOVES[from];
}

export function canTransitionApplication(from: string, to: string, actor: ApplicationActor): boolean {
  return isApplicationStatus(to) && allowedApplicationMoves(from, actor).includes(to);
}

/** Job status moves: DRAFT → OPEN → CLOSED, CLOSED → OPEN (reopen). */
export function canTransitionJob(from: string, to: string): boolean {
  if (!isJobStatus(from) || !isJobStatus(to) || from === to) return false;
  if (from === "DRAFT") return to === "OPEN";
  if (from === "OPEN") return to === "CLOSED";
  return to === "OPEN";
}

// ---- validation ---------------------------------------------------------------------------------

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function optInt(v: unknown): number | null | "bad" {
  const s = str(v);
  if (!s) return null;
  if (!/^\d+$/.test(s)) return "bad";
  return Number(s);
}

/** Comma separated list → trimmed unique items. */
export function parseList(v: unknown, maxItems = 10, maxLen = 40): string[] {
  const parts = str(v)
    .split(",")
    .map((p) => p.trim().slice(0, maxLen))
    .filter(Boolean);
  return Array.from(new Set(parts)).slice(0, maxItems);
}

export interface ProfileInput {
  headline: string | null;
  bio: string | null;
  sports: string[];
  city: string | null;
  yearsExperience: number | null;
  isPublic: boolean;
}

export function validateProfile(raw: Record<string, unknown>): Result<ProfileInput> {
  const headline = str(raw.headline);
  const bio = str(raw.bio);
  const city = str(raw.city);
  if (headline.length > 120) return { ok: false, error: "Headline must be 120 characters or fewer" };
  if (bio.length > 2000) return { ok: false, error: "Bio must be 2000 characters or fewer" };
  if (city.length > 80) return { ok: false, error: "City must be 80 characters or fewer" };
  const years = optInt(raw.yearsExperience);
  if (years === "bad" || (years !== null && years > 60)) return { ok: false, error: "Years of experience must be 0–60" };
  return {
    ok: true,
    value: {
      headline: headline || null,
      bio: bio || null,
      sports: parseList(raw.sports),
      city: city || null,
      yearsExperience: years,
      isPublic: raw.isPublic === "on" || raw.isPublic === true || raw.isPublic === "true",
    },
  };
}

export interface ExperienceInput {
  title: string;
  organization: string;
  startYear: number;
  endYear: number | null;
  description: string | null;
}

export function validateExperience(raw: Record<string, unknown>, currentYear = new Date().getFullYear()): Result<ExperienceInput> {
  const title = str(raw.title);
  const organization = str(raw.organization);
  const description = str(raw.description);
  if (title.length < 2 || title.length > 120) return { ok: false, error: "Role title must be 2–120 characters" };
  if (organization.length < 2 || organization.length > 120) return { ok: false, error: "Organisation must be 2–120 characters" };
  if (description.length > 1000) return { ok: false, error: "Description must be 1000 characters or fewer" };
  const start = optInt(raw.startYear);
  const end = optInt(raw.endYear);
  if (start === null || start === "bad" || start < 1950 || start > currentYear) return { ok: false, error: "Enter a valid start year" };
  if (end === "bad" || (end !== null && (end < start || end > currentYear))) return { ok: false, error: "End year must be after the start year" };
  return { ok: true, value: { title, organization, startYear: start, endYear: end, description: description || null } };
}

export interface CredentialInput {
  kind: CredentialKind;
  title: string;
  issuer: string | null;
  issuedYear: number | null;
  evidenceUrl: string | null;
}

/** `safeUrl` is injected (src/lib/safe-url.ts safeHttpUrl) so this stays dependency-free for tests. */
export function validateCredential(
  raw: Record<string, unknown>,
  safeUrl: (v: unknown) => string | null,
  currentYear = new Date().getFullYear(),
): Result<CredentialInput> {
  if (!isCredentialKind(raw.kind)) return { ok: false, error: "Choose qualification or certification" };
  const title = str(raw.title);
  const issuer = str(raw.issuer);
  if (title.length < 2 || title.length > 160) return { ok: false, error: "Title must be 2–160 characters" };
  if (issuer.length > 160) return { ok: false, error: "Issuer must be 160 characters or fewer" };
  const year = optInt(raw.issuedYear);
  if (year === "bad" || (year !== null && (year < 1950 || year > currentYear))) return { ok: false, error: "Enter a valid year" };
  const rawUrl = str(raw.evidenceUrl);
  const evidenceUrl = rawUrl ? safeUrl(rawUrl) : null;
  if (rawUrl && !evidenceUrl) return { ok: false, error: "Evidence link must be an http(s) URL" };
  return { ok: true, value: { kind: raw.kind, title, issuer: issuer || null, issuedYear: year, evidenceUrl } };
}

export interface JobInput {
  title: string;
  role: JobRole;
  sport: string | null;
  city: string;
  employmentType: EmploymentType;
  description: string;
  requirements: string | null;
  payMin: number | null;
  payMax: number | null;
}

export function validateJob(raw: Record<string, unknown>): Result<JobInput> {
  const title = str(raw.title);
  const sport = str(raw.sport);
  const city = str(raw.city);
  const description = str(raw.description);
  const requirements = str(raw.requirements);
  if (title.length < 3 || title.length > 120) return { ok: false, error: "Job title must be 3–120 characters" };
  if (!isJobRole(raw.role)) return { ok: false, error: "Choose a role" };
  if (!isEmploymentType(raw.employmentType)) return { ok: false, error: "Choose an employment type" };
  if (sport.length > 40) return { ok: false, error: "Sport must be 40 characters or fewer" };
  if (city.length < 2 || city.length > 80) return { ok: false, error: "City must be 2–80 characters" };
  if (description.length < 20 || description.length > 5000) return { ok: false, error: "Description must be 20–5000 characters" };
  if (requirements.length > 3000) return { ok: false, error: "Requirements must be 3000 characters or fewer" };
  const payMin = optInt(raw.payMin);
  const payMax = optInt(raw.payMax);
  if (payMin === "bad" || payMax === "bad") return { ok: false, error: "Pay must be a whole number" };
  if (payMin !== null && payMax !== null && payMin > payMax) return { ok: false, error: "Minimum pay cannot exceed maximum pay" };
  return {
    ok: true,
    value: {
      title,
      role: raw.role,
      sport: sport || null,
      city,
      employmentType: raw.employmentType,
      description,
      requirements: requirements || null,
      payMin,
      payMax,
    },
  };
}

export function validateCoverNote(raw: unknown): Result<string | null> {
  const note = str(raw);
  if (note.length > 2000) return { ok: false, error: "Cover note must be 2000 characters or fewer" };
  return { ok: true, value: note || null };
}

/** "₹20,000 – ₹30,000 / month" or null. Amounts are whole units of the job's currency. */
export function payBand(payMin: number | null, payMax: number | null, currency = "INR"): string | null {
  const f = (n: number) => {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency} ${n}`;
    }
  };
  if (payMin !== null && payMax !== null) return payMin === payMax ? `${f(payMin)} / month` : `${f(payMin)} – ${f(payMax)} / month`;
  if (payMin !== null) return `From ${f(payMin)} / month`;
  if (payMax !== null) return `Up to ${f(payMax)} / month`;
  return null;
}

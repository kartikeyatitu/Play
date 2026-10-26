// V2 TRIQ Athlete: achievements (explicit submitted / reviewed / verified status) and coach-set
// development goals. Pure and client-safe: validation and state rules only, no DB access.

import { safeHttpUrl } from "@/lib/safe-url";

export const ACHIEVEMENT_KINDS = ["ACHIEVEMENT", "COMPETITION"] as const;
export type AchievementKind = (typeof ACHIEVEMENT_KINDS)[number];

export const ACHIEVEMENT_LEVELS = ["CLUB", "SCHOOL", "DISTRICT", "STATE", "NATIONAL", "INTERNATIONAL", "OTHER"] as const;
export type AchievementLevel = (typeof ACHIEVEMENT_LEVELS)[number];

export const ACHIEVEMENT_STATUSES = ["SUBMITTED", "REVIEWED", "VERIFIED", "REJECTED"] as const;
export type AchievementStatus = (typeof ACHIEVEMENT_STATUSES)[number];

export const LEVEL_LABELS: Record<AchievementLevel, string> = {
  CLUB: "Club", SCHOOL: "School", DISTRICT: "District", STATE: "State", NATIONAL: "National", INTERNATIONAL: "International", OTHER: "Other",
};

export const STATUS_LABELS: Record<AchievementStatus, string> = {
  SUBMITTED: "Submitted — not verified",
  REVIEWED: "Reviewed by coach — not verified",
  VERIFIED: "Verified by academy",
  REJECTED: "Not verified (rejected)",
};

/** Who is acting, relative to this athlete. COACH means coach of a batch the athlete is in. */
export type AthleteActor = "PARENT" | "COACH" | "ADMIN";

export type ReviewAction = "review" | "verify" | "reject" | "unverify";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export interface AchievementInput {
  kind: AchievementKind;
  title: string;
  competition: string | null;
  level: AchievementLevel;
  result: string | null;
  eventDate: Date;
  evidenceUrl: string | null;
  notes: string | null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const optStr = (v: unknown, max: number, label: string): Parsed<string | null> => {
  const s = str(v);
  if (!s) return { ok: true, value: null };
  if (s.length > max) return { ok: false, error: `${label} must be at most ${max} characters.` };
  return { ok: true, value: s };
};

/** "YYYY-MM-DD" (or Date) → Date at 00:00 UTC; null if invalid. */
export function parseDay(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const s = str(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

export function parseAchievementInput(raw: Record<string, unknown>, today: Date): Parsed<AchievementInput> {
  const kind = str(raw.kind) || "ACHIEVEMENT";
  if (!(ACHIEVEMENT_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Choose achievement or competition." };
  const title = str(raw.title);
  if (title.length < 3 || title.length > 120) return { ok: false, error: "Title must be 3–120 characters." };
  const level = str(raw.level) || "OTHER";
  if (!(ACHIEVEMENT_LEVELS as readonly string[]).includes(level)) return { ok: false, error: "Choose a valid level." };
  const competition = optStr(raw.competition, 120, "Competition");
  if (!competition.ok) return competition;
  const result = optStr(raw.result, 80, "Result");
  if (!result.ok) return result;
  const notes = optStr(raw.notes, 500, "Notes");
  if (!notes.ok) return notes;
  const eventDate = parseDay(raw.eventDate);
  if (!eventDate) return { ok: false, error: "Enter the date of the achievement." };
  if (eventDate.getTime() > today.getTime()) return { ok: false, error: "The date cannot be in the future." };
  if (eventDate.getUTCFullYear() < 1990) return { ok: false, error: "Enter a realistic date." };
  let evidenceUrl: string | null = null;
  if (str(raw.evidenceUrl)) {
    evidenceUrl = safeHttpUrl(str(raw.evidenceUrl));
    if (!evidenceUrl) return { ok: false, error: "Evidence link must be an http(s) URL." };
  }
  return {
    ok: true,
    value: { kind: kind as AchievementKind, title, competition: competition.value, level: level as AchievementLevel, result: result.value, eventDate, evidenceUrl, notes: notes.value },
  };
}

/**
 * Next status for a review action, or an error. Only ADMIN (academy staff with students.manage)
 * may verify, reject or unverify; coaches may only mark SUBMITTED entries as reviewed.
 */
export function nextAchievementStatus(current: string, action: ReviewAction, actor: AthleteActor, reason?: string | null): Parsed<AchievementStatus> {
  if (actor === "PARENT") return { ok: false, error: "Only academy staff can review achievements." };
  switch (action) {
    case "review":
      if (current !== "SUBMITTED") return { ok: false, error: "Only submitted entries can be marked reviewed." };
      return { ok: true, value: "REVIEWED" };
    case "verify":
      if (actor !== "ADMIN") return { ok: false, error: "Only academy staff can verify achievements." };
      if (current !== "SUBMITTED" && current !== "REVIEWED") return { ok: false, error: "This entry cannot be verified from its current status." };
      return { ok: true, value: "VERIFIED" };
    case "reject":
      if (actor !== "ADMIN") return { ok: false, error: "Only academy staff can reject achievements." };
      if (current !== "SUBMITTED" && current !== "REVIEWED") return { ok: false, error: "This entry cannot be rejected from its current status." };
      if (!str(reason) || str(reason).length < 3) return { ok: false, error: "Give a short reason." };
      return { ok: true, value: "REJECTED" };
    case "unverify":
      if (actor !== "ADMIN") return { ok: false, error: "Only academy staff can remove verification." };
      if (current !== "VERIFIED") return { ok: false, error: "Only verified entries can be unverified." };
      if (!str(reason) || str(reason).length < 3) return { ok: false, error: "Give a short reason." };
      return { ok: true, value: "REVIEWED" };
    default:
      return { ok: false, error: "Unknown action." };
  }
}

/** Parents may edit/delete only their own entries that are not reviewed/verified; staff may edit any. Admin-only delete of verified. */
export function canEditAchievement(a: { status: string; submittedById: string }, actor: AthleteActor, userId: string): boolean {
  if (actor === "ADMIN") return true;
  if (actor === "COACH") return a.status !== "VERIFIED";
  return a.submittedById === userId && (a.status === "SUBMITTED" || a.status === "REJECTED");
}

/** Any edit drops the entry back to SUBMITTED, so verification always refers to what is shown. */
export function statusAfterEdit(): AchievementStatus {
  return "SUBMITTED";
}

// ── Goals ──────────────────────────────────────────────────────────────────────

export const GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "DROPPED"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface GoalInput {
  title: string;
  metric: string | null;
  baseline: number | null;
  target: number | null;
  dueDate: Date | null;
  notes: string | null;
}

const optNum = (v: unknown): Parsed<number | null> => {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return { ok: true, value: null };
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > 1e6) return { ok: false, error: "Enter a valid number." };
  return { ok: true, value: n };
};

export function parseGoalInput(raw: Record<string, unknown>, today: Date, isNew: boolean): Parsed<GoalInput> {
  const title = str(raw.title);
  if (title.length < 3 || title.length > 120) return { ok: false, error: "Goal must be 3–120 characters." };
  const metric = optStr(raw.metric, 60, "Measure");
  if (!metric.ok) return metric;
  const baseline = optNum(raw.baseline);
  if (!baseline.ok) return baseline;
  const target = optNum(raw.target);
  if (!target.ok) return target;
  const notes = optStr(raw.notes, 500, "Notes");
  if (!notes.ok) return notes;
  let dueDate: Date | null = null;
  if (str(raw.dueDate)) {
    dueDate = parseDay(raw.dueDate);
    if (!dueDate) return { ok: false, error: "Enter a valid due date." };
    if (isNew && dueDate.getTime() < today.getTime()) return { ok: false, error: "Due date cannot be in the past." };
  }
  return { ok: true, value: { title, metric: metric.value, baseline: baseline.value, target: target.value, dueDate, notes: notes.value } };
}

export function isGoalStatus(v: unknown): v is GoalStatus {
  return typeof v === "string" && (GOAL_STATUSES as readonly string[]).includes(v);
}

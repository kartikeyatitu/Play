// V7 TRIQ Creators — pure rules. Client-safe. No follower/view numbers are ever invented here:
// the only metric is a count of stored CreatorProfileView rows.

export const CREATOR_CATEGORIES = [
  "TRAINING_TIPS",
  "MATCH_ANALYSIS",
  "HIGHLIGHTS",
  "FITNESS",
  "NUTRITION",
  "NEWS",
  "VLOG",
  "OTHER",
] as const;
export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];
export const CREATOR_CATEGORY_LABELS: Record<CreatorCategory, string> = {
  TRAINING_TIPS: "Training tips",
  MATCH_ANALYSIS: "Match analysis",
  HIGHLIGHTS: "Highlights",
  FITNESS: "Fitness",
  NUTRITION: "Nutrition",
  NEWS: "News",
  VLOG: "Vlogs",
  OTHER: "Other",
};
export const isCreatorCategory = (v: unknown): v is CreatorCategory =>
  typeof v === "string" && (CREATOR_CATEGORIES as readonly string[]).includes(v);

export const REPORT_REASONS = ["SPAM", "INAPPROPRIATE", "IMPERSONATION", "COPYRIGHT", "MINOR_SAFETY", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam or scam",
  INAPPROPRIATE: "Inappropriate content",
  IMPERSONATION: "Impersonation",
  COPYRIGHT: "Copyright",
  MINOR_SAFETY: "Child safety concern",
  OTHER: "Other",
};
export const isReportReason = (v: unknown): v is ReportReason =>
  typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);

export const REPORT_TARGETS = ["CREATOR_PROFILE", "PORTFOLIO_ITEM"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const isReportTarget = (v: unknown): v is ReportTarget =>
  typeof v === "string" && (REPORT_TARGETS as readonly string[]).includes(v);

export const REPORT_RESOLUTIONS = ["ACTIONED", "DISMISSED"] as const;

export const MAX_PORTFOLIO_ITEMS = 30;

const RESERVED_HANDLES = new Set(["me", "admin", "triq", "ops", "api", "new", "edit", "settings", "support", "help", "creators"]);

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function normalizeHandle(raw: unknown): Result<string> {
  const h = str(raw).replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(h)) return { ok: false, error: "Handle must be 3–30 letters, numbers or underscores" };
  if (RESERVED_HANDLES.has(h)) return { ok: false, error: "That handle is reserved" };
  return { ok: true, value: h };
}

export interface CreatorProfileInput {
  handle: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  sports: string[];
  categories: CreatorCategory[];
  isPublic: boolean;
  linkCoachPage: boolean;
  linkedOrgId: string | null;
}

/** `categories` may arrive as repeated form values. */
export function validateCreatorProfile(raw: Record<string, unknown>, categories: unknown[]): Result<CreatorProfileInput> {
  const handle = normalizeHandle(raw.handle);
  if (!handle.ok) return handle;
  const displayName = str(raw.displayName);
  const bio = str(raw.bio);
  const city = str(raw.city);
  if (displayName.length < 2 || displayName.length > 80) return { ok: false, error: "Display name must be 2–80 characters" };
  if (bio.length > 1000) return { ok: false, error: "Bio must be 1000 characters or fewer" };
  if (city.length > 80) return { ok: false, error: "City must be 80 characters or fewer" };
  const cats = Array.from(new Set(categories.filter(isCreatorCategory)));
  if (cats.length > 5) return { ok: false, error: "Pick up to 5 content categories" };
  const sports = Array.from(
    new Set(
      str(raw.sports)
        .split(",")
        .map((s) => s.trim().slice(0, 40))
        .filter(Boolean),
    ),
  ).slice(0, 10);
  const orgId = str(raw.linkedOrgId);
  if (orgId && !/^[a-zA-Z0-9_-]{1,64}$/.test(orgId)) return { ok: false, error: "Invalid academy" };
  const on = (v: unknown) => v === "on" || v === "true" || v === true;
  return {
    ok: true,
    value: {
      handle: handle.value,
      displayName,
      bio: bio || null,
      city: city || null,
      sports,
      categories: cats,
      isPublic: on(raw.isPublic),
      linkCoachPage: on(raw.linkCoachPage),
      linkedOrgId: orgId || null,
    },
  };
}

/** Label for where a link points, derived from the host only (no scraping, no counts). */
export function detectPlatform(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "Link";
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
  if (host.endsWith("instagram.com")) return "Instagram";
  if (host === "x.com" || host.endsWith("twitter.com")) return "X";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "Facebook";
  if (host.endsWith("linkedin.com")) return "LinkedIn";
  if (host.endsWith("threads.net")) return "Threads";
  if (host.endsWith("spotify.com")) return "Spotify";
  if (host.endsWith("substack.com")) return "Substack";
  return "Link";
}

export interface PortfolioItemInput {
  title: string;
  url: string;
  description: string | null;
  platform: string;
}

/** `safeUrl` is src/lib/safe-url.ts safeHttpUrl (injected to keep this file dependency-free). */
export function validatePortfolioItem(raw: Record<string, unknown>, safeUrl: (v: unknown) => string | null): Result<PortfolioItemInput> {
  const title = str(raw.title);
  const description = str(raw.description);
  if (title.length < 2 || title.length > 120) return { ok: false, error: "Title must be 2–120 characters" };
  if (description.length > 300) return { ok: false, error: "Description must be 300 characters or fewer" };
  const url = safeUrl(raw.url);
  if (!url) return { ok: false, error: "Enter a full link starting with https://" };
  return { ok: true, value: { title, url, description: description || null, platform: detectPlatform(url) } };
}

export function validateReport(raw: Record<string, unknown>): Result<{ targetType: ReportTarget; targetId: string; reason: ReportReason; details: string | null }> {
  if (!isReportTarget(raw.targetType)) return { ok: false, error: "Invalid report" };
  const targetId = str(raw.targetId);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(targetId)) return { ok: false, error: "Invalid report" };
  if (!isReportReason(raw.reason)) return { ok: false, error: "Choose a reason" };
  const details = str(raw.details);
  if (details.length > 1000) return { ok: false, error: "Details must be 1000 characters or fewer" };
  return { ok: true, value: { targetType: raw.targetType, targetId, reason: raw.reason, details: details || null } };
}

/** Public visibility rule for a profile. */
export function isProfileVisible(p: { isPublic: boolean; hiddenAt: Date | null }): boolean {
  return p.isPublic && !p.hiddenAt;
}

/** Counts stored view events within the last `days` (events are passed in; nothing is estimated). */
export function countViewsSince(viewTimes: Date[], days: number, now: Date): number {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  return viewTimes.filter((t) => t.getTime() >= since).length;
}

/** Start of the current IST day as a UTC Date (used to de-duplicate signed-in views per day). */
export function istDayStart(now: Date): Date {
  const offset = (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(now.getTime() + offset);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - offset);
}

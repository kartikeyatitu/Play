// TRIQ Brand Studio (V9) — pure rules for sponsors, campaigns, proposals and deliverables.
// Client- and server-safe. Server actions: src/app/actions/brand-studio.ts.

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export const SPONSOR_KINDS = ["BRAND", "LOCAL_BUSINESS", "CSR_FOUNDATION", "INDIVIDUAL", "OTHER"] as const;
export const CAMPAIGN_SCOPES = ["ATHLETE", "TEAM", "ACADEMY", "EVENT"] as const;
export const APPLICANT_TYPES = ["ATHLETE", "TEAM", "ACADEMY", "EVENT", "ORGANIZER"] as const;
export const DELIVERABLE_KINDS = ["DELIVERABLE", "MILESTONE"] as const;

export const CAMPAIGN_STATUSES = ["DRAFT", "OPEN", "CLOSED", "COMPLETED", "CANCELLED"] as const;
export const PROPOSAL_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
export const DELIVERABLE_STATUSES = ["PENDING", "IN_PROGRESS", "DELIVERED", "VERIFIED", "MISSED"] as const;
export const PROGRAM_STATUSES = ["DRAFT", "ACTIVE", "CLOSED"] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];
export type StatusEntity = "CAMPAIGN" | "PROPOSAL" | "DELIVERABLE" | "PROGRAM";

export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  CLOSED: ["OPEN", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** ACCEPTED is only reachable through acceptProposal (needs funding.approve + confirmation). */
export const PROPOSAL_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const DELIVERABLE_TRANSITIONS: Record<DeliverableStatus, readonly DeliverableStatus[]> = {
  PENDING: ["IN_PROGRESS", "DELIVERED", "MISSED"],
  IN_PROGRESS: ["DELIVERED", "MISSED"],
  DELIVERED: ["VERIFIED", "IN_PROGRESS"],
  VERIFIED: [],
  MISSED: ["IN_PROGRESS"],
};

export const PROGRAM_TRANSITIONS: Record<ProgramStatus, readonly ProgramStatus[]> = {
  DRAFT: ["ACTIVE", "CLOSED"],
  ACTIVE: ["CLOSED"],
  CLOSED: [],
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
  VERIFIED: "Verified",
  MISSED: "Missed",
  ACTIVE: "Active",
};

const has = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
export const isCampaignStatus = (v: unknown): v is CampaignStatus => has(CAMPAIGN_STATUSES, v);
export const isProposalStatus = (v: unknown): v is ProposalStatus => has(PROPOSAL_STATUSES, v);
export const isDeliverableStatus = (v: unknown): v is DeliverableStatus => has(DELIVERABLE_STATUSES, v);
export const isProgramStatus = (v: unknown): v is ProgramStatus => has(PROGRAM_STATUSES, v);

export function canMoveCampaign(from: string, to: string) {
  return isCampaignStatus(from) && isCampaignStatus(to) && CAMPAIGN_TRANSITIONS[from].includes(to);
}
export function canMoveProposal(from: string, to: string) {
  return isProposalStatus(from) && isProposalStatus(to) && PROPOSAL_TRANSITIONS[from].includes(to);
}
export function canMoveDeliverable(from: string, to: string) {
  return isDeliverableStatus(from) && isDeliverableStatus(to) && DELIVERABLE_TRANSITIONS[from].includes(to);
}
export function canMoveProgram(from: string, to: string) {
  return isProgramStatus(from) && isProgramStatus(to) && PROGRAM_TRANSITIONS[from].includes(to);
}

/** Proposals can be submitted only to OPEN campaigns, and accepted while OPEN or CLOSED. */
export const canSubmitTo = (campaignStatus: string) => campaignStatus === "OPEN";
export const canAcceptIn = (campaignStatus: string) => campaignStatus === "OPEN" || campaignStatus === "CLOSED";

export const MAX_BUDGET_RUPEES = 10_000_000; // ₹1 crore

/** Whole rupees from user input → paise. */
export function rupeesToPaise(v: unknown, { min = 0, max = MAX_BUDGET_RUPEES } = {}): Validated<number> {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max)
    return { ok: false, error: `Enter a whole amount between ₹${min} and ₹${max.toLocaleString("en-IN")}` };
  return { ok: true, value: n * 100 };
}

export function remainingBudgetPaise(budgetPaise: number, committedPaise: number) {
  return Math.max(0, budgetPaise - committedPaise);
}

/**
 * The checks an authorised approver must pass before a proposal is accepted with money attached.
 * The server repeats the budget check inside one conditional UPDATE so concurrent accepts cannot over-commit.
 */
export function checkCommitment(opts: {
  approvedPaise: number;
  confirmPaise: number;
  budgetPaise: number;
  committedPaise: number;
}): Validated<number> {
  if (!Number.isInteger(opts.approvedPaise) || opts.approvedPaise < 0) return { ok: false, error: "Invalid amount" };
  if (opts.approvedPaise !== opts.confirmPaise) return { ok: false, error: "Amounts do not match. Re-type the approved amount to confirm." };
  const remaining = remainingBudgetPaise(opts.budgetPaise, opts.committedPaise);
  if (opts.approvedPaise > remaining) return { ok: false, error: `Budget exceeded: only ₹${(remaining / 100).toLocaleString("en-IN")} left in this campaign` };
  return { ok: true, value: opts.committedPaise + opts.approvedPaise };
}

/** Deliverable progress from real rows only. */
export function deliverableProgress(statuses: string[]) {
  const total = statuses.length;
  const done = statuses.filter((s) => s === "DELIVERED" || s === "VERIFIED").length;
  const verified = statuses.filter((s) => s === "VERIFIED").length;
  const missed = statuses.filter((s) => s === "MISSED").length;
  return { total, done, verified, missed };
}

// ── Input validation ─────────────────────────────────────────────────────────────

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max + 1) : "";
}
function optStr(v: unknown, max: number): string | null | false {
  const s = str(v, max);
  if (s.length > max) return false;
  return s || null;
}

export function safeHttpUrlOrNull(v: unknown): string | null | false {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : false;
  } catch {
    return false;
  }
}

function parseDate(v: unknown): Date | null | false {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? false : d;
}

export interface SponsorInput {
  name: string;
  kind: (typeof SPONSOR_KINDS)[number];
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  about: string | null;
}

export function validateSponsorInput(raw: Record<string, unknown>): Validated<SponsorInput> {
  const name = str(raw.name, 120);
  if (!name || name.length > 120) return { ok: false, error: "Sponsor name is required (max 120 characters)" };
  const kind = raw.kind ?? "BRAND";
  if (!has(SPONSOR_KINDS, kind)) return { ok: false, error: "Choose a sponsor type" };
  const contactName = optStr(raw.contactName, 120);
  if (contactName === false) return { ok: false, error: "Contact name is too long" };
  const contactEmail = optStr(raw.contactEmail, 200);
  if (contactEmail === false || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) return { ok: false, error: "Enter a valid email" };
  const contactPhone = optStr(raw.contactPhone, 20);
  if (contactPhone === false || (contactPhone && !/^[+\d][\d\s-]{6,19}$/.test(contactPhone))) return { ok: false, error: "Enter a valid phone number" };
  const website = safeHttpUrlOrNull(raw.website);
  if (website === false) return { ok: false, error: "Website must start with http:// or https://" };
  const about = optStr(raw.about, 1000);
  if (about === false) return { ok: false, error: "About is too long (max 1000 characters)" };
  return { ok: true, value: { name, kind, contactName, contactEmail, contactPhone, website, about } };
}

export interface CampaignInput {
  title: string;
  scope: (typeof CAMPAIGN_SCOPES)[number];
  sponsorId: string | null;
  objective: string;
  targetAudience: string | null;
  budgetPaise: number;
  deliverablesSummary: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

export function validateCampaignInput(raw: Record<string, unknown>): Validated<CampaignInput> {
  const title = str(raw.title, 120);
  if (!title || title.length > 120) return { ok: false, error: "Title is required (max 120 characters)" };
  if (!has(CAMPAIGN_SCOPES, raw.scope)) return { ok: false, error: "Choose who the campaign sponsors" };
  const objective = str(raw.objective, 1000);
  if (!objective || objective.length > 1000) return { ok: false, error: "Objective is required (max 1000 characters)" };
  const targetAudience = optStr(raw.targetAudience, 300);
  if (targetAudience === false) return { ok: false, error: "Target audience is too long" };
  const budget = rupeesToPaise(raw.budget);
  if (!budget.ok) return budget;
  const deliverablesSummary = optStr(raw.deliverablesSummary, 1000);
  if (deliverablesSummary === false) return { ok: false, error: "Deliverables summary is too long" };
  const startDate = parseDate(raw.startDate);
  const endDate = parseDate(raw.endDate);
  if (startDate === false || endDate === false) return { ok: false, error: "Dates must be YYYY-MM-DD" };
  if (startDate && endDate && endDate < startDate) return { ok: false, error: "End date must be on or after the start date" };
  const sponsorId = typeof raw.sponsorId === "string" && raw.sponsorId ? raw.sponsorId : null;
  return {
    ok: true,
    value: { title, scope: raw.scope, sponsorId, objective, targetAudience, budgetPaise: budget.value, deliverablesSummary, startDate, endDate },
  };
}

export interface ProposalInput {
  campaignId: string;
  applicantType: (typeof APPLICANT_TYPES)[number];
  applicantName: string;
  studentId: string | null;
  pitch: string;
  askPaise: number;
}

export function validateProposalInput(raw: Record<string, unknown>): Validated<ProposalInput> {
  const campaignId = typeof raw.campaignId === "string" ? raw.campaignId : "";
  if (!campaignId) return { ok: false, error: "Campaign is required" };
  if (!has(APPLICANT_TYPES, raw.applicantType)) return { ok: false, error: "Choose who is applying" };
  const applicantName = str(raw.applicantName, 120);
  if (!applicantName || applicantName.length > 120) return { ok: false, error: "Applicant name is required (max 120 characters)" };
  const pitch = str(raw.pitch, 2000);
  if (!pitch || pitch.length > 2000) return { ok: false, error: "Pitch is required (max 2000 characters)" };
  const ask = rupeesToPaise(raw.ask);
  if (!ask.ok) return ask;
  const studentId = typeof raw.studentId === "string" && raw.studentId ? raw.studentId : null;
  return { ok: true, value: { campaignId, applicantType: raw.applicantType, applicantName, studentId, pitch, askPaise: ask.value } };
}

export interface DeliverableInput {
  proposalId: string;
  title: string;
  kind: (typeof DELIVERABLE_KINDS)[number];
  dueDate: Date | null;
}

export function validateDeliverableInput(raw: Record<string, unknown>): Validated<DeliverableInput> {
  const proposalId = typeof raw.proposalId === "string" ? raw.proposalId : "";
  if (!proposalId) return { ok: false, error: "Proposal is required" };
  const title = str(raw.title, 200);
  if (!title || title.length > 200) return { ok: false, error: "Title is required (max 200 characters)" };
  const kind = raw.kind ?? "DELIVERABLE";
  if (!has(DELIVERABLE_KINDS, kind)) return { ok: false, error: "Choose deliverable or milestone" };
  const dueDate = parseDate(raw.dueDate);
  if (dueDate === false) return { ok: false, error: "Due date must be YYYY-MM-DD" };
  return { ok: true, value: { proposalId, title, kind, dueDate } };
}

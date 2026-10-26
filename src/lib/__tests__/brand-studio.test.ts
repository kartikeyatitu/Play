import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_STATUSES,
  PROPOSAL_STATUSES,
  DELIVERABLE_STATUSES,
  canMoveCampaign,
  canMoveProposal,
  canMoveDeliverable,
  canMoveProgram,
  canSubmitTo,
  canAcceptIn,
  checkCommitment,
  remainingBudgetPaise,
  rupeesToPaise,
  deliverableProgress,
  validateSponsorInput,
  validateCampaignInput,
  validateProposalInput,
  validateDeliverableInput,
  safeHttpUrlOrNull,
} from "@/lib/brand-studio";

function matrix(statuses: readonly string[], fn: (a: string, b: string) => boolean) {
  const out: string[] = [];
  for (const a of statuses) for (const b of statuses) if (fn(a, b)) out.push(`${a}>${b}`);
  return out.sort();
}

describe("status machines", () => {
  it("campaign", () => {
    expect(matrix(CAMPAIGN_STATUSES, canMoveCampaign)).toEqual(
      ["DRAFT>OPEN", "DRAFT>CANCELLED", "OPEN>CLOSED", "OPEN>CANCELLED", "CLOSED>OPEN", "CLOSED>COMPLETED", "CLOSED>CANCELLED"].sort(),
    );
  });
  it("proposal", () => {
    expect(matrix(PROPOSAL_STATUSES, canMoveProposal)).toEqual(
      [
        "SUBMITTED>UNDER_REVIEW",
        "SUBMITTED>REJECTED",
        "SUBMITTED>WITHDRAWN",
        "UNDER_REVIEW>ACCEPTED",
        "UNDER_REVIEW>REJECTED",
        "UNDER_REVIEW>WITHDRAWN",
      ].sort(),
    );
    expect(canMoveProposal("SUBMITTED", "ACCEPTED")).toBe(false); // must be reviewed first
    expect(canMoveProposal("ACCEPTED", "REJECTED")).toBe(false);
  });
  it("deliverable", () => {
    expect(matrix(DELIVERABLE_STATUSES, canMoveDeliverable)).toEqual(
      [
        "PENDING>IN_PROGRESS",
        "PENDING>DELIVERED",
        "PENDING>MISSED",
        "IN_PROGRESS>DELIVERED",
        "IN_PROGRESS>MISSED",
        "DELIVERED>VERIFIED",
        "DELIVERED>IN_PROGRESS",
        "MISSED>IN_PROGRESS",
      ].sort(),
    );
  });
  it("program", () => {
    expect(canMoveProgram("DRAFT", "ACTIVE")).toBe(true);
    expect(canMoveProgram("ACTIVE", "CLOSED")).toBe(true);
    expect(canMoveProgram("CLOSED", "ACTIVE")).toBe(false);
    expect(canMoveProgram("ACTIVE", "DRAFT")).toBe(false);
  });
  it("submission and acceptance windows", () => {
    expect(canSubmitTo("OPEN")).toBe(true);
    expect(canSubmitTo("DRAFT")).toBe(false);
    expect(canSubmitTo("CLOSED")).toBe(false);
    expect(canAcceptIn("CLOSED")).toBe(true);
    expect(canAcceptIn("CANCELLED")).toBe(false);
  });
});

describe("money commitments", () => {
  it("converts whole rupees to paise", () => {
    expect(rupeesToPaise("50000")).toEqual({ ok: true, value: 5_000_000 });
    expect(rupeesToPaise(0)).toEqual({ ok: true, value: 0 });
    expect(rupeesToPaise(-1).ok).toBe(false);
    expect(rupeesToPaise(10.5).ok).toBe(false);
    expect(rupeesToPaise("abc").ok).toBe(false);
    expect(rupeesToPaise(100_000_000).ok).toBe(false);
  });
  it("requires matching confirmation and remaining budget", () => {
    const base = { budgetPaise: 5_000_000, committedPaise: 2_000_000 };
    expect(checkCommitment({ ...base, approvedPaise: 3_000_000, confirmPaise: 3_000_000 })).toEqual({ ok: true, value: 5_000_000 });
    expect(checkCommitment({ ...base, approvedPaise: 3_000_100, confirmPaise: 3_000_100 }).ok).toBe(false);
    expect(checkCommitment({ ...base, approvedPaise: 1_000_000, confirmPaise: 100_000 }).ok).toBe(false);
    expect(checkCommitment({ ...base, approvedPaise: -1, confirmPaise: -1 }).ok).toBe(false);
    expect(checkCommitment({ ...base, approvedPaise: 0, confirmPaise: 0 }).ok).toBe(true); // in-kind deal
  });
  it("remaining budget never negative", () => {
    expect(remainingBudgetPaise(100, 150)).toBe(0);
    expect(remainingBudgetPaise(100, 40)).toBe(60);
  });
  it("progress counts real statuses", () => {
    expect(deliverableProgress(["PENDING", "DELIVERED", "VERIFIED", "MISSED"])).toEqual({ total: 4, done: 2, verified: 1, missed: 1 });
    expect(deliverableProgress([])).toEqual({ total: 0, done: 0, verified: 0, missed: 0 });
  });
});

describe("validation", () => {
  it("sponsor", () => {
    expect(validateSponsorInput({ name: " City Sports ", kind: "LOCAL_BUSINESS", website: "https://city.example" }).ok).toBe(true);
    expect(validateSponsorInput({ name: "" }).ok).toBe(false);
    expect(validateSponsorInput({ name: "A", kind: "MEGACORP" }).ok).toBe(false);
    expect(validateSponsorInput({ name: "A", contactEmail: "nope" }).ok).toBe(false);
    expect(validateSponsorInput({ name: "A", website: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateSponsorInput({ name: "A", contactPhone: "+91 98765 43210" }).ok).toBe(true);
  });
  it("campaign", () => {
    const ok = { title: "U-14 jersey partner", scope: "TEAM", objective: "Kit for 20 players", budget: "50000", startDate: "2026-11-01", endDate: "2027-03-31" };
    const r = validateCampaignInput(ok);
    expect(r.ok && r.value.budgetPaise).toBe(5_000_000);
    expect(validateCampaignInput({ ...ok, endDate: "2026-10-01" }).ok).toBe(false);
    expect(validateCampaignInput({ ...ok, startDate: "2026-02-30" }).ok).toBe(false);
    expect(validateCampaignInput({ ...ok, scope: "PLANET" }).ok).toBe(false);
    expect(validateCampaignInput({ ...ok, objective: "" }).ok).toBe(false);
  });
  it("proposal", () => {
    expect(validateProposalInput({ campaignId: "c1", applicantType: "TEAM", applicantName: "U-14", pitch: "We play", ask: "30000" }).ok).toBe(true);
    expect(validateProposalInput({ campaignId: "", applicantType: "TEAM", applicantName: "U-14", pitch: "x", ask: 1 }).ok).toBe(false);
    expect(validateProposalInput({ campaignId: "c1", applicantType: "TEAM", applicantName: "U-14", pitch: "", ask: 1 }).ok).toBe(false);
  });
  it("deliverable", () => {
    expect(validateDeliverableInput({ proposalId: "p", title: "Logo on jersey", kind: "MILESTONE", dueDate: "2026-12-01" }).ok).toBe(true);
    expect(validateDeliverableInput({ proposalId: "p", title: "", kind: "MILESTONE" }).ok).toBe(false);
    expect(validateDeliverableInput({ proposalId: "p", title: "x", dueDate: "tomorrow" }).ok).toBe(false);
  });
  it("urls", () => {
    expect(safeHttpUrlOrNull("")).toBe(null);
    expect(safeHttpUrlOrNull("ftp://x")).toBe(false);
    expect(safeHttpUrlOrNull("https://a.b/c")).toBe("https://a.b/c");
  });
});

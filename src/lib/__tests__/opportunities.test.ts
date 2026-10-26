import { describe, it, expect } from "vitest";
import {
  ageOn,
  canChangeOpportunityStatus,
  canTransitionApplication,
  checkEligibility,
  parseOpportunityInput,
} from "@/lib/opportunities";

const today = new Date("2026-10-26T00:00:00.000Z");
const base = { title: "U-16 state trials", kind: "TRIAL", applyBy: "2026-11-10", startDate: "2026-11-15", ageMin: "12", ageMax: "16" };

describe("parseOpportunityInput", () => {
  it("accepts a valid trial", () => {
    const r = parseOpportunityInput(base, today, { publishing: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.ageMin).toBe(12);
  });
  it("rejects past apply-by only when publishing", () => {
    const past = { ...base, applyBy: "2026-10-01", startDate: "" };
    expect(parseOpportunityInput(past, today, { publishing: true }).ok).toBe(false);
    expect(parseOpportunityInput(past, today, { publishing: false }).ok).toBe(true);
  });
  it("rejects inverted dates / ages and unsafe links", () => {
    expect(parseOpportunityInput({ ...base, endDate: "2026-11-14" }, today, { publishing: false }).ok).toBe(false);
    expect(parseOpportunityInput({ ...base, applyBy: "2026-11-20" }, today, { publishing: false }).ok).toBe(false);
    expect(parseOpportunityInput({ ...base, ageMin: "17" }, today, { publishing: false }).ok).toBe(false);
    expect(parseOpportunityInput({ ...base, ageMin: "1" }, today, { publishing: false }).ok).toBe(false);
    expect(parseOpportunityInput({ ...base, url: "javascript:alert(1)" }, today, { publishing: false }).ok).toBe(false);
    expect(parseOpportunityInput({ ...base, kind: "LOTTERY" }, today, { publishing: false }).ok).toBe(false);
  });
});

describe("ageOn", () => {
  it("counts whole years, before and after the birthday", () => {
    expect(ageOn("2012-11-15", new Date("2026-11-14T00:00:00Z"))).toBe(13);
    expect(ageOn("2012-11-15", new Date("2026-11-15T00:00:00Z"))).toBe(14);
  });
});

describe("checkEligibility", () => {
  const opp = { status: "OPEN", applyBy: "2026-11-10T00:00:00Z", startDate: "2026-11-15T00:00:00Z", ageMin: 12, ageMax: 16, batchId: "b1" };
  it("requires open status, deadline, batch and age band", () => {
    expect(checkEligibility(opp, { dob: "2012-01-01", batchIds: ["b1"] }, today)).toEqual({ ok: true, ageUnknown: false });
    expect(checkEligibility({ ...opp, status: "CLOSED" }, { dob: "2012-01-01", batchIds: ["b1"] }, today).ok).toBe(false);
    expect(checkEligibility(opp, { dob: "2012-01-01", batchIds: ["b2"] }, today).ok).toBe(false);
    expect(checkEligibility(opp, { dob: "2016-01-01", batchIds: ["b1"] }, today).ok).toBe(false);
    expect(checkEligibility(opp, { dob: "2008-01-01", batchIds: ["b1"] }, today).ok).toBe(false);
    expect(checkEligibility(opp, { dob: "2012-01-01", batchIds: ["b1"] }, new Date("2026-11-11T00:00:00Z")).ok).toBe(false);
  });
  it("allows but flags a missing date of birth when an age band exists", () => {
    expect(checkEligibility(opp, { dob: null, batchIds: ["b1"] }, today)).toEqual({ ok: true, ageUnknown: true });
    expect(checkEligibility({ ...opp, ageMin: null, ageMax: null, batchId: null }, { dob: null, batchIds: [] }, today)).toEqual({ ok: true, ageUnknown: false });
  });
});

describe("status rules", () => {
  it("applications follow the pipeline and only guardians withdraw", () => {
    expect(canTransitionApplication("APPLIED", "SHORTLISTED", "STAFF")).toBe(true);
    expect(canTransitionApplication("APPLIED", "SELECTED", "STAFF")).toBe(false);
    expect(canTransitionApplication("SHORTLISTED", "SELECTED", "STAFF")).toBe(true);
    expect(canTransitionApplication("SELECTED", "NOT_SELECTED", "STAFF")).toBe(false);
    expect(canTransitionApplication("APPLIED", "WITHDRAWN", "STAFF")).toBe(false);
    expect(canTransitionApplication("APPLIED", "WITHDRAWN", "GUARDIAN")).toBe(true);
    expect(canTransitionApplication("SELECTED", "WITHDRAWN", "GUARDIAN")).toBe(false);
    expect(canTransitionApplication("APPLIED", "SHORTLISTED", "GUARDIAN")).toBe(false);
  });
  it("opportunities move draft → open → closed → open", () => {
    expect(canChangeOpportunityStatus("DRAFT", "OPEN")).toBe(true);
    expect(canChangeOpportunityStatus("OPEN", "CLOSED")).toBe(true);
    expect(canChangeOpportunityStatus("CLOSED", "OPEN")).toBe(true);
    expect(canChangeOpportunityStatus("OPEN", "DRAFT")).toBe(false);
    expect(canChangeOpportunityStatus("DRAFT", "CLOSED")).toBe(false);
  });
});

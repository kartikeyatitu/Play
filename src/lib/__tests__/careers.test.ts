import { describe, it, expect } from "vitest";
import {
  allowedApplicationMoves,
  canTransitionApplication,
  canTransitionJob,
  validateJob,
  validateExperience,
  validateCredential,
  validateProfile,
  validateCoverNote,
  payBand,
  parseList,
} from "@/lib/careers";
import { safeHttpUrl } from "@/lib/safe-url";
import { shouldIndexCoach } from "@/lib/coach-public";

describe("application pipeline", () => {
  it("lets employers move forward and reject, never backwards", () => {
    expect(canTransitionApplication("APPLIED", "SHORTLISTED", "EMPLOYER")).toBe(true);
    expect(canTransitionApplication("SHORTLISTED", "INTERVIEW", "EMPLOYER")).toBe(true);
    expect(canTransitionApplication("INTERVIEW", "OFFERED", "EMPLOYER")).toBe(true);
    expect(canTransitionApplication("OFFERED", "HIRED", "EMPLOYER")).toBe(true);
    expect(canTransitionApplication("INTERVIEW", "APPLIED", "EMPLOYER")).toBe(false);
    expect(canTransitionApplication("APPLIED", "HIRED", "EMPLOYER")).toBe(false);
  });

  it("treats HIRED, REJECTED and WITHDRAWN as terminal", () => {
    for (const s of ["HIRED", "REJECTED", "WITHDRAWN"]) {
      expect(allowedApplicationMoves(s, "EMPLOYER")).toEqual([]);
      expect(allowedApplicationMoves(s, "APPLICANT")).toEqual([]);
    }
  });

  it("only lets applicants withdraw", () => {
    expect(allowedApplicationMoves("INTERVIEW", "APPLICANT")).toEqual(["WITHDRAWN"]);
    expect(canTransitionApplication("APPLIED", "SHORTLISTED", "APPLICANT")).toBe(false);
    expect(canTransitionApplication("APPLIED", "WITHDRAWN", "EMPLOYER")).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(canTransitionApplication("BOGUS", "SHORTLISTED", "EMPLOYER")).toBe(false);
    expect(canTransitionApplication("APPLIED", "BOGUS", "EMPLOYER")).toBe(false);
  });
});

describe("job status", () => {
  it("follows DRAFT → OPEN → CLOSED and allows reopening", () => {
    expect(canTransitionJob("DRAFT", "OPEN")).toBe(true);
    expect(canTransitionJob("OPEN", "CLOSED")).toBe(true);
    expect(canTransitionJob("CLOSED", "OPEN")).toBe(true);
    expect(canTransitionJob("DRAFT", "CLOSED")).toBe(false);
    expect(canTransitionJob("OPEN", "DRAFT")).toBe(false);
    expect(canTransitionJob("OPEN", "OPEN")).toBe(false);
  });
});

describe("validation", () => {
  const job = {
    title: "Cricket coach",
    role: "COACH",
    employmentType: "FULL_TIME",
    city: "Noida",
    description: "Coach U-14 and U-16 batches four evenings a week.",
  };

  it("accepts a valid job and normalises empties to null", () => {
    const r = validateJob({ ...job, sport: " ", payMin: "20000", payMax: "30000" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sport).toBeNull();
      expect(r.value.payMin).toBe(20000);
    }
  });

  it("rejects bad roles, short descriptions and inverted pay", () => {
    expect(validateJob({ ...job, role: "CEO" }).ok).toBe(false);
    expect(validateJob({ ...job, description: "short" }).ok).toBe(false);
    expect(validateJob({ ...job, payMin: "40000", payMax: "30000" }).ok).toBe(false);
    expect(validateJob({ ...job, payMin: "-5" }).ok).toBe(false);
  });

  it("checks experience years", () => {
    expect(validateExperience({ title: "Coach", organization: "ABC Academy", startYear: "2019" }, 2026).ok).toBe(true);
    expect(validateExperience({ title: "Coach", organization: "ABC Academy", startYear: "2019", endYear: "2017" }, 2026).ok).toBe(false);
    expect(validateExperience({ title: "Coach", organization: "ABC Academy", startYear: "2030" }, 2026).ok).toBe(false);
  });

  it("only accepts http(s) evidence links", () => {
    const base = { kind: "CERTIFICATION", title: "BCCI Level 1" };
    expect(validateCredential({ ...base, evidenceUrl: "https://example.org/cert.pdf" }, safeHttpUrl).ok).toBe(true);
    expect(validateCredential({ ...base, evidenceUrl: "javascript:alert(1)" }, safeHttpUrl).ok).toBe(false);
    expect(validateCredential({ ...base, kind: "DEGREE" }, safeHttpUrl).ok).toBe(false);
  });

  it("parses profile with private default", () => {
    const r = validateProfile({ headline: "Football coach", sports: "Football, football , Futsal", yearsExperience: "6" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.isPublic).toBe(false);
      expect(r.value.sports).toEqual(["Football", "football", "Futsal"]);
    }
    expect(validateProfile({ yearsExperience: "99" }).ok).toBe(false);
  });

  it("limits cover notes", () => {
    expect(validateCoverNote("x".repeat(2001)).ok).toBe(false);
    expect(validateCoverNote("  ")).toEqual({ ok: true, value: null });
  });

  it("caps list sizes", () => {
    expect(parseList("a,b,c,d", 2)).toEqual(["a", "b"]);
  });
});

describe("pay band", () => {
  it("formats ranges and open ends", () => {
    expect(payBand(null, null)).toBeNull();
    expect(payBand(20000, 30000)).toContain("20,000");
    expect(payBand(20000, null)).toMatch(/^From/);
    expect(payBand(null, 30000)).toMatch(/^Up to/);
  });
});

describe("coach page indexing", () => {
  it("never indexes while Coach OS is off", () => {
    expect(shouldIndexCoach({ coachOS: false, verified: true })).toBe(false);
    expect(shouldIndexCoach({ coachOS: true, verified: false })).toBe(false);
    expect(shouldIndexCoach({ coachOS: true, verified: true })).toBe(true);
  });
});

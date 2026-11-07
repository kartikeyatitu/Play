import { describe, it, expect } from "vitest";
import { consentRowsToAppend, consentSummary, hasConsent, latestConsentRow, type ConsentRow } from "@/lib/consent/ledger";
import { CONSENT_METHOD_ENROLMENT_OTP, CONSENT_NOTICE_VERSION, CONSENT_PURPOSES, isConsentPurpose } from "@/lib/consent/purposes";

const t = (iso: string) => new Date(iso);
const grant = (purpose: string, at: string, extra: Partial<ConsentRow> = {}): ConsentRow => ({
  studentId: "s1",
  purpose,
  granted: true,
  grantedAt: t(at),
  withdrawnAt: null,
  noticeVersion: "v1",
  createdAt: t(at),
  ...extra,
});
const withdraw = (purpose: string, at: string, extra: Partial<ConsentRow> = {}): ConsentRow => ({
  studentId: "s1",
  purpose,
  granted: false,
  grantedAt: null,
  withdrawnAt: t(at),
  noticeVersion: "v1",
  createdAt: t(at),
  ...extra,
});

describe("purposes", () => {
  it("has the eight canonical purposes, AI_PROCESSING included", () => {
    expect(CONSENT_PURPOSES).toHaveLength(8);
    expect(isConsentPurpose("AI_PROCESSING")).toBe(true);
    expect(isConsentPurpose("ai_assistance")).toBe(false);
    expect(isConsentPurpose("MARKETING")).toBe(false);
  });
});

describe("hasConsent", () => {
  it("is false with no rows", () => {
    expect(hasConsent([], "s1", "AI_PROCESSING")).toBe(false);
  });
  it("is true after a grant and false after a later withdrawal row", () => {
    const rows = [grant("AI_PROCESSING", "2026-11-01T10:00:00Z")];
    expect(hasConsent(rows, "s1", "AI_PROCESSING")).toBe(true);
    rows.push(withdraw("AI_PROCESSING", "2026-11-02T10:00:00Z"));
    expect(hasConsent(rows, "s1", "AI_PROCESSING")).toBe(false);
  });
  it("a new grant after a withdrawal restores consent", () => {
    const rows = [grant("LEADERBOARDS", "2026-11-01T00:00:00Z"), withdraw("LEADERBOARDS", "2026-11-02T00:00:00Z"), grant("LEADERBOARDS", "2026-11-03T00:00:00Z")];
    expect(hasConsent(rows, "s1", "LEADERBOARDS")).toBe(true);
  });
  it("does not depend on input order", () => {
    const rows = [withdraw("MEDIA_PUBLIC", "2026-11-05T00:00:00Z"), grant("MEDIA_PUBLIC", "2026-11-01T00:00:00Z")];
    expect(hasConsent(rows, "s1", "MEDIA_PUBLIC")).toBe(false);
  });
  it("is scoped to the child and the purpose", () => {
    const rows = [grant("AI_PROCESSING", "2026-11-01T00:00:00Z", { studentId: "s2" }), grant("MEDIA_BATCH", "2026-11-01T00:00:00Z")];
    expect(hasConsent(rows, "s1", "AI_PROCESSING")).toBe(false);
    expect(hasConsent(rows, "s2", "AI_PROCESSING")).toBe(true);
    expect(hasConsent(rows, "s1", "MEDIA_BATCH")).toBe(true);
  });
  it("a withdrawal wins an exact tie (fail closed)", () => {
    const at = "2026-11-01T00:00:00Z";
    expect(hasConsent([grant("MARKETING_TO_PARENT", at), withdraw("MARKETING_TO_PARENT", at)], "s1", "MARKETING_TO_PARENT")).toBe(false);
    expect(hasConsent([withdraw("MARKETING_TO_PARENT", at), grant("MARKETING_TO_PARENT", at)], "s1", "MARKETING_TO_PARENT")).toBe(false);
  });
  it("a row that is granted but carries withdrawnAt is not consent", () => {
    expect(hasConsent([grant("CORE_SERVICE", "2026-11-01T00:00:00Z", { withdrawnAt: t("2026-11-02T00:00:00Z") })], "s1", "CORE_SERVICE")).toBe(false);
  });
  it("respects a required notice version", () => {
    const rows = [grant("PROGRESS_SHARING", "2026-11-01T00:00:00Z", { noticeVersion: "v1" })];
    expect(hasConsent(rows, "s1", "PROGRESS_SHARING", { noticeVersion: "v1" })).toBe(true);
    expect(hasConsent(rows, "s1", "PROGRESS_SHARING", { noticeVersion: "v2" })).toBe(false);
  });
  it("answers as of a past time", () => {
    const rows = [grant("AI_PROCESSING", "2026-11-01T00:00:00Z"), withdraw("AI_PROCESSING", "2026-11-10T00:00:00Z")];
    expect(hasConsent(rows, "s1", "AI_PROCESSING", { at: t("2026-11-05T00:00:00Z") })).toBe(true);
    expect(hasConsent(rows, "s1", "AI_PROCESSING", { at: t("2026-10-01T00:00:00Z") })).toBe(false);
  });
  it("the latest action of either guardian decides", () => {
    const rows = [
      grant("MEDIA_INTERNAL", "2026-11-01T00:00:00Z", { guardianUserId: "mum" }),
      withdraw("MEDIA_INTERNAL", "2026-11-02T00:00:00Z", { guardianUserId: "dad" }),
    ];
    expect(hasConsent(rows, "s1", "MEDIA_INTERNAL")).toBe(false);
    expect(latestConsentRow(rows, "s1", "MEDIA_INTERNAL")?.guardianUserId).toBe("dad");
  });
});

describe("consentSummary", () => {
  it("reports every purpose", () => {
    const s = consentSummary([grant("AI_PROCESSING", "2026-11-01T00:00:00Z"), withdraw("LEADERBOARDS", "2026-11-02T00:00:00Z")], "s1");
    expect(Object.keys(s)).toHaveLength(8);
    expect(s.AI_PROCESSING.state).toBe("GRANTED");
    expect(s.LEADERBOARDS.state).toBe("WITHDRAWN");
    expect(s.MEDIA_PUBLIC).toEqual({ state: "NOT_ASKED", since: null });
  });
});

describe("consentRowsToAppend (append-only)", () => {
  const ctx = { orgId: "o1", studentId: "s1", guardianUserId: "g1", now: t("2026-11-07T00:00:00Z") };
  it("appends a grant row and a withdrawal row, never an update", () => {
    const rows = consentRowsToAppend([grant("LEADERBOARDS", "2026-11-01T00:00:00Z")], ctx, [
      { purpose: "AI_PROCESSING", granted: true },
      { purpose: "LEADERBOARDS", granted: false },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ purpose: "AI_PROCESSING", granted: true, grantedAt: ctx.now, withdrawnAt: null, method: CONSENT_METHOD_ENROLMENT_OTP, noticeVersion: CONSENT_NOTICE_VERSION }),
      expect.objectContaining({ purpose: "LEADERBOARDS", granted: false, grantedAt: null, withdrawnAt: ctx.now }),
    ]);
    expect(CONSENT_METHOD_ENROLMENT_OTP).toBe("enrolment+otp");
  });
  it("skips no-op changes and duplicates", () => {
    const existing = [grant("AI_PROCESSING", "2026-11-01T00:00:00Z"), withdraw("MEDIA_PUBLIC", "2026-11-01T00:00:00Z")];
    const rows = consentRowsToAppend(existing, ctx, [
      { purpose: "AI_PROCESSING", granted: true },
      { purpose: "MEDIA_PUBLIC", granted: false },
      { purpose: "MEDIA_BATCH", granted: false },
      { purpose: "MEDIA_BATCH", granted: true },
    ]);
    expect(rows.map((r) => [r.purpose, r.granted])).toEqual([["MEDIA_BATCH", false]]);
  });
  it("after appending, hasConsent reflects the change", () => {
    const existing = [grant("AI_PROCESSING", "2026-11-01T00:00:00Z")];
    const added = consentRowsToAppend(existing, ctx, [{ purpose: "AI_PROCESSING", granted: false }]);
    const all = [...existing, ...added.map((r) => ({ ...r, createdAt: ctx.now }))];
    expect(hasConsent(all, "s1", "AI_PROCESSING")).toBe(false);
    expect(all).toHaveLength(2);
  });
});

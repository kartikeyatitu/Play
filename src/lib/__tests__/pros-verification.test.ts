import { describe, it, expect } from "vitest";
import {
  availableOpsDecisions,
  isRecordedVerification,
  proVerificationState,
  resolveOpsDecision,
} from "@/lib/pros/verification";
import { CREDENTIAL_TYPES_BY_PRO, credentialTitle } from "@/lib/pros/types";

const at = new Date("2026-11-01T10:00:00Z");
const verifiedProvider = { credentialStatus: "VERIFIED", credentialVerifiedById: "ops1", credentialVerifiedAt: at };

describe("isRecordedVerification", () => {
  it("needs VERIFIED plus an ops verifier stamp", () => {
    expect(isRecordedVerification({ status: "VERIFIED", verifiedById: "ops1", verifiedAt: at })).toBe(true);
    expect(isRecordedVerification({ status: "VERIFIED", verifiedById: null, verifiedAt: at })).toBe(false);
    expect(isRecordedVerification({ status: "VERIFIED", verifiedById: "ops1", verifiedAt: null })).toBe(false);
    expect(isRecordedVerification({ status: "VERIFIED", verifiedById: "", verifiedAt: at })).toBe(false);
    expect(isRecordedVerification({ status: "VERIFIED", verifiedById: "ops1", verifiedAt: new Date("nope") })).toBe(false);
    expect(isRecordedVerification({ status: "REVIEWED", verifiedById: "ops1", verifiedAt: at })).toBe(false);
    expect(isRecordedVerification(null)).toBe(false);
  });
});

describe("proVerificationState", () => {
  it("health types: verified only via the ops-verified registration", () => {
    expect(proVerificationState({ type: "PHYSIOTHERAPIST", provider: verifiedProvider, credentials: [] })).toBe("VERIFIED");
    expect(
      proVerificationState({
        type: "PHYSIOTHERAPIST",
        provider: { ...verifiedProvider, credentialVerifiedById: null },
        credentials: [],
      }),
    ).toBe("NOT_VERIFIED");
    expect(
      proVerificationState({ type: "SPORTS_PSYCHOLOGIST", provider: { ...verifiedProvider, credentialStatus: "SUBMITTED" }, credentials: [] }),
    ).toBe("IN_REVIEW");
  });

  it("health types: a verified degree alone is not enough", () => {
    const degree = CREDENTIAL_TYPES_BY_PRO.PHYSIOTHERAPIST[0];
    expect(
      proVerificationState({
        type: "PHYSIOTHERAPIST",
        provider: null,
        credentials: [{ title: credentialTitle(degree, "BPT"), status: "VERIFIED", verifiedById: "ops1", verifiedAt: at }],
      }),
    ).toBe("NOT_VERIFIED");
  });

  it("non-health types: need an ops-verified *required* credential", () => {
    const [cert, degree] = CREDENTIAL_TYPES_BY_PRO.SC_COACH;
    expect(cert.required).toBe(true);
    expect(degree.required).toBe(false);
    const ok = { title: credentialTitle(cert, "NSCA-CSCS"), status: "VERIFIED", verifiedById: "ops1", verifiedAt: at };
    expect(proVerificationState({ type: "SC_COACH", provider: null, credentials: [ok] })).toBe("VERIFIED");
    const optional = { ...ok, title: credentialTitle(degree, "BSc") };
    expect(proVerificationState({ type: "SC_COACH", provider: null, credentials: [optional] })).toBe("NOT_VERIFIED");
    const untagged = { ...ok, title: "NSCA-CSCS" };
    expect(proVerificationState({ type: "SC_COACH", provider: null, credentials: [untagged] })).toBe("NOT_VERIFIED");
    const submitted = { ...ok, status: "SUBMITTED", verifiedById: null, verifiedAt: null };
    expect(proVerificationState({ type: "SC_COACH", provider: null, credentials: [submitted] })).toBe("IN_REVIEW");
  });
});

describe("resolveOpsDecision", () => {
  it("verifies from submitted or reviewed", () => {
    expect(resolveOpsDecision("SUBMITTED", "VERIFY", "")).toEqual({ ok: true, to: "VERIFIED", reason: null });
    expect(resolveOpsDecision("REVIEWED", "VERIFY", "")).toMatchObject({ ok: true, to: "VERIFIED" });
  });
  it("requires a reason to reject or revoke", () => {
    expect(resolveOpsDecision("SUBMITTED", "REJECT", "  ").ok).toBe(false);
    expect(resolveOpsDecision("SUBMITTED", "REJECT", "Number not on register")).toEqual({
      ok: true,
      to: "REJECTED",
      reason: "Number not on register",
    });
    expect(resolveOpsDecision("VERIFIED", "REVOKE", "").ok).toBe(false);
    expect(resolveOpsDecision("VERIFIED", "REVOKE", "Lapsed")).toMatchObject({ ok: true, to: "REVIEWED" });
  });
  it("rejects nonsense and disallowed moves", () => {
    expect(resolveOpsDecision("VERIFIED", "VERIFY", "").ok).toBe(false);
    expect(resolveOpsDecision("REJECTED", "VERIFY", "").ok).toBe(false);
    expect(resolveOpsDecision("SUBMITTED", "REVOKE", "x").ok).toBe(false);
    expect(resolveOpsDecision("VERIFIED", "REVIEW", "").ok).toBe(false);
    expect(resolveOpsDecision("WHATEVER", "VERIFY", "").ok).toBe(false);
    expect(resolveOpsDecision("SUBMITTED", "APPROVE", "").ok).toBe(false);
  });
  it("trims long reasons", () => {
    const r = resolveOpsDecision("SUBMITTED", "REJECT", "x".repeat(400));
    expect(r.ok && r.reason?.length).toBe(300);
  });
  it("offers the right buttons", () => {
    expect(availableOpsDecisions("SUBMITTED")).toEqual(["REVIEW", "VERIFY", "REJECT"]);
    expect(availableOpsDecisions("VERIFIED")).toEqual(["REVOKE"]);
    expect(availableOpsDecisions("REJECTED")).toEqual(["REVIEW"]);
  });
});

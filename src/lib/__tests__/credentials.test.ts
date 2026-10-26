import { describe, it, expect } from "vitest";
import { canSetCredentialStatus, credentialAuditAction, credentialLabel } from "@/lib/credentials";

describe("credential verification states", () => {
  it("owners can never set REVIEWED or VERIFIED", () => {
    for (const from of ["SUBMITTED", "REVIEWED", "VERIFIED", "REJECTED"]) {
      expect(canSetCredentialStatus(from, "VERIFIED", "OWNER")).toBe(false);
      expect(canSetCredentialStatus(from, "REVIEWED", "OWNER")).toBe(false);
    }
  });

  it("owner edits reset a checked credential to SUBMITTED", () => {
    expect(canSetCredentialStatus("VERIFIED", "SUBMITTED", "OWNER")).toBe(true);
    expect(canSetCredentialStatus("SUBMITTED", "SUBMITTED", "OWNER")).toBe(false);
  });

  it("verifiers review, verify, reject and revoke", () => {
    expect(canSetCredentialStatus("SUBMITTED", "REVIEWED", "VERIFIER")).toBe(true);
    expect(canSetCredentialStatus("REVIEWED", "VERIFIED", "VERIFIER")).toBe(true);
    expect(canSetCredentialStatus("SUBMITTED", "REJECTED", "VERIFIER")).toBe(true);
    expect(canSetCredentialStatus("VERIFIED", "REVIEWED", "VERIFIER")).toBe(true);
    expect(canSetCredentialStatus("VERIFIED", "REJECTED", "VERIFIER")).toBe(false);
    expect(canSetCredentialStatus("SUBMITTED", "BOGUS", "VERIFIER")).toBe(false);
  });

  it("names audit actions and never labels unknown values as verified", () => {
    expect(credentialAuditAction("SUBMITTED", "VERIFIED")).toBe("CREDENTIAL_VERIFIED");
    expect(credentialAuditAction("VERIFIED", "REVIEWED")).toBe("CREDENTIAL_REVOKED");
    expect(credentialLabel("whatever")).not.toMatch(/Verified/);
    expect(credentialLabel("VERIFIED")).toBe("Verified by Triq");
  });
});

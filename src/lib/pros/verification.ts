// TRIQ Connect verification state. Pure and client-safe.
//
// A professional is shown as Verified ONLY when a Triq ops (SUPER_ADMIN) verification has been recorded:
// status VERIFIED *and* the verifier id and timestamp stamped by the ops review action. Self-submitted
// statuses, legacy rows without a verifier stamp, or anything else read as "Not yet verified".
// Nothing in this module (or anywhere in Connect) sets VERIFIED automatically.

import { canSetCredentialStatus, isCredentialStatus, type CredentialStatus } from "@/lib/credentials";
import { credentialTypeOfTitle, isHealthType, type ProType } from "./types";

export interface RecordedCredential {
  status: string;
  verifiedById: string | null;
  verifiedAt: Date | null;
}

/** True only for a VERIFIED status carrying an ops verifier stamp. */
export function isRecordedVerification(c: RecordedCredential | null | undefined): boolean {
  if (!c) return false;
  return (
    c.status === "VERIFIED" &&
    typeof c.verifiedById === "string" &&
    c.verifiedById.length > 0 &&
    c.verifiedAt instanceof Date &&
    !Number.isNaN(c.verifiedAt.getTime())
  );
}

export interface ProviderCredentialRow {
  credentialStatus: string;
  credentialVerifiedById: string | null;
  credentialVerifiedAt: Date | null;
}

export interface ProCredentialRow extends RecordedCredential {
  title: string;
}

export type ProVerificationState = "VERIFIED" | "IN_REVIEW" | "NOT_VERIFIED";

export const PRO_VERIFICATION_LABELS: Record<ProVerificationState, string> = {
  VERIFIED: "Verified",
  IN_REVIEW: "Not yet verified",
  NOT_VERIFIED: "Not yet verified",
};

/**
 * Health types (psychologist, counsellor, physio, nutritionist): ops must have verified the registration
 * on the WellnessProvider row. Other types: ops must have verified at least one credential that is a
 * *required* credential for that type.
 */
export function proVerificationState(input: {
  type: ProType;
  provider: ProviderCredentialRow | null;
  credentials: ProCredentialRow[];
}): ProVerificationState {
  const { type, provider, credentials } = input;
  if (isHealthType(type)) {
    if (
      provider &&
      isRecordedVerification({
        status: provider.credentialStatus,
        verifiedById: provider.credentialVerifiedById,
        verifiedAt: provider.credentialVerifiedAt,
      })
    ) {
      return "VERIFIED";
    }
  } else if (credentials.some((c) => credentialTypeOfTitle(type, c.title)?.required && isRecordedVerification(c))) {
    return "VERIFIED";
  }
  const pending = (s: string) => s === "SUBMITTED" || s === "REVIEWED";
  if ((provider && pending(provider.credentialStatus)) || credentials.some((c) => pending(c.status))) return "IN_REVIEW";
  return "NOT_VERIFIED";
}

export const isVerified = (s: ProVerificationState) => s === "VERIFIED";

// ---- ops decisions -------------------------------------------------------------------------------

export const OPS_DECISIONS = ["REVIEW", "VERIFY", "REJECT", "REVOKE"] as const;
export type OpsDecision = (typeof OPS_DECISIONS)[number];
export const OPS_DECISION_LABELS: Record<OpsDecision, string> = {
  REVIEW: "Mark reviewed",
  VERIFY: "Verify",
  REJECT: "Reject",
  REVOKE: "Revoke verification",
};
export const isOpsDecision = (v: unknown): v is OpsDecision => typeof v === "string" && (OPS_DECISIONS as readonly string[]).includes(v);

const DECISION_TARGET: Record<OpsDecision, CredentialStatus> = {
  REVIEW: "REVIEWED",
  VERIFY: "VERIFIED",
  REJECT: "REJECTED",
  REVOKE: "REVIEWED",
};

export type DecisionResult = { ok: true; to: CredentialStatus; reason: string | null } | { ok: false; error: string };

/** Validates an ops decision against the shared credential state machine. Reject needs a reason. */
export function resolveOpsDecision(from: string, decision: unknown, rawReason: unknown): DecisionResult {
  if (!isCredentialStatus(from)) return { ok: false, error: "Unknown credential status" };
  if (!isOpsDecision(decision)) return { ok: false, error: "Unknown decision" };
  if (decision === "REVOKE" && from !== "VERIFIED") return { ok: false, error: "Only verified credentials can be revoked" };
  if (decision === "REVIEW" && from === "VERIFIED") return { ok: false, error: "Use revoke to withdraw a verification" };
  const to = DECISION_TARGET[decision];
  if (!canSetCredentialStatus(from, to, "VERIFIER")) return { ok: false, error: "That decision is not allowed from the current status" };
  const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 300) : "";
  if ((decision === "REJECT" || decision === "REVOKE") && !reason) return { ok: false, error: "Give a reason" };
  return { ok: true, to, reason: reason || null };
}

/** Decisions to offer as buttons for a credential in status `from`. */
export function availableOpsDecisions(from: string): OpsDecision[] {
  return OPS_DECISIONS.filter((d) => resolveOpsDecision(from, d, "x").ok);
}

// Shared credential verification states (Careers professional credentials, Wellness provider credentials).
// Pure and client-safe. The scope requires an explicit distinction between submitted, reviewed and
// verified information, and VERIFIED may only come from an authorised verifier (Triq ops, SUPER_ADMIN).

export const CREDENTIAL_STATUSES = ["SUBMITTED", "REVIEWED", "VERIFIED", "REJECTED"] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  SUBMITTED: "Submitted (not checked)",
  REVIEWED: "Reviewed by Triq",
  VERIFIED: "Verified by Triq",
  REJECTED: "Not verified",
};

export const isCredentialStatus = (v: unknown): v is CredentialStatus =>
  typeof v === "string" && (CREDENTIAL_STATUSES as readonly string[]).includes(v);

/** Moves an authorised verifier may make. Owners can only (re)submit. */
const VERIFIER_MOVES: Record<CredentialStatus, CredentialStatus[]> = {
  SUBMITTED: ["REVIEWED", "VERIFIED", "REJECTED"],
  REVIEWED: ["VERIFIED", "REJECTED"],
  VERIFIED: ["REVIEWED"], // revoke back to reviewed
  REJECTED: ["REVIEWED"],
};

export type CredentialActor = "OWNER" | "VERIFIER";

/** True when `actor` may move a credential from `from` to `to`. */
export function canSetCredentialStatus(from: string, to: string, actor: CredentialActor): boolean {
  if (!isCredentialStatus(from) || !isCredentialStatus(to) || from === to) return false;
  if (actor === "OWNER") return to === "SUBMITTED"; // editing evidence resets to SUBMITTED
  return VERIFIER_MOVES[from].includes(to);
}

/** Audit action name for a verifier move. */
export function credentialAuditAction(from: CredentialStatus, to: CredentialStatus): string {
  if (from === "VERIFIED" && to === "REVIEWED") return "CREDENTIAL_REVOKED";
  return `CREDENTIAL_${to}`;
}

/** The only label allowed to say "Verified" — callers must not invent their own. */
export function credentialLabel(status: string): string {
  return isCredentialStatus(status) ? CREDENTIAL_STATUS_LABELS[status] : CREDENTIAL_STATUS_LABELS.SUBMITTED;
}

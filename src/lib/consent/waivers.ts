// Pure waiver logic (WaiverTemplate / WaiverSignature, flag FEATURES.waivers).
// Templates are versioned: publishing a change creates a new row with version + 1 under the same
// title and deactivates the old one. A signature counts only for the exact template row and version,
// so a version change requires every child to be signed again.
import crypto from "crypto";

/**
 * sha256 of the signer's IP salted with the academy id. The raw IP is never stored.
 * Returns null when the IP is unknown.
 * COUNSEL: confirm a salted hash is enough evidence for an e-signature under the IT Act 2000 /
 * Indian Evidence Act, or whether the raw IP (with a retention period) must be kept instead.
 */
export function hashSignerIp(ip: string | null | undefined, orgId: string): string | null {
  const clean = String(ip ?? "").split(",")[0].trim();
  if (!clean || clean === "unknown") return null;
  return crypto.createHash("sha256").update(`${orgId}:${clean}`).digest("hex");
}

export const MIN_SIGNED_NAME = 3;
export const MAX_SIGNED_NAME = 120;

export type SignatureCheck = { ok: true; signedName: string } | { ok: false; error: string };

/** Validates the typed full name and the "I agree" checkbox. */
export function checkSignatureInput(input: { signedName?: unknown; agreed?: unknown }): SignatureCheck {
  if (input.agreed !== true) return { ok: false, error: "Tick the box to confirm you agree." };
  const name = String(input.signedName ?? "").replace(/\s+/g, " ").trim();
  if (name.length < MIN_SIGNED_NAME) return { ok: false, error: "Type your full name to sign." };
  if (name.length > MAX_SIGNED_NAME) return { ok: false, error: "That name is too long." };
  if (!/\p{L}/u.test(name)) return { ok: false, error: "Type your full name to sign." };
  return { ok: true, signedName: name };
}

export interface TemplateLite {
  id: string;
  title: string;
  version: number;
  active: boolean;
}

export interface SignatureLite {
  templateId: string;
  version: number;
  studentId: string;
  signedAt: Date;
}

export type WaiverStatus = "SIGNED" | "RESIGN_NEEDED" | "UNSIGNED";

/** Next version number for a title (1 when the title is new). */
export function nextWaiverVersion(templates: readonly { title: string; version: number }[], title: string): number {
  const versions = templates.filter((t) => t.title === title).map((t) => t.version);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

/**
 * Status of each active template for one child: SIGNED when a signature exists for that template row
 * and version; RESIGN_NEEDED when only an older version of the same title was signed; else UNSIGNED.
 */
export function waiverStatusForStudent(
  templates: readonly TemplateLite[],
  signatures: readonly SignatureLite[],
  studentId: string,
): { template: TemplateLite; status: WaiverStatus; signedAt: Date | null }[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const mine = signatures.filter((s) => s.studentId === studentId);
  return templates
    .filter((t) => t.active)
    .map((t) => {
      const current = mine.find((s) => s.templateId === t.id && s.version === t.version);
      if (current) return { template: t, status: "SIGNED" as const, signedAt: current.signedAt };
      const older = mine.some((s) => {
        const st = byId.get(s.templateId);
        return st ? st.title === t.title && s.version < t.version : false;
      });
      return { template: t, status: older ? ("RESIGN_NEEDED" as const) : ("UNSIGNED" as const), signedAt: null };
    });
}

/** Students in each batch who have no signature for the template's current version. */
export function unsignedByBatch(
  batches: readonly { id: string; name: string; students: readonly { id: string; name: string }[] }[],
  template: { id: string; version: number },
  signatures: readonly SignatureLite[],
): { batchId: string; batchName: string; total: number; unsigned: { id: string; name: string }[] }[] {
  const signed = new Set(signatures.filter((s) => s.templateId === template.id && s.version === template.version).map((s) => s.studentId));
  return batches.map((b) => ({
    batchId: b.id,
    batchName: b.name,
    total: b.students.length,
    unsigned: b.students.filter((s) => !signed.has(s.id)),
  }));
}

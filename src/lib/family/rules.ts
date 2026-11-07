// Pure family-account rules (GuardianLink, flag FEATURES.familyAccounts).
// Student.parentId stays the primary guardian. GuardianLink rows add further guardians.

/** A child has at most two guardians (the primary on Student.parentId plus one more). */
export const MAX_GUARDIANS_PER_CHILD = 2;

export const GUARDIAN_RELATIONS = ["MOTHER", "FATHER", "GUARDIAN", "OTHER"] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

export function normaliseRelation(v: unknown): GuardianRelation {
  const s = String(v ?? "").trim().toUpperCase();
  return (GUARDIAN_RELATIONS as readonly string[]).includes(s) ? (s as GuardianRelation) : "GUARDIAN";
}

/** Distinct guardian user ids for one child: the primary parent first, then linked guardians. */
export function guardianIdsOf(primaryParentId: string, links: readonly { userId: string }[]): string[] {
  const out = [primaryParentId];
  for (const l of links) if (!out.includes(l.userId)) out.push(l.userId);
  return out;
}

export type AddGuardianCheck = { ok: true } | { ok: false; error: string };

export function canAddGuardian(primaryParentId: string, links: readonly { userId: string }[], newUserId: string): AddGuardianCheck {
  const ids = guardianIdsOf(primaryParentId, links);
  if (ids.includes(newUserId)) return { ok: false, error: "This person is already a guardian of this child." };
  if (ids.length >= MAX_GUARDIANS_PER_CHILD) {
    return { ok: false, error: `A child can have at most ${MAX_GUARDIANS_PER_CHILD} guardians.` };
  }
  return { ok: true };
}

/** Union of children reachable by Student.parentId and by GuardianLink, without duplicates, order kept. */
export function unionStudentIds(primary: readonly string[], linked: readonly string[]): string[] {
  return Array.from(new Set([...primary, ...linked]));
}

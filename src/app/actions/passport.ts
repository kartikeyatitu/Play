"use server";

// Athlete Passport v1 (sprint 1 item 9). Read-only. Access is decided by the pure policy in
// src/lib/athlete/passport-policy.ts; anyone it refuses gets the same "not found" as a missing athlete.

import { getSession } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { loadPassport, passportAccess } from "@/lib/athlete/passport";
import type { Passport } from "@/lib/athlete/passport-build";
import type { PassportRelation } from "@/lib/athlete/passport-policy";

export type GetPassportResult = { ok: true; passport: Passport; relation: PassportRelation } | { ok: false; error: "Not found" };

const NOT_FOUND: GetPassportResult = { ok: false, error: "Not found" };

export async function getPassport(studentId: string): Promise<GetPassportResult> {
  if (!FEATURES.athleteOS) return NOT_FOUND;
  const session = await getSession();
  const viewerId = session?.id ? String(session.id) : null;
  const decision = await passportAccess(viewerId, studentId);
  if (!decision.ok) return NOT_FOUND;
  const passport = await loadPassport(studentId);
  if (!passport) return NOT_FOUND;
  return { ok: true, passport, relation: decision.relation };
}

// Public /join self-registration rules. Pure: no DB or server-only imports.
//
// A public join never creates accounts, students or batch enrolments (anything enrolled is billed by
// the monthly fee run). It only records an enquiry (Lead) that the academy reviews and converts with
// the existing "convert lead to student" flow, which needs leads.manage.

export const JOIN_LEAD_SOURCE = "WEBSITE";

/** Public join attempts allowed per window (enforced with the DB-backed limiter). */
export const JOIN_LIMITS = {
  perPhonePerHour: 5,
  perIpPerHour: 20,
  perAcademyPerDay: 200,
} as const;

/** Whole years between dob and now (null when unknown). */
export function ageOn(dob: Date | null, now: Date): number | null {
  if (!dob || Number.isNaN(dob.getTime())) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

export type JoinLeadInput = {
  orgId: string;
  parentName: string;
  parentPhone: string;
  childName: string;
  dob: Date | null;
  batch: { name: string; sport: string } | null;
  now: Date;
};

/** The Lead row a public join creates: status NEW, never enrolled. */
export function buildJoinLead(input: JoinLeadInput) {
  const notes = [
    "Self-registration from the academy's join link. Review and convert to a student to enrol.",
    input.batch ? `Requested batch: ${input.batch.name}` : null,
    input.dob ? `Date of birth: ${input.dob.toISOString().slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    orgId: input.orgId,
    parentName: input.parentName.trim().slice(0, 80),
    parentPhone: input.parentPhone,
    childName: input.childName.trim().slice(0, 80),
    childAge: ageOn(input.dob, input.now),
    sport: input.batch?.sport ?? null,
    source: JOIN_LEAD_SOURCE,
    status: "NEW" as const,
    notes,
  };
}

/** Open (not yet enrolled or lost) enquiries count as duplicates of a new join for the same child. */
export function isOpenLeadStatus(status: string): boolean {
  return status !== "ENROLLED" && status !== "LOST";
}

/** The exact date of birth a public join recorded in the lead's notes, if any. */
export function dobFromJoinNotes(notes: string | null | undefined): Date | null {
  const m = /^Date of birth: (\d{4}-\d{2}-\d{2})$/m.exec(notes || "");
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Who may see which athlete (Vertical 2). Pure: returns Prisma `where` fragments, no DB access.
// Mirrors the filter used by src/app/student/[id]/page.tsx so every athlete surface agrees.

export interface AccessSession {
  id: string;
  role: string;
  orgId?: string | null;
}

/** Prisma Student `where` for students this signed-in user may view. */
export function studentAccessFilter(session: AccessSession) {
  const orgId = session.orgId || "__no_org__";
  if (session.role === "PARENT") return { parentId: session.id, orgId };
  if (session.role === "COACH") {
    return { orgId, enrollments: { some: { batch: { coachId: session.id, orgId } } } };
  }
  if (session.role === "ADMIN") return { orgId };
  return { id: "__none__" };
}

/** Coach-of-batch scope for writes (coach assessments, goals, achievement review). */
export function coachStudentFilter(coachId: string, orgId: string) {
  return { orgId, enrollments: { some: { batch: { coachId, orgId } } } };
}

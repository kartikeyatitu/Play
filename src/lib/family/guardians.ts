// Server-only family helpers. GuardianLink is queried only when FEATURES.familyAccounts is on
// (the table may not exist in production until then).
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { guardianIdsOf, unionStudentIds } from "./rules";

/**
 * Every child this user is a guardian of: Student.parentId, plus GuardianLink rows when
 * familyAccounts is on. Existing callers that use parentId directly are left unchanged.
 */
export async function getGuardianStudentIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const primary = await db.student.findMany({ where: { parentId: userId }, select: { id: true }, orderBy: { createdAt: "asc" } });
  if (!FEATURES.familyAccounts) return primary.map((s) => s.id);
  const links = await db.guardianLink.findMany({ where: { userId }, select: { studentId: true }, orderBy: { createdAt: "asc" } });
  return unionStudentIds(
    primary.map((s) => s.id),
    links.map((l) => l.studentId),
  );
}

/**
 * The child if this user is one of its guardians, else null. "Enrolment record" check used by
 * consent, waivers and data requests.
 */
export async function guardianStudent(userId: string, studentId: string) {
  if (!userId || !studentId || studentId.length > 64) return null;
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, orgId: true, parentId: true, dob: true },
  });
  if (!student) return null;
  if (student.parentId === userId) return { ...student, via: "PRIMARY" as const };
  if (!FEATURES.familyAccounts) return null;
  const link = await db.guardianLink.findUnique({ where: { userId_studentId: { userId, studentId } }, select: { id: true } });
  return link ? { ...student, via: "LINK" as const } : null;
}

/** Guardians of a child (primary first) with name and phone, for the owner and family pages. */
export async function guardiansOfStudent(studentId: string) {
  const student = await db.student.findUnique({ where: { id: studentId }, select: { parentId: true } });
  if (!student) return [];
  const links = FEATURES.familyAccounts
    ? await db.guardianLink.findMany({ where: { studentId }, select: { userId: true, relation: true, verifiedAt: true }, orderBy: { createdAt: "asc" } })
    : [];
  const ids = guardianIdsOf(student.parentId, links);
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true, lastSeenAt: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ids
    .map((id) => {
      const u = byId.get(id);
      if (!u) return null;
      const link = links.find((l) => l.userId === id);
      return {
        userId: id,
        name: u.name,
        phone: u.phone,
        primary: id === student.parentId,
        relation: link?.relation ?? null,
        joined: !!u.lastSeenAt,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
}

/**
 * Prisma Student `where` fragment for "children this user looks after": the primary parent's children
 * plus any linked as a second guardian. Combine with other conditions under AND so `id` never collides.
 */
export async function myChildrenWhere(userId: string): Promise<{ id: { in: string[] } }> {
  return { id: { in: await getGuardianStudentIds(userId) } };
}

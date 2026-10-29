import { db } from "@/lib/db";
import type { NamedPerson } from "./redact-names";

/** Per role, the most names loaded for one academy. Larger rosters are logged, not silently passed on. */
export const ROSTER_NAME_CAP = 2000;

/** Names of this academy's students (children) and parents, for redaction before any AI call. Server only. */
export async function loadNameRoster(orgId: string): Promise<NamedPerson[]> {
  const [students, parents] = await Promise.all([
    db.student.findMany({ where: { orgId }, select: { name: true }, orderBy: { id: "asc" }, take: ROSTER_NAME_CAP }),
    db.user.findMany({
      where: { OR: [{ orgId, role: "PARENT" }, { children: { some: { orgId } } }] },
      select: { name: true },
      orderBy: { id: "asc" },
      take: ROSTER_NAME_CAP,
    }),
  ]);
  if (students.length === ROSTER_NAME_CAP || parents.length === ROSTER_NAME_CAP) {
    console.warn(`[ai] name roster reached the ${ROSTER_NAME_CAP} cap for one academy; later names are not redacted`);
  }
  return [
    ...students.map((s) => ({ name: s.name, role: "child" as const })),
    ...parents.map((p) => ({ name: p.name, role: "parent" as const })),
  ];
}

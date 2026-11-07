import { db } from "@/lib/db";
import { deriveHats, hatForAppRole, type Hat } from "@/lib/roles/hats";

export interface HeldHats {
  hats: Hat[];
  /** Hat from User.role (what single-role users always get). */
  defaultHat: Hat | null;
  userRole: string;
  orgId: string | null;
  orgName: string | null;
}

/**
 * Recomputes a person's hats from the database. Every server-side check calls this: the hat list is
 * never cached in a cookie or trusted from the client.
 */
export async function loadHeldHats(userId: string): Promise<HeldHats | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, orgId: true, org: { select: { name: true } } },
  });
  if (!user) return null;
  const [memberships, child] = await Promise.all([
    user.orgId
      ? db.orgMembership.findMany({
          where: { userId, orgId: user.orgId, status: "ACTIVE" },
          select: { orgId: true, role: true, status: true },
        })
      : Promise.resolve([]),
    db.student.findFirst({ where: { parentId: userId }, select: { id: true } }),
  ]);
  return {
    hats: deriveHats({ userRole: user.role, activeOrgId: user.orgId, memberships, hasChildren: !!child }),
    defaultHat: hatForAppRole(user.role),
    userRole: user.role,
    orgId: user.orgId ?? null,
    orgName: user.org?.name ?? null,
  };
}

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { effectivePermissions, membershipAllows, type Permission } from "@/lib/team";

/**
 * Academies created before memberships existed only have User.orgId + User.role.
 * This creates the matching OrgMembership rows (ADMIN -> OWNER, COACH -> COACH, STAFF -> STAFF).
 * Idempotent and cheap: it only inserts rows that are missing.
 */
export async function backfillOrgMemberships(orgId: string) {
  const users = await db.user.findMany({
    where: { orgId, role: { in: ["ADMIN", "COACH", "STAFF"] }, memberships: { none: { orgId } } },
    select: { id: true, role: true },
  });
  if (!users.length) return 0;
  await db.orgMembership.createMany({
    data: users.map((u) => ({ userId: u.id, orgId, role: u.role === "ADMIN" ? "OWNER" : u.role })),
    skipDuplicates: true,
  });
  return users.length;
}

/** The person's membership in an academy, creating it from legacy data if needed. */
export async function getMembership(userId: string, orgId: string) {
  let m = await db.orgMembership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  if (!m) {
    await backfillOrgMemberships(orgId);
    m = await db.orgMembership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  }
  return m && m.status === "ACTIVE" ? m : null;
}

/** Signed-in academy user (owner, manager, coach or staff) with their active membership. */
export async function requireMember(allowedAppRoles: string[] = ["ADMIN", "COACH", "STAFF"]) {
  const session = await requireAuth(allowedAppRoles);
  if (!session.orgId) throw new Error("No academy found");
  const membership = await getMembership(session.id, session.orgId);
  if (!membership) throw new Error("You are not an active member of this academy");
  return { session: { ...session, orgId: session.orgId as string }, membership };
}

/**
 * Any active team member (owner, manager, coach or staff) who holds a specific permission in their
 * active academy. Access comes from the membership (role defaults plus per-person overrides), not the
 * app role, so a receptionist with fees.collect or a coach granted fees.collect can use it too.
 * Owners always have every permission.
 */
export async function requirePermission(permission: Permission) {
  const ctx = await requireMember(["ADMIN", "COACH", "STAFF"]);
  if (!membershipAllows(ctx.membership, permission)) throw new Error("You don't have permission to do this");
  return ctx;
}

/** True when this membership holds the permission (role defaults plus per-person overrides). */
export function hasPermission(
  membership: { role: string; staffRole?: string | null; permissions?: string | null },
  permission: Permission,
) {
  return effectivePermissions(membership.role, membership.staffRole, membership.permissions).has(permission);
}

// Messages thrown by requireMember / requirePermission that are safe to show to the user.
const ACCESS_ERRORS = new Set([
  "No academy found",
  "You are not an active member of this academy",
  "You don't have permission to do this",
]);

export type PermissionCheck =
  | ({ ok: true; error?: undefined } & Awaited<ReturnType<typeof requireMember>>)
  | { ok: false; error: string; session?: undefined; membership?: undefined };

/**
 * Same check as requirePermission, for actions that report errors as values instead of throwing.
 * Access failures come back as { ok: false, error }; Next.js redirects (signed out / wrong app) and
 * unexpected errors keep propagating exactly as before. With a permission, any active member holding it
 * passes (see requirePermission). Pass null to only require an active owner/manager membership (for
 * actions that pick the permission after loading data).
 */
export async function checkPermission(permission: Permission | null): Promise<PermissionCheck> {
  try {
    const ctx = permission ? await requirePermission(permission) : await requireMember(["ADMIN"]);
    return { ok: true, ...ctx };
  } catch (e: any) {
    if (typeof e?.message === "string" && ACCESS_ERRORS.has(e.message)) return { ok: false, error: e.message };
    throw e;
  }
}

/** Only the academy owner (payment setup, billing, deleting the academy). */
export async function requireOwner() {
  const ctx = await requireMember(["ADMIN"]);
  if (ctx.membership.role !== "OWNER") throw new Error("Only the academy owner can do this");
  return ctx;
}

/** True when the user is the owner of the academy (legacy admins without a membership count as owners). */
export async function isOrgOwner(userId: string, orgId: string | null | undefined) {
  if (!orgId) return false;
  const m = await getMembership(userId, orgId);
  return m?.role === "OWNER";
}

/**
 * Prisma `where` for "coaches of this academy". Coaches can work at several academies, so this goes
 * through memberships rather than User.orgId (which is only the coach's *active* academy). Users from
 * before memberships existed are matched by orgId until their membership is backfilled.
 */
export function coachesOfOrg(orgId: string) {
  return {
    OR: [
      { memberships: { some: { orgId, role: "COACH", status: "ACTIVE" } } },
      { role: "COACH", orgId, memberships: { none: { orgId } } },
    ],
  };
}

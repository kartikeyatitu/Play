import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { effectivePermissions, type Permission } from "@/lib/team";

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

/** Owner or manager who holds a specific permission in their active academy. */
export async function requirePermission(permission: Permission) {
  const ctx = await requireMember(["ADMIN"]);
  const perms = effectivePermissions(ctx.membership.role, ctx.membership.staffRole, ctx.membership.permissions);
  if (!perms.has(permission)) throw new Error("You don't have permission to do this");
  return ctx;
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

// "Hats": the views one person can use (admin, coach, staff, parent, ops), derived from data that
// already exists (User.role, OrgMembership rows in the active academy, Student.parentId). Pure: no DB,
// no cookies, so it can be imported from client components and unit-tested directly.

export const HATS = ["admin", "coach", "staff", "parent", "ops"] as const;
export type Hat = (typeof HATS)[number];

/** The app role (User.role vocabulary) that each hat acts as in requireAuth checks. */
export const HAT_APP_ROLE: Record<Hat, "ADMIN" | "COACH" | "STAFF" | "PARENT" | "SUPER_ADMIN"> = {
  admin: "ADMIN",
  coach: "COACH",
  staff: "STAFF",
  parent: "PARENT",
  ops: "SUPER_ADMIN",
};

/** Where each hat lands. */
export const HAT_HOME: Record<Hat, string> = {
  admin: "/org",
  coach: "/coach",
  staff: "/staff",
  parent: "/parent",
  ops: "/ops",
};

export const HAT_LABEL: Record<Hat, string> = {
  admin: "Academy admin",
  coach: "Coach",
  staff: "Staff",
  parent: "Parent",
  ops: "Triq ops",
};

/** Error returned by switchRole for any hat the person does not hold. */
export const SWITCH_ROLE_REFUSED = "You don't have that role at this academy";

export function isHat(value: unknown): value is Hat {
  return typeof value === "string" && (HATS as readonly string[]).includes(value);
}

/** The hat a User.role maps to (the person's default hat), or null for unknown roles. */
export function hatForAppRole(role: string | null | undefined): Hat | null {
  switch (role) {
    case "ADMIN":
      return "admin";
    case "COACH":
      return "coach";
    case "STAFF":
      return "staff";
    case "PARENT":
      return "parent";
    case "SUPER_ADMIN":
      return "ops";
    default:
      return null;
  }
}

/** The hat an academy membership grants (OWNER/MANAGER → admin, COACH → coach, STAFF → staff). */
export function hatForMembershipRole(role: string | null | undefined): Hat | null {
  if (role === "OWNER" || role === "MANAGER") return "admin";
  if (role === "COACH") return "coach";
  if (role === "STAFF") return "staff";
  return null;
}

export interface HatInput {
  /** User.role: always kept as the default hat so single-role users see no change. */
  userRole: string | null | undefined;
  /** User.orgId: the active academy. Memberships elsewhere grant nothing until the person switches academy. */
  activeOrgId: string | null | undefined;
  memberships: { orgId: string; role: string; status: string }[];
  /** True when at least one Student (any academy) has parentId = this user. */
  hasChildren: boolean;
}

/** Every hat this person holds, in a stable order (HATS order). */
export function deriveHats(input: HatInput): Hat[] {
  const held = new Set<Hat>();
  const def = hatForAppRole(input.userRole);
  if (def) held.add(def);
  if (input.activeOrgId) {
    for (const m of input.memberships) {
      if (m.orgId !== input.activeOrgId || m.status !== "ACTIVE") continue;
      const h = hatForMembershipRole(m.role);
      if (h) held.add(h);
    }
  }
  if (input.hasChildren) held.add("parent");
  if (input.userRole === "SUPER_ADMIN") held.add("ops");
  return HATS.filter((h) => held.has(h));
}

/**
 * The hat to act as: the requested one only if the person really holds it, otherwise their default hat
 * (from User.role). Returns null when neither is usable.
 */
export function resolveActiveHat(requested: unknown, held: readonly Hat[], userRole: string | null | undefined): Hat | null {
  if (isHat(requested) && held.includes(requested)) return requested;
  const def = hatForAppRole(userRole);
  return def && held.includes(def) ? def : null;
}

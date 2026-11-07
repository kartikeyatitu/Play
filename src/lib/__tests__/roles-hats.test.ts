import { describe, it, expect } from "vitest";
import {
  deriveHats,
  hatForAppRole,
  hatForMembershipRole,
  isHat,
  resolveActiveHat,
  HAT_APP_ROLE,
  HAT_HOME,
  HATS,
} from "@/lib/roles/hats";

const ORG = "org_A";
const OTHER = "org_B";
const m = (role: string, orgId = ORG, status = "ACTIVE") => ({ role, orgId, status });

describe("hat mappings", () => {
  it("maps app roles to default hats", () => {
    expect(hatForAppRole("ADMIN")).toBe("admin");
    expect(hatForAppRole("COACH")).toBe("coach");
    expect(hatForAppRole("STAFF")).toBe("staff");
    expect(hatForAppRole("PARENT")).toBe("parent");
    expect(hatForAppRole("SUPER_ADMIN")).toBe("ops");
    expect(hatForAppRole("SOMETHING")).toBeNull();
    expect(hatForAppRole(null)).toBeNull();
  });

  it("maps membership roles to hats", () => {
    expect(hatForMembershipRole("OWNER")).toBe("admin");
    expect(hatForMembershipRole("MANAGER")).toBe("admin");
    expect(hatForMembershipRole("COACH")).toBe("coach");
    expect(hatForMembershipRole("STAFF")).toBe("staff");
    expect(hatForMembershipRole("PARENT")).toBeNull();
  });

  it("homes and app roles match the existing routing", () => {
    expect(HAT_HOME).toEqual({ admin: "/org", coach: "/coach", staff: "/staff", parent: "/parent", ops: "/ops" });
    expect(HAT_APP_ROLE.admin).toBe("ADMIN");
    expect(HAT_APP_ROLE.ops).toBe("SUPER_ADMIN");
  });

  it("isHat only accepts known hats", () => {
    for (const h of HATS) expect(isHat(h)).toBe(true);
    for (const v of ["ADMIN", "Coach", "", null, undefined, 1, {}]) expect(isHat(v)).toBe(false);
  });
});

describe("deriveHats", () => {
  it("single-role users get exactly their default hat", () => {
    expect(deriveHats({ userRole: "COACH", activeOrgId: ORG, memberships: [m("COACH")], hasChildren: false })).toEqual(["coach"]);
    expect(deriveHats({ userRole: "PARENT", activeOrgId: ORG, memberships: [], hasChildren: true })).toEqual(["parent"]);
    expect(deriveHats({ userRole: "ADMIN", activeOrgId: ORG, memberships: [m("OWNER")], hasChildren: false })).toEqual(["admin"]);
    expect(deriveHats({ userRole: "STAFF", activeOrgId: ORG, memberships: [m("STAFF")], hasChildren: false })).toEqual(["staff"]);
  });

  it("legacy users without a membership row keep their User.role hat", () => {
    expect(deriveHats({ userRole: "ADMIN", activeOrgId: ORG, memberships: [], hasChildren: false })).toEqual(["admin"]);
  });

  it("a parent with no children still has the parent hat (default from User.role)", () => {
    expect(deriveHats({ userRole: "PARENT", activeOrgId: null, memberships: [], hasChildren: false })).toEqual(["parent"]);
  });

  it("a coach whose child trains anywhere also gets the parent hat", () => {
    expect(deriveHats({ userRole: "COACH", activeOrgId: ORG, memberships: [m("COACH")], hasChildren: true })).toEqual(["coach", "parent"]);
  });

  it("owners and managers get the admin hat", () => {
    expect(deriveHats({ userRole: "COACH", activeOrgId: ORG, memberships: [m("MANAGER")], hasChildren: false })).toEqual(["admin", "coach"]);
    expect(deriveHats({ userRole: "ADMIN", activeOrgId: ORG, memberships: [m("OWNER")], hasChildren: true })).toEqual(["admin", "parent"]);
  });

  it("only memberships in the active academy count", () => {
    expect(deriveHats({ userRole: "PARENT", activeOrgId: ORG, memberships: [m("COACH", OTHER)], hasChildren: true })).toEqual(["parent"]);
    expect(deriveHats({ userRole: "PARENT", activeOrgId: null, memberships: [m("COACH", ORG)], hasChildren: true })).toEqual(["parent"]);
  });

  it("invited or removed memberships grant nothing", () => {
    expect(deriveHats({ userRole: "PARENT", activeOrgId: ORG, memberships: [m("COACH", ORG, "INVITED")], hasChildren: true })).toEqual(["parent"]);
    expect(deriveHats({ userRole: "PARENT", activeOrgId: ORG, memberships: [m("OWNER", ORG, "REMOVED")], hasChildren: true })).toEqual(["parent"]);
  });

  it("unknown membership roles grant nothing", () => {
    expect(deriveHats({ userRole: "PARENT", activeOrgId: ORG, memberships: [m("SUPER_ADMIN"), m("PARENT")], hasChildren: false })).toEqual(["parent"]);
  });

  it("SUPER_ADMIN gets ops plus any academy hats", () => {
    expect(deriveHats({ userRole: "SUPER_ADMIN", activeOrgId: null, memberships: [], hasChildren: false })).toEqual(["ops"]);
    expect(deriveHats({ userRole: "SUPER_ADMIN", activeOrgId: ORG, memberships: [m("OWNER")], hasChildren: true })).toEqual(["admin", "parent", "ops"]);
  });

  it("nobody else gets ops", () => {
    for (const r of ["ADMIN", "COACH", "STAFF", "PARENT"]) {
      expect(deriveHats({ userRole: r, activeOrgId: ORG, memberships: [m("OWNER")], hasChildren: true })).not.toContain("ops");
    }
  });

  it("no duplicates and stable order", () => {
    const hats = deriveHats({ userRole: "COACH", activeOrgId: ORG, memberships: [m("COACH"), m("COACH")], hasChildren: true });
    expect(hats).toEqual(["coach", "parent"]);
  });

  it("unknown User.role with no other data gives no hats", () => {
    expect(deriveHats({ userRole: "WHATEVER", activeOrgId: null, memberships: [], hasChildren: false })).toEqual([]);
  });
});

describe("resolveActiveHat", () => {
  it("honours a requested hat only when held", () => {
    expect(resolveActiveHat("parent", ["coach", "parent"], "COACH")).toBe("parent");
    expect(resolveActiveHat("admin", ["coach", "parent"], "COACH")).toBe("coach");
    expect(resolveActiveHat("garbage", ["coach", "parent"], "COACH")).toBe("coach");
    expect(resolveActiveHat(undefined, ["coach"], "COACH")).toBe("coach");
  });

  it("returns null when even the default hat is not held", () => {
    expect(resolveActiveHat("coach", [], "WHATEVER")).toBeNull();
  });
});

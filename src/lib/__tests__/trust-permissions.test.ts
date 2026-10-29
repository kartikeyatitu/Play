import { describe, it, expect, vi, beforeEach } from "vitest";

// No database: membership rows live in this in-memory list, keyed by userId + orgId.
type Row = { userId: string; orgId: string; role: string; staffRole?: string | null; permissions?: string | null; status: string };
const rows: Row[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    orgMembership: {
      findUnique: vi.fn(async ({ where }: any) => {
        const { userId, orgId } = where.userId_orgId;
        return rows.find((r) => r.userId === userId && r.orgId === orgId) ?? null;
      }),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    // Legacy backfill finds no users to convert.
    user: { findMany: vi.fn(async () => []) },
  },
}));

// The signed-in session is set per test; requireAuth would normally read cookies.
let session: { id: string; role: string; orgId: string | null } | null = null;
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async (allowed?: string[]) => {
    if (!session) throw new Error("NEXT_REDIRECT:/login");
    if (allowed && !allowed.includes(session.role)) throw new Error("NEXT_REDIRECT:wrong-app");
    return session;
  }),
}));

import { checkPermission, requirePermission, requireOwner, getMembership, isOrgOwner, hasPermission } from "@/lib/membership";
import { defaultPermissions, effectivePermissions, ALL_PERMISSIONS, type Permission } from "@/lib/team";

const MONEY: Permission[] = ["fees.collect", "fees.manage", "payroll.view", "payroll.manage", "reports.view", "settings.manage", "funding.approve"];
const ORG_A = "org_A";
const ORG_B = "org_B";

function member(userId: string, orgId: string, role: string, extra: Partial<Row> = {}) {
  rows.push({ userId, orgId, role, status: "ACTIVE", staffRole: null, permissions: null, ...extra });
}

beforeEach(() => {
  rows.length = 0;
  session = null;
});

describe("default role permissions", () => {
  it("owner has every permission, including all money permissions", () => {
    const perms = new Set(defaultPermissions("OWNER"));
    expect(perms.size).toBe(ALL_PERMISSIONS.length);
    for (const p of MONEY) expect(perms.has(p)).toBe(true);
  });

  it("owner keeps everything even if overrides try to remove money permissions", () => {
    const perms = effectivePermissions("OWNER", null, JSON.stringify({ "fees.collect": false, "payroll.view": false }));
    for (const p of MONEY) expect(perms.has(p)).toBe(true);
  });

  it("manager defaults exclude settings.manage and funding.approve", () => {
    const perms = new Set(defaultPermissions("MANAGER"));
    expect(perms.has("settings.manage")).toBe(false);
    expect(perms.has("funding.approve")).toBe(false);
    expect(perms.has("fees.collect")).toBe(true);
  });

  it("coach only marks attendance; no money permissions", () => {
    expect(defaultPermissions("COACH")).toEqual(["attendance.mark"]);
  });

  it("settings.manage can never be granted to a non-owner by override", () => {
    const perms = effectivePermissions("MANAGER", null, JSON.stringify({ "settings.manage": true }));
    expect(perms.has("settings.manage")).toBe(false);
  });

  it("unknown roles get nothing", () => {
    expect(effectivePermissions("PARENT").size).toBe(0);
  });
});

describe("requirePermission / checkPermission", () => {
  it("owner passes every money permission", async () => {
    session = { id: "u_owner", role: "ADMIN", orgId: ORG_A };
    member("u_owner", ORG_A, "OWNER");
    for (const p of MONEY) {
      const r = await checkPermission(p);
      expect(r.ok).toBe(true);
      await expect(requirePermission(p)).resolves.toMatchObject({ session: { orgId: ORG_A } });
    }
    await expect(requireOwner()).resolves.toBeTruthy();
  });

  it.each(["fees.collect", "payroll.view", "reports.view"] as Permission[])(
    "manager with %s turned off is refused",
    async (perm) => {
      session = { id: "u_mgr", role: "ADMIN", orgId: ORG_A };
      member("u_mgr", ORG_A, "MANAGER", {
        permissions: JSON.stringify({ "fees.collect": false, "payroll.view": false, "reports.view": false }),
      });
      const r = await checkPermission(perm);
      expect(r).toEqual({ ok: false, error: "You don't have permission to do this" });
      await expect(requirePermission(perm)).rejects.toThrow("You don't have permission to do this");
    },
  );

  it("manager is refused owner-only actions", async () => {
    session = { id: "u_mgr", role: "ADMIN", orgId: ORG_A };
    member("u_mgr", ORG_A, "MANAGER");
    expect((await checkPermission("settings.manage")).ok).toBe(false);
    await expect(requireOwner()).rejects.toThrow("Only the academy owner can do this");
  });

  it("suspended membership is refused", async () => {
    session = { id: "u_owner", role: "ADMIN", orgId: ORG_A };
    member("u_owner", ORG_A, "OWNER", { status: "REMOVED" });
    expect(await checkPermission("fees.collect")).toEqual({ ok: false, error: "You are not an active member of this academy" });
  });

  it("session without an academy is refused", async () => {
    session = { id: "u_x", role: "ADMIN", orgId: null };
    expect(await checkPermission("fees.collect")).toEqual({ ok: false, error: "No academy found" });
  });

  it("non-admin app roles (coach) are bounced by requireAuth, not silently allowed", async () => {
    session = { id: "u_coach", role: "COACH", orgId: ORG_A };
    member("u_coach", ORG_A, "COACH");
    await expect(checkPermission("fees.collect")).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("tenant isolation", () => {
  it("owner of org A is refused when the session points at org B", async () => {
    member("u_owner", ORG_A, "OWNER");
    session = { id: "u_owner", role: "ADMIN", orgId: ORG_B };
    expect(await checkPermission("fees.collect")).toEqual({ ok: false, error: "You are not an active member of this academy" });
    expect(await checkPermission(null)).toMatchObject({ ok: false });
    await expect(requireOwner()).rejects.toThrow("You are not an active member of this academy");
  });

  it("membership lookups are scoped to the exact org", async () => {
    member("u_owner", ORG_A, "OWNER");
    member("u_other", ORG_B, "OWNER");
    expect(await getMembership("u_owner", ORG_A)).toMatchObject({ orgId: ORG_A });
    expect(await getMembership("u_owner", ORG_B)).toBeNull();
    expect(await isOrgOwner("u_owner", ORG_A)).toBe(true);
    expect(await isOrgOwner("u_owner", ORG_B)).toBe(false);
    expect(await isOrgOwner("u_owner", null)).toBe(false);
  });

  it("returned context always carries the session's own org id", async () => {
    member("u_owner", ORG_A, "OWNER");
    session = { id: "u_owner", role: "ADMIN", orgId: ORG_A };
    const r = await checkPermission("fees.collect");
    expect(r.ok && r.session.orgId).toBe(ORG_A);
    expect(r.ok && r.membership.orgId).toBe(ORG_A);
  });

  it("hasPermission respects per-person overrides", () => {
    expect(hasPermission({ role: "MANAGER", permissions: JSON.stringify({ "payroll.view": false }) }, "payroll.view")).toBe(false);
    expect(hasPermission({ role: "STAFF", staffRole: "ACCOUNTANT" }, "payroll.view")).toBe(true);
    expect(hasPermission({ role: "STAFF", staffRole: "RECEPTIONIST" }, "payroll.view")).toBe(false);
  });
});

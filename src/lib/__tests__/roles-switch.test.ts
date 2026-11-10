import { describe, it, expect, vi, beforeEach } from "vitest";

// ── In-memory "database" ──
type U = { id: string; name: string; role: string; orgId: string | null; sessionVersion: number };
const users: U[] = [];
const memberships: { userId: string; orgId: string; role: string; status: string }[] = [];
const students: { id: string; parentId: string; orgId: string; name: string }[] = [];
const auditLogs: any[] = [];
const ORGS: Record<string, string> = { org_A: "Ace Academy", org_B: "Bat Club" };

function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([k, v]) => row[k] === v);
}

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        const u = users.find((x) => x.id === where.id);
        if (!u) return null;
        return { ...u, email: null, lastSeenAt: new Date(), org: u.orgId ? { id: u.orgId, name: ORGS[u.orgId], slug: u.orgId } : null };
      }),
      update: vi.fn(() => Promise.resolve({})),
    },
    orgMembership: {
      findMany: vi.fn(async ({ where }: any) => memberships.filter((r) => matches(r, where))),
    },
    student: {
      findFirst: vi.fn(async ({ where }: any) => students.find((s) => matches(s, where)) ?? null),
      findMany: vi.fn(async ({ where }: any) => students.filter((s) => matches(s, where))),
    },
    guardianLink: { findMany: vi.fn(async () => []) },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      }),
    },
  },
}));

vi.mock("@/lib/schema-ensure", () => ({ ensureTeamSchema: vi.fn(async () => {}) }));

// ── Cookies and redirects ──
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

import {
  ACTIVE_ROLE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createSignedCookie,
  getActiveHat,
  getSession,
  requireAuth,
} from "@/lib/auth";
import { switchRole } from "@/app/actions/roles";
import { loadHeldHats } from "@/lib/roles/server";
import { studentAccessFilter } from "@/lib/athlete-access";
import { SWITCH_ROLE_REFUSED } from "@/lib/roles/hats";
import { db } from "@/lib/db";

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  throw new Error("expected a redirect");
}

function signIn(id: string) {
  const u = users.find((x) => x.id === id)!;
  jar.set(SESSION_COOKIE_NAME, createSignedCookie({ id, role: u.role, sv: u.sessionVersion }));
}

beforeEach(() => {
  users.length = 0;
  memberships.length = 0;
  students.length = 0;
  auditLogs.length = 0;
  jar.clear();
  vi.clearAllMocks();

  // Coach at Ace Academy whose own child also trains there.
  users.push({ id: "coach1", name: "Coach Ravi", role: "COACH", orgId: "org_A", sessionVersion: 0 });
  memberships.push({ userId: "coach1", orgId: "org_A", role: "COACH", status: "ACTIVE" });
  students.push({ id: "kid_coach", parentId: "coach1", orgId: "org_A", name: "Aarav" });
  // A parent-only user with a child at the same academy.
  users.push({ id: "parent1", name: "Priya", role: "PARENT", orgId: "org_A", sessionVersion: 0 });
  students.push({ id: "kid_other", parentId: "parent1", orgId: "org_A", name: "Diya" });
  // A plain single-role coach.
  users.push({ id: "coach2", name: "Coach Sam", role: "COACH", orgId: "org_A", sessionVersion: 0 });
  memberships.push({ userId: "coach2", orgId: "org_A", role: "COACH", status: "ACTIVE" });
});

describe("loadHeldHats (recomputed from the database)", () => {
  it("coach with a child holds coach + parent and sees the academy name", async () => {
    const held = await loadHeldHats("coach1");
    expect(held?.hats).toEqual(["coach", "parent"]);
    expect(held?.defaultHat).toBe("coach");
    expect(held?.orgName).toBe("Ace Academy");
  });

  it("parent-only user holds only the parent hat", async () => {
    expect((await loadHeldHats("parent1"))?.hats).toEqual(["parent"]);
  });

  it("only the active academy's memberships count", async () => {
    memberships.push({ userId: "parent1", orgId: "org_B", role: "COACH", status: "ACTIVE" });
    expect((await loadHeldHats("parent1"))?.hats).toEqual(["parent"]);
  });
});

describe("switchRole", () => {
  it("refuses a hat the person does not hold: parent-only user cannot switch to coach", async () => {
    signIn("parent1");
    const res = await switchRole("coach");
    expect(res).toEqual({ ok: false, error: SWITCH_ROLE_REFUSED });
    expect(jar.has(ACTIVE_ROLE_COOKIE_NAME)).toBe(false);
    expect(auditLogs).toHaveLength(0);
    // And they still cannot open coach pages.
    expect(await redirectOf(requireAuth(["COACH", "ADMIN"]))).toBe("/parent");
  });

  it("refuses admin/ops/unknown hats for a coach", async () => {
    signIn("coach1");
    for (const h of ["admin", "ops", "staff", "ADMIN", "", "__proto__"]) {
      expect(await switchRole(h)).toEqual({ ok: false, error: SWITCH_ROLE_REFUSED });
    }
    expect(jar.has(ACTIVE_ROLE_COOKIE_NAME)).toBe(false);
    expect(auditLogs).toHaveLength(0);
  });

  it("signed-out callers are sent to login", async () => {
    expect(await redirectOf(switchRole("parent"))).toBe("/login");
  });

  it("switches a coach with a child to parent: audit row, signed claim, redirect home", async () => {
    signIn("coach1");
    expect(await redirectOf(switchRole("parent"))).toBe("/parent");
    expect(jar.has(ACTIVE_ROLE_COOKIE_NAME)).toBe(true);
    expect(auditLogs).toEqual([
      { userId: "coach1", orgId: "org_A", action: "SWITCH_ROLE", details: JSON.stringify({ from: "coach", to: "parent" }) },
    ]);
  });

  it("switching back to the default hat clears the claim", async () => {
    signIn("coach1");
    await redirectOf(switchRole("parent"));
    expect(await redirectOf(switchRole("coach"))).toBe("/coach");
    expect(jar.has(ACTIVE_ROLE_COOKIE_NAME)).toBe(false);
    expect(JSON.parse(auditLogs[1].details)).toEqual({ from: "parent", to: "coach" });
  });
});

describe("requireAuth honours the active hat", () => {
  it("a COACH with a child can open /parent views, scoped to their own child only", async () => {
    signIn("coach1");
    // Before switching: parent pages bounce to the coach app, as today.
    expect(await redirectOf(requireAuth(["PARENT"]))).toBe("/coach");

    await redirectOf(switchRole("parent"));
    const session = await requireAuth(["PARENT"]);
    expect(session.id).toBe("coach1");
    expect(session.role).toBe("PARENT");
    expect(session.orgId).toBe("org_A");

    // The same filter the athlete and parent pages use: their own child, nobody else's.
    const where = studentAccessFilter(session);
    expect(where).toEqual({ parentId: "coach1", orgId: "org_A" });
    const visible = students.filter((s) => s.parentId === (where as any).parentId && s.orgId === (where as any).orgId);
    expect(visible.map((s) => s.id)).toEqual(["kid_coach"]);
  });

  it("the parent hat does not open admin pages; it redirects to the active hat's home", async () => {
    signIn("coach1");
    await redirectOf(switchRole("parent"));
    expect(await redirectOf(requireAuth(["ADMIN"]))).toBe("/parent");
    expect(await redirectOf(requireAuth(["SUPER_ADMIN"]))).toBe("/parent");
  });

  it("the person's own role still works while viewing as another hat (no narrowing)", async () => {
    signIn("coach1");
    await redirectOf(switchRole("parent"));
    const s = await requireAuth(["COACH", "ADMIN"]);
    expect(s.role).toBe("COACH");
  });

  it("a forged claim (wrong signature) is ignored", async () => {
    signIn("parent1");
    jar.set(ACTIVE_ROLE_COOKIE_NAME, JSON.stringify({ id: "parent1", hat: "coach", sv: 0 }) + ".deadbeef");
    expect(await redirectOf(requireAuth(["COACH"]))).toBe("/parent");
  });

  it("a validly signed claim for an unheld hat is ignored (hats are recomputed)", async () => {
    signIn("parent1");
    jar.set(ACTIVE_ROLE_COOKIE_NAME, createSignedCookie({ id: "parent1", hat: "coach", sv: 0 }));
    expect(await redirectOf(requireAuth(["COACH"]))).toBe("/parent");
    expect(await getActiveHat((await getSession())!)).toBeNull();
  });

  it("a claim minted for another user is ignored", async () => {
    signIn("coach2");
    jar.set(ACTIVE_ROLE_COOKIE_NAME, createSignedCookie({ id: "coach1", hat: "parent", sv: 0 }));
    expect(await redirectOf(requireAuth(["PARENT"]))).toBe("/coach");
  });

  it("losing the hat later (child removed) closes the view immediately", async () => {
    signIn("coach1");
    await redirectOf(switchRole("parent"));
    students.splice(students.findIndex((s) => s.id === "kid_coach"), 1);
    expect(await redirectOf(requireAuth(["PARENT"]))).toBe("/coach");
  });

  it("sign-out-everywhere (session version bump) kills the claim with the session", async () => {
    signIn("coach1");
    await redirectOf(switchRole("parent"));
    users.find((u) => u.id === "coach1")!.sessionVersion = 1;
    expect(await redirectOf(requireAuth(["PARENT"]))).toBe("/login");
  });
});

describe("single-role users see no change", () => {
  it("coach without a claim: same redirects, and no hat queries", async () => {
    signIn("coach2");
    const s = await requireAuth(["COACH"]);
    expect(s.role).toBe("COACH");
    expect(await redirectOf(requireAuth(["PARENT"]))).toBe("/coach");
    expect(await redirectOf(requireAuth(["ADMIN"]))).toBe("/coach");
    expect(db.orgMembership.findMany).not.toHaveBeenCalled();
    expect(db.student.findFirst).not.toHaveBeenCalled();
    expect(db.student.findMany).not.toHaveBeenCalled();
  });

  it("parent-only user: same redirect as before", async () => {
    signIn("parent1");
    expect(await redirectOf(requireAuth(["STAFF"]))).toBe("/parent");
    expect((await requireAuth(["PARENT"])).role).toBe("PARENT");
  });
});

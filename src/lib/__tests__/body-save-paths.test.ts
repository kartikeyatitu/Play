import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// ── Flags, session, membership and a mocked database ──
const flags = vi.hoisted(() => ({ fitnessTests: true, drillLibrary: true }));
const who = vi.hoisted(() => ({
  session: { id: "coach1", role: "COACH", orgId: "org1", name: "Coach One" } as Record<string, any>,
  membership: { role: "COACH", status: "ACTIVE", staffRole: null, permissions: null } as Record<string, any> | null,
}));

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn<(...args: any[]) => any>();
  return {
    studentFindFirst: fn(),
    fitnessFindMany: fn(),
    fitnessCreate: fn(),
    batchFindMany: fn(),
    batchFindFirst: fn(),
    drillFindMany: fn(),
    planFindFirst: fn(),
    planCreate: fn(),
    planUpdate: fn(),
    itemDeleteMany: fn(),
    itemCreateMany: fn(),
    auditCreate: fn(),
    transaction: fn(),
  };
});

vi.mock("@/lib/features", () => ({ FEATURES: flags }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => who.session) }));
vi.mock("@/lib/membership", async () => {
  const team = await import("@/lib/team");
  return {
    getMembership: vi.fn(async () => who.membership),
    hasPermission: (m: any, p: any) => team.effectivePermissions(m.role, m.staffRole, m.permissions).has(p),
  };
});
vi.mock("@/lib/db", () => {
  const tx = {
    sessionPlan: { create: mocks.planCreate, update: mocks.planUpdate },
    sessionPlanItem: { deleteMany: mocks.itemDeleteMany, createMany: mocks.itemCreateMany },
  };
  mocks.transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
  return {
    db: {
      student: { findFirst: mocks.studentFindFirst },
      fitnessResult: { findMany: mocks.fitnessFindMany, create: mocks.fitnessCreate },
      batch: { findMany: mocks.batchFindMany, findFirst: mocks.batchFindFirst },
      drill: { findMany: mocks.drillFindMany },
      sessionPlan: { findFirst: mocks.planFindFirst },
      auditLog: { create: mocks.auditCreate },
      $transaction: mocks.transaction,
    },
  };
});

import { recordFitnessResult, saveSessionPlan } from "@/app/actions/body";

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

/** Run a server action that always ends in redirect(); return the redirect URL's search params. */
async function run(action: (fd: FormData) => Promise<unknown>, fd: FormData) {
  try {
    await action(fd);
  } catch (e) {
    if (e instanceof RedirectError) {
      const u = new URL(e.url, "http://x");
      return { path: u.pathname, params: Object.fromEntries(u.searchParams) };
    }
    throw e;
  }
  throw new Error("action did not redirect");
}

const asCoach = (id = "coach1") => {
  who.session = { id, role: "COACH", orgId: "org1", name: "Coach" };
  who.membership = { role: "COACH", status: "ACTIVE", staffRole: null, permissions: null };
};

/** Coach coach1 teaches batch b1 with kidA; kidZ is in another coach's batch. */
function coachStudentLookup({ where }: any) {
  const coachId = where.enrollments?.some?.batch?.coachId;
  if (where.orgId !== "org1") return null;
  if (where.id === "kidA" && (coachId === undefined || coachId === "coach1")) return { id: "kidA" };
  if (where.id === "kidZ" && (coachId === undefined || coachId === "coach2")) return { id: "kidZ" };
  return null;
}

const res = (id: string, testKey: string, value: number, unit: string, day: string) => ({
  id,
  testKey,
  value: new Prisma.Decimal(value),
  unit,
  recordedAt: new Date(`${day}T00:00:00.000Z`),
});

beforeEach(() => {
  flags.fitnessTests = true;
  flags.drillLibrary = true;
  asCoach();
  for (const m of Object.values(mocks)) if (m !== mocks.transaction) m.mockReset();
  mocks.studentFindFirst.mockImplementation(async (a: any) => coachStudentLookup(a));
  mocks.fitnessFindMany.mockResolvedValue([]);
  mocks.fitnessCreate.mockResolvedValue({ id: "r_new" });
  mocks.batchFindMany.mockImplementation(async ({ where }: any) =>
    [
      { id: "b1", name: "U12", sport: "football", coachId: "coach1" },
      { id: "b2", name: "U14", sport: "cricket", coachId: "coach2" },
    ]
      .filter((b) => !where.coachId || b.coachId === where.coachId)
      .map(({ coachId: _c, ...b }) => b),
  );
  mocks.batchFindFirst.mockImplementation(async ({ where }: any) => ({ b1: { coachId: "coach1" }, b2: { coachId: "coach2" } } as any)[where.id] ?? null);
  mocks.drillFindMany.mockResolvedValue([{ id: "drillownaaaaaa1" }]);
  mocks.planCreate.mockResolvedValue({ id: "plan_new" });
  mocks.auditCreate.mockResolvedValue({});
});

// ───────────────────────────── recordFitnessResult ─────────────────────────────

describe("recordFitnessResult", () => {
  const ok = { studentId: "kidA", testKey: "sprint_30m", value: "4.9", date: "2026-11-01" };

  it("does nothing when the fitnessTests flag is off", async () => {
    flags.fitnessTests = false;
    const r = await run(recordFitnessResult, form(ok));
    expect(r.params.error).toMatch(/Not enabled/);
    expect(mocks.studentFindFirst).not.toHaveBeenCalled();
    expect(mocks.fitnessFindMany).not.toHaveBeenCalled();
    expect(mocks.fitnessCreate).not.toHaveBeenCalled();
  });

  it("refuses a coach recording for an athlete outside their batches", async () => {
    const r = await run(recordFitnessResult, form({ ...ok, studentId: "kidZ" }));
    expect(r.params.error).toMatch(/own batches/);
    expect(mocks.studentFindFirst.mock.calls[0][0].where).toMatchObject({ id: "kidZ", orgId: "org1", enrollments: { some: { batch: { coachId: "coach1" } } } });
    expect(mocks.fitnessFindMany).not.toHaveBeenCalled();
    expect(mocks.fitnessCreate).not.toHaveBeenCalled();
  });

  it("refuses parents, even for their own child", async () => {
    who.session = { id: "parent1", role: "PARENT", orgId: "org1" };
    who.membership = null;
    mocks.studentFindFirst.mockResolvedValue({ id: "kidA" });
    const r = await run(recordFitnessResult, form(ok));
    expect(r.params.error).toBeTruthy();
    expect(mocks.fitnessCreate).not.toHaveBeenCalled();
  });

  it("saves for the coach's own athlete and flags a new personal best (lower is better)", async () => {
    mocks.fitnessFindMany.mockResolvedValue([res("r1", "sprint_30m", 5.2, "s", "2026-09-01"), res("r2", "sprint_30m", 5.0, "s", "2026-10-01")]);
    const r = await run(recordFitnessResult, form(ok));
    expect(r.params).toMatchObject({ saved: "1", pb: "sprint_30m" });
    expect(mocks.fitnessFindMany.mock.calls[0][0].where).toEqual({ orgId: "org1", studentId: "kidA", testKey: "sprint_30m", unit: "s" });
    expect(mocks.fitnessCreate.mock.calls[0][0].data).toMatchObject({
      orgId: "org1",
      studentId: "kidA",
      testKey: "sprint_30m",
      value: 4.9,
      unit: "s",
      recordedById: "coach1",
      recordedAt: new Date("2026-11-01T00:00:00.000Z"),
    });
  });

  it("does not flag a slower time or an equal one", async () => {
    mocks.fitnessFindMany.mockResolvedValue([res("r1", "sprint_30m", 4.9, "s", "2026-10-01")]);
    expect((await run(recordFitnessResult, form({ ...ok, value: "5.10" }))).params.pb).toBeUndefined();
    expect((await run(recordFitnessResult, form({ ...ok, value: "4.9" }))).params.pb).toBeUndefined();
    expect(mocks.fitnessCreate).toHaveBeenCalledTimes(2);
  });

  it("higher is better for jumps; the first result is a personal best", async () => {
    const jump = { ...ok, testKey: "vertical_jump", value: "41.5" };
    expect((await run(recordFitnessResult, form(jump))).params.pb).toBe("vertical_jump");
    mocks.fitnessFindMany.mockResolvedValue([res("r1", "vertical_jump", 42, "cm", "2026-10-01")]);
    expect((await run(recordFitnessResult, form(jump))).params.pb).toBeUndefined();
    expect((await run(recordFitnessResult, form({ ...jump, value: "42.5" }))).params.pb).toBe("vertical_jump");
  });

  it("rejects out-of-range values and unknown tests before saving", async () => {
    expect((await run(recordFitnessResult, form({ ...ok, value: "1" }))).params.error).toMatch(/between/);
    expect((await run(recordFitnessResult, form({ ...ok, testKey: "nope" }))).params.error).toMatch(/catalogue/);
    expect(mocks.fitnessCreate).not.toHaveBeenCalled();
  });
});

// ───────────────────────────── saveSessionPlan ─────────────────────────────

describe("saveSessionPlan", () => {
  const items = JSON.stringify([
    { title: "Warm up", durationMin: 10 },
    { title: "Rondo", durationMin: 15, drillId: "drillownaaaaaa1" },
    { title: "Someone else's drill", durationMin: 5, drillId: "drillotheraaaa2" },
  ]);
  const ok = { title: "Tuesday", batchId: "b1", date: "2026-11-10", sport: "football", sessionMinutes: "60", items };

  it("does nothing when the drillLibrary flag is off", async () => {
    flags.drillLibrary = false;
    const r = await run(saveSessionPlan, form(ok));
    expect(r.params.error).toMatch(/Not enabled/);
    expect(mocks.batchFindMany).not.toHaveBeenCalled();
    expect(mocks.drillFindMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses a coach planning for a batch that is not theirs", async () => {
    const r = await run(saveSessionPlan, form({ ...ok, batchId: "b2" }));
    expect(r.params.error).toMatch(/own batches/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses a coach editing another coach's plan", async () => {
    mocks.planFindFirst.mockResolvedValue({ id: "p2", orgId: "org1", batchId: "b2", createdById: "coach2" });
    const r = await run(saveSessionPlan, form({ ...ok, planId: "p2" }));
    expect(r.path).toBe("/body/plans");
    expect(r.params.error).toMatch(/own batches/);
    expect(mocks.planFindFirst.mock.calls[0][0].where).toEqual({ id: "p2", orgId: "org1" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses parents", async () => {
    who.session = { id: "parent1", role: "PARENT", orgId: "org1" };
    who.membership = null;
    const r = await run(saveSessionPlan, form(ok));
    expect(r.params.error).toMatch(/Only coaches/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a plan for the coach's own batch; foreign drill ids become free text", async () => {
    const r = await run(saveSessionPlan, form(ok));
    expect(r).toEqual({ path: "/body/plans/plan_new", params: { saved: "1" } });
    expect(mocks.drillFindMany.mock.calls[0][0].where).toEqual({ id: { in: ["drillownaaaaaa1", "drillotheraaaa2"] }, orgId: "org1", archivedAt: null });
    expect(mocks.planCreate.mock.calls[0][0].data).toMatchObject({
      orgId: "org1",
      title: "Tuesday",
      sport: "football",
      batchId: "b1",
      date: new Date("2026-11-10T00:00:00.000Z"),
      notes: "[length:60]",
      createdById: "coach1",
    });
    const rows = mocks.itemCreateMany.mock.calls[0][0].data;
    expect(rows.map((i: any) => [i.planId, i.order, i.drillId, i.orgId])).toEqual([
      ["plan_new", 0, null, "org1"],
      ["plan_new", 1, "drillownaaaaaa1", "org1"],
      ["plan_new", 2, null, "org1"],
    ]);
  });

  it("updates the coach's own plan in place and replaces its items", async () => {
    mocks.planFindFirst.mockResolvedValue({ id: "p1", orgId: "org1", batchId: "b1", createdById: "coach1" });
    const r = await run(saveSessionPlan, form({ ...ok, planId: "p1" }));
    expect(r.path).toBe("/body/plans/p1");
    expect(mocks.planCreate).not.toHaveBeenCalled();
    expect(mocks.planUpdate.mock.calls[0][0].where).toEqual({ id: "p1" });
    expect(mocks.itemDeleteMany.mock.calls[0][0].where).toEqual({ planId: "p1", orgId: "org1" });
    expect(mocks.itemCreateMany.mock.calls[0][0].data.every((i: any) => i.planId === "p1")).toBe(true);
  });

  it("rejects a plan with no items or bad durations", async () => {
    expect((await run(saveSessionPlan, form({ ...ok, items: "[]" }))).params.error).toMatch(/at least one/);
    expect((await run(saveSessionPlan, form({ ...ok, items: JSON.stringify([{ title: "x", durationMin: 0 }]) }))).params.error).toMatch(/duration/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory ledgers, enough of Prisma's filter language for the rewards server.
type Row = { orgId: string; studentId: string; delta: number; sourceType: string; idempotencyKey: string; createdAt?: Date; reasonCode: string };

const store = vi.hoisted(() => ({ xp: [] as Row[], points: [] as Row[] }));
const flags = vi.hoisted(() => ({ rewards: true }));

function matches(row: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(row, w));
    const v = row[k];
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      const c = cond as Record<string, unknown>;
      if ("startsWith" in c) return typeof v === "string" && v.startsWith(String(c.startsWith));
      if ("gt" in c) return typeof v === "number" && v > Number(c.gt);
      if ("in" in c) return (c.in as unknown[]).includes(v);
      if ("gte" in c || "lt" in c) return true;
      return true;
    }
    return v === cond;
  });
}

function table(rows: () => Row[]) {
  return {
    aggregate: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const hit = rows().filter((r) => matches(r, where));
      return { _sum: { delta: hit.length ? hit.reduce((s, r) => s + r.delta, 0) : null }, _count: { _all: hit.length } };
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      if (rows().some((r) => r.idempotencyKey === data.idempotencyKey)) {
        const { Prisma } = await import("@prisma/client");
        throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" });
      }
      rows().push({ ...data });
      return data;
    }),
    findMany: vi.fn(async () => []),
  };
}

const db = vi.hoisted(() => ({}) as Record<string, any>);
Object.assign(db, {
  xpLedger: table(() => store.xp),
  pointsLedger: table(() => store.points),
  student: { findFirst: vi.fn(async () => ({ id: "s1" })) },
  // Badge evaluation runs after each award; it has nothing to find here.
  badgeDefinition: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({})) },
  studentBadge: { findMany: vi.fn(async () => []), createMany: vi.fn(async () => ({ count: 0 })) },
  attendance: { findMany: vi.fn(async () => []) },
  auditLog: { findFirst: vi.fn(async () => null), create: vi.fn() },
  organization: { findUnique: vi.fn(async () => ({ timezone: "Asia/Kolkata" })) },
  $transaction: vi.fn(async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => unknown)(db) : Promise.all(arg as Promise<unknown>[]))),
});

vi.mock("@/lib/features", () => ({ FEATURES: flags }));
vi.mock("@/lib/db", () => ({ db }));

import { awardForSource, reverseAwardForSource, syncAttendanceReward, netForKey } from "@/lib/rewards/server";
import { earnKey } from "@/lib/rewards/ledger";
import { matchRewardFor } from "@/lib/rewards/match";

const ORG = "o1";
const S = "s1";
const key = earnKey("SESSION_ATTENDED", "sess1", S);
const balance = () => store.points.reduce((s, r) => s + r.delta, 0);

beforeEach(() => {
  store.xp.length = 0;
  store.points.length = 0;
  flags.rewards = true;
});

describe("attendance rewards", () => {
  it("awards once for a present mark, however many times it is saved", async () => {
    await syncAttendanceReward({ orgId: ORG, sessionId: "sess1", studentId: S, present: true });
    await syncAttendanceReward({ orgId: ORG, sessionId: "sess1", studentId: S, present: true });
    const net = await netForKey(key);
    expect(net.xp).toBeGreaterThan(0);
    expect(store.xp).toHaveLength(1);
  });

  it("takes the award back when corrected to absent, and gives it again when corrected back", async () => {
    await syncAttendanceReward({ orgId: ORG, sessionId: "sess1", studentId: S, present: true });
    const earned = (await netForKey(key)).points;
    await syncAttendanceReward({ orgId: ORG, sessionId: "sess1", studentId: S, present: false });
    expect(await netForKey(key)).toMatchObject({ xp: 0, points: 0 });
    expect(store.points.every((r) => r.delta > 0 || r.reasonCode === "REVERSAL")).toBe(true);

    await syncAttendanceReward({ orgId: ORG, sessionId: "sess1", studentId: S, present: true });
    expect((await netForKey(key)).points).toBe(earned);
    // append-only: nothing deleted, every key unique
    const keys = store.points.map((r) => r.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(store.points).toHaveLength(3);
  });

  it("an absent mark with nothing earned writes nothing (a missed session never costs anything)", async () => {
    await syncAttendanceReward({ orgId: ORG, sessionId: "sess1", studentId: S, present: false });
    expect(store.xp).toHaveLength(0);
    expect(store.points).toHaveLength(0);
  });

  it("never pushes a balance below zero when the points were already spent", async () => {
    await awardForSource({ orgId: ORG, studentId: S, trigger: "SESSION_ATTENDED", sourceId: "sess1" });
    const earned = balance();
    store.points.push({ orgId: ORG, studentId: S, delta: -earned, sourceType: "REDEMPTION", idempotencyKey: "redeem:x", reasonCode: "REDEEM" });
    const r = await reverseAwardForSource({ orgId: ORG, studentId: S, trigger: "SESSION_ATTENDED", sourceId: "sess1" });
    expect(r.ok).toBe(true);
    expect(balance()).toBe(0);
  });

  it("does nothing while rewards are off", async () => {
    flags.rewards = false;
    await syncAttendanceReward({ orgId: ORG, sessionId: "sess1", studentId: S, present: true });
    expect(db.xpLedger.aggregate).not.toHaveBeenCalled();
    expect(store.xp).toHaveLength(0);
  });
});

describe("matchRewardFor", () => {
  it("reads a win from the stat line", () => {
    expect(matchRewardFor({ family: "rally", result: "W" })).toEqual({ played: true, won: true, tags: [] });
    expect(matchRewardFor({ family: "rally", result: "L" }).won).toBe(false);
    expect(matchRewardFor(null).played).toBe(false);
  });

  it("gives a clean sheet only in sports where it means something", () => {
    const line = { family: "goals", result: "W", teamFor: 2, teamAgainst: 0, points: 0, assists: 0 };
    expect(matchRewardFor(line, "football").tags).toContain("CLEAN_SHEET");
    expect(matchRewardFor(line, "basketball").tags).not.toContain("CLEAN_SHEET");
    expect(matchRewardFor({ ...line, teamAgainst: 1 }, "football").tags).not.toContain("CLEAN_SHEET");
  });

  it("calls a match all-round when a player contributed in two ways", () => {
    expect(matchRewardFor({ family: "goals", result: "D", points: 1, assists: 1, teamAgainst: 2 }, "football").tags).toEqual(["ALL_ROUND"]);
    expect(matchRewardFor({ family: "cricket", result: "L", batting: { runs: 12 }, bowling: { wickets: 1 }, catches: 0 }).tags).toEqual(["ALL_ROUND"]);
    expect(matchRewardFor({ family: "cricket", result: "L", batting: { runs: 30 }, bowling: null, catches: 0 }).tags).toEqual([]);
    expect(matchRewardFor({ family: "cricket", result: "W", batting: null, bowling: { wickets: 2 }, catches: 1 }).tags).toEqual(["ALL_ROUND"]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Flags, session and an in-memory database ──
const flags = vi.hoisted(() => ({ eventWaitlist: true }));
const session = vi.hoisted(() => ({ current: { id: "parent1", role: "PARENT", orgId: "org1" } as { id: string; role: string; orgId: string | null } }));

type Row = Record<string, any>;
const store = vi.hoisted(() => ({
  waitlist: [] as Row[],
  audit: [] as Row[],
  rsvps: [] as Row[],
  calls: 0,
  seq: 0,
}));

const EVENT = { id: "ev1", orgId: "org1", date: new Date(Date.now() + 7 * 864e5), title: "Friendly", batch: { orgId: "org1", coachId: "coach1" } };
const STUDENTS = [
  { id: "kidA", parentId: "parent1", name: "Asha" },
  { id: "kidB", parentId: "parent2", name: "Bilal" },
  { id: "kidC", parentId: "parent3", name: "Chitra" },
];
const ENROLLED = new Set(["kidA", "kidB", "kidC"]);

vi.mock("@/lib/features", () => ({ FEATURES: flags }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => session.current) }));
vi.mock("@/lib/db", () => {
  const touch = () => void store.calls++;
  const pick = (r: Row) => ({ ...r });
  const db: any = {
    $transaction: async (fn: (tx: any) => any) => fn(db),
    eventWaitlist: {
      findMany: vi.fn(async ({ where }: any) => {
        touch();
        let rows = store.waitlist;
        if (where.eventId) rows = rows.filter((r) => r.eventId === where.eventId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.offerExpiresAt?.lte) rows = rows.filter((r) => r.offerExpiresAt && r.offerExpiresAt <= where.offerExpiresAt.lte);
        return rows.map(pick);
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        touch();
        const k = where.eventId_studentId;
        return store.waitlist.find((r) => r.eventId === k.eventId && r.studentId === k.studentId) ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        touch();
        if (store.waitlist.some((r) => r.eventId === data.eventId && r.studentId === data.studentId)) throw new Error("unique");
        const row = { id: `w${++store.seq}`, ...data };
        store.waitlist.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        touch();
        const row = store.waitlist.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    auditLog: {
      findFirst: vi.fn(async ({ where }: any) => {
        touch();
        const rows = store.audit.filter((r) => where.action.in.includes(r.action) && r.details.includes(where.details.contains));
        return rows[rows.length - 1] ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        touch();
        store.audit.push(data);
        return data;
      }),
    },
    rSVP: {
      findUnique: vi.fn(async ({ where }: any) => {
        touch();
        const k = where.eventId_studentId;
        return store.rsvps.find((r) => r.eventId === k.eventId && r.studentId === k.studentId) ?? null;
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        touch();
        const k = where.eventId_studentId;
        const row = store.rsvps.find((r) => r.eventId === k.eventId && r.studentId === k.studentId);
        if (row) Object.assign(row, update);
        else store.rsvps.push({ ...create });
        return row;
      }),
    },
    student: {
      findFirst: vi.fn(async ({ where }: any) => {
        touch();
        return STUDENTS.find((s) => s.id === where.id && s.parentId === where.parentId) ?? null;
      }),
      findMany: vi.fn(async ({ where }: any) => STUDENTS.filter((s) => where.id.in.includes(s.id))),
    },
    event: {
      findFirst: vi.fn(async ({ where }: any) => {
        touch();
        if (where.id !== EVENT.id) return null;
        const b = where.batch;
        if (b.enrollments) return ENROLLED.has(b.enrollments.some.studentId) ? EVENT : null;
        if (b.orgId !== EVENT.batch.orgId) return null;
        if (b.coachId && b.coachId !== EVENT.batch.coachId) return null;
        return EVENT;
      }),
      findUnique: vi.fn(async ({ where }: any) => (where.id === EVENT.id ? EVENT : null)),
    },
  };
  return { db };
});

import {
  acceptEventWaitlistOffer,
  getEventWaitlistForFamily,
  getEventWaitlistForOrganiser,
  joinEventWaitlist,
  leaveEventWaitlist,
  offerNextEventPlaces,
  setEventWaitlistFull,
} from "@/app/actions/event-waitlist";
import { eventWaitlistAfterRsvp, eventWaitlistRsvpGate, processExpiredEventOffers } from "@/lib/events/waitlist-server";
import { GET as cronGET } from "@/app/api/cron/event-waitlist/route";

const asParent = (n: 1 | 2 | 3) => (session.current = { id: `parent${n}`, role: "PARENT", orgId: "org1" });
const asCoach = (id = "coach1") => (session.current = { id, role: "COACH", orgId: "org1" });
const row = (s: string) => store.waitlist.find((r) => r.studentId === s);

beforeEach(() => {
  flags.eventWaitlist = true;
  store.waitlist = [];
  store.audit = [];
  store.rsvps = STUDENTS.map((s) => ({ eventId: "ev1", studentId: s.id, status: "PENDING", orgId: "org1" }));
  store.calls = 0;
});

describe("flag off", () => {
  it("every action, hook and the expiry job do nothing and touch no table", async () => {
    flags.eventWaitlist = false;
    asParent(1);
    expect(await getEventWaitlistForFamily("ev1", "kidA")).toEqual({ enabled: false });
    expect((await joinEventWaitlist("ev1", "kidA")).success).toBe(false);
    expect((await acceptEventWaitlistOffer("ev1", "kidA")).success).toBe(false);
    expect((await leaveEventWaitlist("ev1", "kidA")).success).toBe(false);
    asCoach();
    expect(await getEventWaitlistForOrganiser("ev1")).toEqual({ enabled: false });
    expect((await setEventWaitlistFull("ev1", true)).success).toBe(false);
    expect((await offerNextEventPlaces("ev1")).success).toBe(false);
    expect(await eventWaitlistRsvpGate("ev1", "kidA", "GOING")).toEqual({ wasGoing: false });
    await eventWaitlistAfterRsvp({ id: "ev1", orgId: "org1" }, "coach1", true, "NOT_GOING");
    expect(await processExpiredEventOffers()).toMatchObject({ enabled: false });
    expect(store.calls).toBe(0);
  });
});

describe("parents", () => {
  it("can join only when the organiser has marked the event full", async () => {
    asParent(1);
    expect(await joinEventWaitlist("ev1", "kidA")).toMatchObject({ success: false, error: expect.stringMatching(/places left/) });
    asCoach();
    expect((await setEventWaitlistFull("ev1", true)).success).toBe(true);
    asParent(1);
    expect(await joinEventWaitlist("ev1", "kidA")).toEqual({ success: true, position: 1 });
    expect(await joinEventWaitlist("ev1", "kidA")).toMatchObject({ success: false, error: "Already on the waitlist." });
    expect(store.waitlist.filter((r) => r.studentId === "kidA")).toHaveLength(1);
    asParent(2);
    expect(await joinEventWaitlist("ev1", "kidB")).toEqual({ success: true, position: 2 });
    expect(await getEventWaitlistForFamily("ev1", "kidB")).toMatchObject({ full: true, status: "WAITING", position: 2, waiting: 2 });
  });

  it("act only for their own children", async () => {
    asCoach();
    await setEventWaitlistFull("ev1", true);
    asParent(1);
    expect(await joinEventWaitlist("ev1", "kidB")).toMatchObject({ success: false, error: "Event not found" });
    expect(await getEventWaitlistForFamily("ev1", "kidB")).toMatchObject({ error: "Event not found" });
    expect(store.waitlist).toHaveLength(0);
  });

  it("a going child cannot join", async () => {
    asCoach();
    await setEventWaitlistFull("ev1", true);
    store.rsvps[0].status = "GOING";
    asParent(1);
    expect(await joinEventWaitlist("ev1", "kidA")).toMatchObject({ success: false, error: expect.stringMatching(/already going/) });
  });
});

describe("freed places, accept, decline, expiry", () => {
  async function fullWithTwoWaiting() {
    store.rsvps[2].status = "GOING"; // kidC holds a place
    asCoach();
    await setEventWaitlistFull("ev1", true);
    asParent(1);
    await joinEventWaitlist("ev1", "kidA");
    asParent(2);
    await joinEventWaitlist("ev1", "kidB");
  }

  it("RSVP GOING is refused while full; a cancelled place is offered to the next family, who accepts", async () => {
    await fullWithTwoWaiting();
    expect(await eventWaitlistRsvpGate("ev1", "kidA", "GOING")).toMatchObject({ error: expect.stringMatching(/full/) });

    // kidC cancels (the updateRSVP hook): kidA is offered the place
    const gate = await eventWaitlistRsvpGate("ev1", "kidC", "NOT_GOING");
    expect(gate).toEqual({ wasGoing: true });
    store.rsvps[2].status = "NOT_GOING";
    await eventWaitlistAfterRsvp({ id: "ev1", orgId: "org1" }, "parent3", gate.wasGoing, "NOT_GOING");
    expect(row("kidA")).toMatchObject({ status: "OFFERED", position: 1 });
    expect(row("kidA")!.offerExpiresAt.getTime() - row("kidA")!.offeredAt.getTime()).toBe(24 * 3600e3);
    expect(await eventWaitlistRsvpGate("ev1", "kidA", "GOING")).toMatchObject({ error: expect.stringMatching(/Accept your waitlist offer/) });

    asParent(2);
    expect((await acceptEventWaitlistOffer("ev1", "kidB")).success).toBe(false); // no offer for kidB
    asParent(1);
    expect(await acceptEventWaitlistOffer("ev1", "kidA")).toEqual({ success: true });
    expect(store.rsvps.find((r) => r.studentId === "kidA")!.status).toBe("GOING");
    expect(row("kidA")).toMatchObject({ status: "ACCEPTED", position: 0 });
    expect(row("kidB")).toMatchObject({ status: "WAITING", position: 1 });
  });

  it("decline passes the place on; when nobody is left the event reopens", async () => {
    await fullWithTwoWaiting();
    asCoach();
    expect(await offerNextEventPlaces("ev1")).toEqual({ success: true, offered: 1 });
    asParent(1);
    expect(await leaveEventWaitlist("ev1", "kidA")).toEqual({ success: true });
    expect(row("kidB")).toMatchObject({ status: "OFFERED", position: 1 });
    asParent(2);
    await leaveEventWaitlist("ev1", "kidB");
    expect(store.audit[store.audit.length - 1]).toMatchObject({ action: "EVENT_WAITLIST_OPEN", userId: "coach1" });
    expect(await eventWaitlistRsvpGate("ev1", "kidB", "GOING")).toEqual({ wasGoing: false });
  });

  it("the expiry job offers the next family and the cron route needs CRON_SECRET", async () => {
    await fullWithTwoWaiting();
    asCoach();
    await offerNextEventPlaces("ev1");
    const later = new Date(Date.now() + 25 * 3600e3);
    expect(await processExpiredEventOffers(later)).toMatchObject({ enabled: true, expired: 1, offered: 1 });
    expect(row("kidA")).toMatchObject({ status: "EXPIRED", respondedAt: null, position: 0 });
    expect(row("kidB")).toMatchObject({ status: "OFFERED", position: 1 });

    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "s3cret";
    try {
      const bad = await cronGET(new Request("http://x/api/cron/event-waitlist", { headers: { authorization: "Bearer nope" } }) as any);
      expect(bad.status).toBe(401);
      const ok = await cronGET(new Request("http://x/api/cron/event-waitlist", { headers: { authorization: "Bearer s3cret" } }) as any);
      expect(ok.status).toBe(200);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });
});

describe("organisers", () => {
  it("see the list in order; other coaches cannot", async () => {
    asCoach();
    await setEventWaitlistFull("ev1", true);
    asParent(2);
    await joinEventWaitlist("ev1", "kidB");
    asParent(1);
    await joinEventWaitlist("ev1", "kidA");
    asCoach();
    const view = await getEventWaitlistForOrganiser("ev1");
    expect(view).toMatchObject({ enabled: true, full: true });
    expect("entries" in view && view.entries?.map((e) => `${e.position}:${e.name}`)).toEqual(["1:Bilal", "2:Asha"]);
    asCoach("coach2");
    expect(await getEventWaitlistForOrganiser("ev1")).toMatchObject({ error: "Event not found" });
    expect((await setEventWaitlistFull("ev1", false)).success).toBe(false);
  });

  it("reopening offers everyone waiting", async () => {
    asCoach();
    await setEventWaitlistFull("ev1", true);
    asParent(1);
    await joinEventWaitlist("ev1", "kidA");
    asParent(2);
    await joinEventWaitlist("ev1", "kidB");
    asCoach();
    await setEventWaitlistFull("ev1", false);
    expect(store.waitlist.map((r) => r.status)).toEqual(["OFFERED", "OFFERED"]);
  });
});

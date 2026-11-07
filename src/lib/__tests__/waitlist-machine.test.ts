import { describe, expect, it } from "vitest";
import {
  OFFER_MS,
  acceptOffer,
  activeQueue,
  declineOrLeave,
  diffEntries,
  expireOffers,
  familyView,
  joinWaitlist,
  offerPlaces,
  recomputePositions,
  type WaitlistEntry,
} from "@/lib/events/waitlist";

const T0 = new Date("2026-11-07T10:00:00.000Z");
const at = (h: number) => new Date(T0.getTime() + h * 60 * 60 * 1000);

/** Join a, b, c ... in order, an hour apart. Saved ids = "id_<student>". */
function list(...students: string[]): WaitlistEntry[] {
  let entries: WaitlistEntry[] = [];
  students.forEach((s, i) => {
    const r = joinWaitlist(entries, s, at(i * 0.01));
    expect(r.error).toBeUndefined();
    entries = r.entries.map((e) => (e.id ? e : { ...e, id: `id_${e.studentId}` }));
  });
  return entries;
}
const get = (entries: WaitlistEntry[], s: string) => entries.find((e) => e.studentId === s)!;
const positions = (entries: WaitlistEntry[]) => activeQueue(entries).map((e) => `${e.studentId}:${e.position}:${e.status}`);

describe("join", () => {
  it("adds families at the end with positions 1..n", () => {
    const e = list("a", "b", "c");
    expect(positions(e)).toEqual(["a:1:WAITING", "b:2:WAITING", "c:3:WAITING"]);
  });

  it("never adds the same child twice while waiting or offered", () => {
    const e = list("a", "b");
    const r = joinWaitlist(e, "a", at(1));
    expect(r.error).toBe("ALREADY_ON_LIST");
    expect(r.entries.filter((x) => x.studentId === "a")).toHaveLength(1);
    const offered = offerPlaces(e, 1, at(1)).entries;
    expect(joinWaitlist(offered, "a", at(2)).error).toBe("ALREADY_ON_LIST");
  });

  it("re-joining after leaving reuses the row at the back of the queue", () => {
    const e = declineOrLeave(list("a", "b", "c"), "a", at(1)).entries;
    const r = joinWaitlist(e, "a", at(2));
    expect(r.error).toBeUndefined();
    expect(r.entries.filter((x) => x.studentId === "a")).toHaveLength(1);
    expect(get(r.entries, "a").id).toBe("id_a");
    expect(positions(r.entries)).toEqual(["b:1:WAITING", "c:2:WAITING", "a:3:WAITING"]);
  });
});

describe("offers", () => {
  it("offers a freed place to the next family with a 24 h expiry", () => {
    const r = offerPlaces(list("a", "b", "c"), 1, at(1));
    expect(r.offered).toEqual(["a"]);
    expect(r.unfilled).toBe(0);
    const a = get(r.entries, "a");
    expect(a.status).toBe("OFFERED");
    expect(a.offeredAt).toEqual(at(1));
    expect(a.offerExpiresAt!.getTime() - at(1).getTime()).toBe(OFFER_MS);
    expect(get(r.entries, "b").status).toBe("WAITING");
  });

  it("does not offer the same family twice and reports places nobody was waiting for", () => {
    const first = offerPlaces(list("a"), 1, at(1));
    const second = offerPlaces(first.entries, 2, at(2));
    expect(second.offered).toEqual([]);
    expect(second.unfilled).toBe(2);
    expect(get(second.entries, "a").offeredAt).toEqual(at(1));
  });

  it("accept moves the family to going and renumbers the rest", () => {
    const offered = offerPlaces(list("a", "b", "c"), 1, at(1)).entries;
    const r = acceptOffer(offered, "a", at(5));
    expect(r.error).toBeUndefined();
    expect(r.accepted).toBe("a");
    expect(get(r.entries, "a")).toMatchObject({ status: "ACCEPTED", respondedAt: at(5), position: 0 });
    expect(positions(r.entries)).toEqual(["b:1:WAITING", "c:2:WAITING"]);
  });

  it("refuses to accept without an offer or after it expired", () => {
    const e = list("a", "b");
    expect(acceptOffer(e, "a", at(1)).error).toBe("NO_OFFER");
    expect(acceptOffer(e, "zz", at(1)).error).toBe("NOT_ON_LIST");
    const offered = offerPlaces(e, 1, at(1)).entries;
    const late = acceptOffer(offered, "a", at(25));
    expect(late.error).toBe("OFFER_EXPIRED");
    expect(late.accepted).toBeNull();
    expect(get(late.entries, "a").status).toBe("OFFERED");
  });

  it("decline passes the place to the next family", () => {
    const offered = offerPlaces(list("a", "b", "c"), 1, at(1)).entries;
    const r = declineOrLeave(offered, "a", at(2));
    expect(get(r.entries, "a")).toMatchObject({ status: "EXPIRED", respondedAt: at(2), position: 0 });
    expect(r.offered).toEqual(["b"]);
    expect(positions(r.entries)).toEqual(["b:1:OFFERED", "c:2:WAITING"]);
  });

  it("leaving while waiting frees no place", () => {
    const r = declineOrLeave(list("a", "b", "c"), "b", at(2));
    expect(r.offered).toEqual([]);
    expect(r.unfilled).toBe(0);
    expect(positions(r.entries)).toEqual(["a:1:WAITING", "c:2:WAITING"]);
    expect(declineOrLeave(r.entries, "b", at(3)).error).toBe("NOT_ON_LIST");
  });

  it("expiry after 24 h offers the next family; live offers are untouched", () => {
    let e = offerPlaces(list("a", "b", "c", "d"), 1, at(0)).entries; // a offered at 0
    e = offerPlaces(e, 1, at(10)).entries; // b offered at 10
    const early = expireOffers(e, at(23));
    expect(early.expired).toEqual([]);
    expect(early.offered).toEqual([]);

    const r = expireOffers(e, at(24));
    expect(r.expired).toEqual(["a"]);
    expect(r.offered).toEqual(["c"]);
    expect(get(r.entries, "a")).toMatchObject({ status: "EXPIRED", respondedAt: null });
    expect(positions(r.entries)).toEqual(["b:1:OFFERED", "c:2:OFFERED", "d:3:WAITING"]);
    expect(get(r.entries, "c").offerExpiresAt).toEqual(at(48));
  });

  it("expiry with nobody waiting reports the unfilled place", () => {
    const e = offerPlaces(list("a"), 1, at(0)).entries;
    const r = expireOffers(e, at(30));
    expect(r.expired).toEqual(["a"]);
    expect(r.offered).toEqual([]);
    expect(r.unfilled).toBe(1);
    expect(activeQueue(r.entries)).toEqual([]);
  });

  it("an expired family can re-join at the back", () => {
    const e = expireOffers(offerPlaces(list("a", "b"), 1, at(0)).entries, at(24)).entries;
    const r = joinWaitlist(e, "a", at(25));
    expect(positions(r.entries)).toEqual(["b:1:OFFERED", "a:2:WAITING"]);
    expect(get(r.entries, "a")).toMatchObject({ offeredAt: null, offerExpiresAt: null, respondedAt: null });
  });
});

describe("positions and views", () => {
  it("recompute closes gaps and zeroes inactive entries", () => {
    const e = list("a", "b", "c").map((x) => ({ ...x, position: x.studentId === "a" ? 7 : x.studentId === "b" ? 2 : 9 }));
    e.push({ ...e[0], id: "id_z", studentId: "z", status: "ACCEPTED", position: 1 });
    const r = recomputePositions(e);
    expect(positions(r)).toEqual(["b:1:WAITING", "a:2:WAITING", "c:3:WAITING"]);
    expect(get(r, "z").position).toBe(0);
  });

  it("familyView shows position and a live offer only", () => {
    const e = offerPlaces(list("a", "b", "c"), 1, at(0)).entries;
    expect(familyView(e, "c", at(1))).toMatchObject({ status: "WAITING", position: 3, waiting: 3, offerExpiresAt: null });
    expect(familyView(e, "a", at(1)).offerExpiresAt).toEqual(at(24));
    expect(familyView(e, "a", at(25)).offerExpiresAt).toBeNull();
    expect(familyView(e, "nobody", at(1))).toMatchObject({ status: null, position: null });
  });

  it("diff creates new rows and updates only changed fields", () => {
    const before = list("a", "b");
    const after = joinWaitlist(offerPlaces(before, 1, at(1)).entries, "c", at(2)).entries;
    const changes = diffEntries(before, after);
    expect(changes).toHaveLength(2);
    expect(changes.find((c) => c.kind === "create")).toMatchObject({ entry: { studentId: "c", position: 3, status: "WAITING" } });
    const upd = changes.find((c) => c.kind === "update");
    expect(upd).toMatchObject({ id: "id_a", data: { status: "OFFERED" } });
    expect(Object.keys((upd as { data: object }).data).sort()).toEqual(["offerExpiresAt", "offeredAt", "status"]);
    expect(diffEntries(before, before)).toEqual([]);
  });
});

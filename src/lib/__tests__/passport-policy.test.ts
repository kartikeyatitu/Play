import { describe, it, expect } from "vitest";
import { decidePassportAccess, type PassportAccessFacts } from "@/lib/athlete/passport-policy";

const student = { id: "kid", orgId: "org1", parentId: "parent1" };
const facts = (over: Partial<PassportAccessFacts>): PassportAccessFacts => ({
  viewerId: "someone",
  student,
  membership: null,
  coachesStudent: false,
  ...over,
});
const NOT_FOUND = { ok: false, status: "not_found" };

describe("passport access policy", () => {
  it("parents see their own children only", () => {
    expect(decidePassportAccess(facts({ viewerId: "parent1" }))).toEqual({ ok: true, relation: "PARENT" });
    expect(decidePassportAccess(facts({ viewerId: "parent2" }))).toEqual(NOT_FOUND);
  });

  it("coaches see only students in batches they coach", () => {
    const coach = { role: "COACH", status: "ACTIVE" };
    expect(decidePassportAccess(facts({ membership: coach, coachesStudent: true }))).toEqual({ ok: true, relation: "COACH" });
    expect(decidePassportAccess(facts({ membership: coach, coachesStudent: false }))).toEqual(NOT_FOUND);
    // Even with a permission granted, a coach is limited to their own batches.
    expect(
      decidePassportAccess(facts({ membership: { ...coach, permissions: JSON.stringify({ "students.manage": true }) }, coachesStudent: false })),
    ).toEqual(NOT_FOUND);
  });

  it("academy staff need the right permission", () => {
    expect(decidePassportAccess(facts({ membership: { role: "OWNER", status: "ACTIVE" } }))).toEqual({ ok: true, relation: "STAFF" });
    expect(decidePassportAccess(facts({ membership: { role: "MANAGER", status: "ACTIVE" } }))).toEqual({ ok: true, relation: "STAFF" });
    expect(decidePassportAccess(facts({ membership: { role: "STAFF", staffRole: "RECEPTIONIST", status: "ACTIVE" } }))).toEqual({ ok: true, relation: "STAFF" });
    expect(decidePassportAccess(facts({ membership: { role: "STAFF", staffRole: "GROUNDSMAN", status: "ACTIVE" } }))).toEqual(NOT_FOUND);
    expect(decidePassportAccess(facts({ membership: { role: "STAFF", staffRole: "PHYSIO", status: "ACTIVE" } }))).toEqual(NOT_FOUND);
    expect(
      decidePassportAccess(facts({ membership: { role: "MANAGER", status: "ACTIVE", permissions: JSON.stringify({ "students.manage": false, "reports.view": false }) } })),
    ).toEqual(NOT_FOUND);
  });

  it("inactive memberships and students without an academy are refused for staff", () => {
    expect(decidePassportAccess(facts({ membership: { role: "OWNER", status: "REMOVED" } }))).toEqual(NOT_FOUND);
    expect(decidePassportAccess(facts({ membership: { role: "OWNER", status: "INVITED" }, coachesStudent: true }))).toEqual(NOT_FOUND);
    expect(decidePassportAccess(facts({ student: { ...student, orgId: null }, membership: { role: "OWNER", status: "ACTIVE" } }))).toEqual(NOT_FOUND);
    // ...but the parent still sees their own child.
    expect(decidePassportAccess(facts({ viewerId: "parent1", student: { ...student, orgId: null } }))).toEqual({ ok: true, relation: "PARENT" });
  });

  it("outsiders, signed-out viewers and missing students all get not found (never forbidden)", () => {
    expect(decidePassportAccess(facts({}))).toEqual(NOT_FOUND);
    expect(decidePassportAccess(facts({ viewerId: null }))).toEqual(NOT_FOUND);
    expect(decidePassportAccess(facts({ student: null, viewerId: "parent1" }))).toEqual(NOT_FOUND);
    expect(decidePassportAccess(facts({ coachesStudent: true }))).toEqual(NOT_FOUND); // no membership
  });
});

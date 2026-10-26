import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, belongsToOtherAcademy, canMarkBatchAttendance, membershipAllows } from "@/lib/team";

const m = (role: string, extra: { staffRole?: string; permissions?: Record<string, boolean>; status?: string } = {}) => ({
  role,
  staffRole: extra.staffRole ?? null,
  permissions: extra.permissions ? JSON.stringify(extra.permissions) : null,
  status: extra.status ?? "ACTIVE",
});

describe("membershipAllows", () => {
  it("owners hold every permission, even with deny overrides", () => {
    const owner = m("OWNER", { permissions: { "fees.manage": false } });
    for (const p of ALL_PERMISSIONS) expect(membershipAllows(owner, p)).toBe(true);
  });

  it("staff roles get their defaults and nothing more", () => {
    const reception = m("STAFF", { staffRole: "RECEPTIONIST" });
    expect(membershipAllows(reception, "fees.collect")).toBe(true);
    expect(membershipAllows(reception, "leads.manage")).toBe(true);
    expect(membershipAllows(reception, "fees.manage")).toBe(false);
    expect(membershipAllows(reception, "reports.view")).toBe(false);

    const accountant = m("STAFF", { staffRole: "ACCOUNTANT" });
    expect(membershipAllows(accountant, "reports.view")).toBe(true);
    expect(membershipAllows(accountant, "students.manage")).toBe(false);

    const physio = m("STAFF", { staffRole: "PHYSIO" });
    expect(membershipAllows(physio, "health.manage")).toBe(true);
    expect(membershipAllows(physio, "attendance.mark")).toBe(false);

    const grounds = m("STAFF", { staffRole: "GROUNDSMAN" });
    expect(membershipAllows(grounds, "bookings.manage")).toBe(true);
    expect(membershipAllows(grounds, "fees.collect")).toBe(false);

    expect(membershipAllows(m("STAFF"), "fees.collect")).toBe(false);
  });

  it("coaches get attendance.mark and per-person grants/revocations apply", () => {
    expect(membershipAllows(m("COACH"), "attendance.mark")).toBe(true);
    expect(membershipAllows(m("COACH"), "fees.collect")).toBe(false);
    expect(membershipAllows(m("COACH", { permissions: { "fees.collect": true } }), "fees.collect")).toBe(true);
    expect(membershipAllows(m("COACH", { permissions: { "attendance.mark": false } }), "attendance.mark")).toBe(false);
  });

  it("settings.manage cannot be granted to non-owners", () => {
    expect(membershipAllows(m("MANAGER", { permissions: { "settings.manage": true } }), "settings.manage")).toBe(false);
    expect(membershipAllows(m("STAFF", { staffRole: "ACCOUNTANT", permissions: { "settings.manage": true } }), "settings.manage")).toBe(false);
  });

  it("invited or removed memberships hold nothing", () => {
    expect(membershipAllows(m("MANAGER", { status: "INVITED" }), "students.manage")).toBe(false);
    expect(membershipAllows(m("OWNER", { status: "REMOVED" }), "students.manage")).toBe(false);
  });

  it("unknown roles hold nothing", () => {
    expect(membershipAllows(m("PARENT"), "students.manage")).toBe(false);
  });
});

describe("canMarkBatchAttendance", () => {
  it("coaches can mark only their own batches", () => {
    expect(canMarkBatchAttendance(m("COACH"), true)).toBe(true);
    expect(canMarkBatchAttendance(m("COACH"), false)).toBe(false);
  });

  it("a coach whose attendance.mark was revoked cannot mark even their own batch", () => {
    expect(canMarkBatchAttendance(m("COACH", { permissions: { "attendance.mark": false } }), true)).toBe(false);
  });

  it("owners and managers can mark any batch unless a manager's permission is revoked", () => {
    expect(canMarkBatchAttendance(m("OWNER"), false)).toBe(true);
    expect(canMarkBatchAttendance(m("MANAGER"), false)).toBe(true);
    expect(canMarkBatchAttendance(m("MANAGER", { permissions: { "attendance.mark": false } }), false)).toBe(false);
  });

  it("staff need an explicit grant", () => {
    expect(canMarkBatchAttendance(m("STAFF", { staffRole: "RECEPTIONIST" }), false)).toBe(false);
    expect(canMarkBatchAttendance(m("STAFF", { staffRole: "RECEPTIONIST", permissions: { "attendance.mark": true } }), false)).toBe(true);
  });
});

describe("belongsToOtherAcademy", () => {
  const A = "org_a";
  const B = "org_b";

  it("a brand-new or single-academy person does not need consent", () => {
    expect(belongsToOtherAcademy({ orgId: null, memberships: [] }, A)).toBe(false);
    expect(belongsToOtherAcademy({ orgId: A, memberships: [{ orgId: A, status: "ACTIVE" }] }, A)).toBe(false);
  });

  it("an active membership elsewhere counts", () => {
    expect(belongsToOtherAcademy({ orgId: A, memberships: [{ orgId: A, status: "ACTIVE" }, { orgId: B, status: "ACTIVE" }] }, A)).toBe(true);
  });

  it("legacy users whose active academy is elsewhere count even without a membership row", () => {
    expect(belongsToOtherAcademy({ orgId: B, memberships: [] }, A)).toBe(true);
  });

  it("removed memberships elsewhere do not count", () => {
    expect(belongsToOtherAcademy({ orgId: null, memberships: [{ orgId: B, status: "REMOVED" }] }, A)).toBe(false);
  });

  it("pending invites elsewhere count only when asked (login links)", () => {
    const u = { orgId: A, memberships: [{ orgId: A, status: "ACTIVE" }, { orgId: B, status: "INVITED" }] };
    expect(belongsToOtherAcademy(u, A)).toBe(false);
    expect(belongsToOtherAcademy(u, A, { countInvites: true })).toBe(true);
  });
});

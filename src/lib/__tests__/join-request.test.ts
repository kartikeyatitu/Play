import { describe, expect, it } from "vitest";
import { ageOn, buildJoinLead, dobFromJoinNotes, isOpenLeadStatus, JOIN_LEAD_SOURCE } from "@/lib/join-request";

const now = new Date("2026-10-26T10:00:00.000Z");

describe("ageOn", () => {
  it("counts whole years and handles birthdays not yet reached", () => {
    expect(ageOn(new Date("2016-10-26T00:00:00Z"), now)).toBe(10);
    expect(ageOn(new Date("2016-10-27T00:00:00Z"), now)).toBe(9);
    expect(ageOn(null, now)).toBeNull();
  });
});

describe("buildJoinLead", () => {
  it("creates a NEW enquiry, never an enrolment, keeping the requested batch and dob in notes", () => {
    const lead = buildJoinLead({
      orgId: "org1",
      parentName: " Asha ",
      parentPhone: "9876543210",
      childName: "Kabir",
      dob: new Date("2015-03-04T00:00:00Z"),
      batch: { name: "U-12 Evening", sport: "Football" },
      now,
    });
    expect(lead).toMatchObject({
      orgId: "org1",
      parentName: "Asha",
      childName: "Kabir",
      status: "NEW",
      source: JOIN_LEAD_SOURCE,
      sport: "Football",
      childAge: 11,
    });
    expect(lead).not.toHaveProperty("batchId");
    expect(lead.notes).toContain("Requested batch: U-12 Evening");
    expect(dobFromJoinNotes(lead.notes)?.toISOString().slice(0, 10)).toBe("2015-03-04");
  });

  it("works without a batch or dob", () => {
    const lead = buildJoinLead({ orgId: "o", parentName: "A B", parentPhone: "9", childName: "C D", dob: null, batch: null, now });
    expect(lead.sport).toBeNull();
    expect(lead.childAge).toBeNull();
    expect(dobFromJoinNotes(lead.notes)).toBeNull();
  });
});

describe("isOpenLeadStatus", () => {
  it("treats enrolled and lost enquiries as closed", () => {
    expect(isOpenLeadStatus("NEW")).toBe(true);
    expect(isOpenLeadStatus("TRIAL_BOOKED")).toBe(true);
    expect(isOpenLeadStatus("ENROLLED")).toBe(false);
    expect(isOpenLeadStatus("LOST")).toBe(false);
  });
});

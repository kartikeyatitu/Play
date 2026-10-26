import { describe, it, expect } from "vitest";
import { canViewMedical, medicalAuditDetails, medicalFieldsChanged, parseMedicalJson, whitelistMedical } from "@/lib/health";

describe("medical whitelist", () => {
  it("drops unknown keys and coerces consent", () => {
    const out = whitelistMedical({ allergies: " Peanuts ", consent: "on", hack: "<script>", __proto__x: 1 });
    expect(out).toEqual({ allergies: "Peanuts", consent: true });
  });

  it("caps long strings", () => {
    const out = whitelistMedical({ medicalConditions: "x".repeat(900) });
    expect((out.medicalConditions as string).length).toBe(500);
  });

  it("handles junk input", () => {
    expect(whitelistMedical(null)).toEqual({});
    expect(whitelistMedical(["a"])).toEqual({});
  });
});

describe("changed fields for audit", () => {
  it("returns field names only, never values", () => {
    const before = { allergies: "Peanuts", doctorName: "Dr A", bloodGroup: "O+" };
    const after = { allergies: "Peanuts, dust", doctorName: "Dr A", bloodGroup: "O+", consent: true };
    const fields = medicalFieldsChanged(before, after);
    expect(fields).toEqual(["allergies", "consent"]);
    const details = JSON.stringify(medicalAuditDetails("stu_1", fields));
    expect(details).not.toContain("Peanuts");
    expect(details).not.toContain("dust");
    expect(details).toBe('{"studentId":"stu_1","fields":["allergies","consent"]}');
  });

  it("treats empty, null and false as the same", () => {
    expect(medicalFieldsChanged({ a: "", b: null, c: false }, { a: undefined, b: "", c: "" })).toEqual([]);
  });

  it("parses legacy plain text without throwing", () => {
    expect(parseMedicalJson("Asthma")).toEqual({ legacyNote: "Asthma" });
    expect(parseMedicalJson('{"allergies":"x"}')).toEqual({ allergies: "x" });
    expect(parseMedicalJson(null)).toEqual({});
  });
});

describe("who can view medical data", () => {
  it("keeps today's behaviour with the flag off", () => {
    expect(canViewMedical({ wellness: false, appRole: "ADMIN", hasHealthView: false })).toBe(true);
  });
  it("requires health.view for admins with the flag on", () => {
    expect(canViewMedical({ wellness: true, appRole: "ADMIN", hasHealthView: false })).toBe(false);
    expect(canViewMedical({ wellness: true, appRole: "ADMIN", hasHealthView: true })).toBe(true);
    expect(canViewMedical({ wellness: true, appRole: "COACH", hasHealthView: false })).toBe(true);
    expect(canViewMedical({ wellness: true, appRole: "STAFF", hasHealthView: true })).toBe(true);
    expect(canViewMedical({ wellness: true, appRole: "STAFF", hasHealthView: false })).toBe(false);
  });
});

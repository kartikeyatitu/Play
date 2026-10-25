import { describe, it, expect } from "vitest";
import { parseMedicalInfo } from "@/lib/coach";

describe("parseMedicalInfo", () => {
  it("summarises the JSON MedicalForm writes instead of showing raw JSON", () => {
    const raw = JSON.stringify({ allergies: "Peanuts", medicalConditions: "Asthma", insurancePolicy: "X-123" });
    const m = parseMedicalInfo(raw);
    expect(m.hasAny).toBe(true);
    expect(m.summary).toBe("Asthma · Allergies: Peanuts");
    expect(m.summary).not.toContain("{");
    expect(m.summary).not.toContain("X-123");
    expect(m.severity).toBe("alert");
  });

  it("treats empty or 'none' notes as nothing to show", () => {
    expect(parseMedicalInfo(null).hasAny).toBe(false);
    expect(parseMedicalInfo("{}").hasAny).toBe(false);
    expect(parseMedicalInfo(JSON.stringify({ allergies: "None", medicalConditions: "" })).hasAny).toBe(false);
  });

  it("keeps legacy plain-text notes", () => {
    const m = parseMedicalInfo("Recovered from ankle sprain");
    expect(m.hasAny).toBe(true);
    expect(m.summary).toBe("Recovered from ankle sprain");
    expect(m.severity).toBe("info");
  });
});

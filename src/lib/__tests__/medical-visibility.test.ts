import { describe, it, expect } from "vitest";
import { coachSafeMedicalInfo, COACH_SAFE_MEDICAL_FIELDS, medicalForView, medicalViewFor, withMedicalView } from "@/lib/athlete/medical-visibility";
import { parseMedicalInfo } from "@/lib/coach";

const full = JSON.stringify({
  allergies: "Peanuts",
  medicalConditions: "Asthma",
  emergencyContactName: "Asha",
  emergencyContactPhone: "9876543210",
  doctorName: "Dr Rao",
  doctorPhone: "9000000000",
  insurancePolicyNumber: "POL-1",
  signature: "A",
  consent: true,
});

describe("medical visibility", () => {
  it("coaches get the safety view; owners/managers full when allowed; parents full", () => {
    expect(medicalViewFor({ appRole: "COACH", fullAllowed: true })).toBe("safety");
    expect(medicalViewFor({ appRole: "ADMIN", fullAllowed: true })).toBe("full");
    expect(medicalViewFor({ appRole: "ADMIN", fullAllowed: false })).toBe("none");
    expect(medicalViewFor({ appRole: "STAFF", fullAllowed: true })).toBe("full");
    expect(medicalViewFor({ appRole: "PARENT", fullAllowed: false })).toBe("full");
    expect(medicalViewFor({ appRole: "SPONSOR", fullAllowed: true })).toBe("none");
  });

  it("the coach copy keeps only allergies and the emergency contact", () => {
    const safe = JSON.parse(coachSafeMedicalInfo(full)!);
    expect(Object.keys(safe).sort()).toEqual([...COACH_SAFE_MEDICAL_FIELDS].sort());
    expect(safe).toEqual({ allergies: "Peanuts", emergencyContactName: "Asha", emergencyContactPhone: "9876543210" });
    expect(JSON.stringify(safe)).not.toMatch(/Asthma|Rao|POL-1|consent|signature/);
  });

  it("returns null when no safety field is on file", () => {
    expect(coachSafeMedicalInfo(null)).toBeNull();
    expect(coachSafeMedicalInfo("")).toBeNull();
    expect(coachSafeMedicalInfo(JSON.stringify({ medicalConditions: "Knee surgery 2024" }))).toBeNull();
  });

  it("legacy plain-text notes pass only when they are allergy notes", () => {
    expect(JSON.parse(coachSafeMedicalInfo("Severe peanut allergy, carries EpiPen")!)).toEqual({ allergies: "Severe peanut allergy, carries EpiPen" });
    expect(coachSafeMedicalInfo("ADHD, on medication")).toBeNull();
  });

  it("the safety view drops blood group; none drops everything; full is untouched", () => {
    const rec = { id: "s1", name: "Kid", medicalInfo: full, bloodGroup: "O+" };
    expect(medicalForView(rec, "safety").bloodGroup).toBeNull();
    expect(medicalForView(rec, "none")).toEqual({ medicalInfo: null, bloodGroup: null });
    expect(withMedicalView(rec, "full")).toBe(rec);
    const coach = withMedicalView(rec, "safety");
    expect(coach.id).toBe("s1");
    expect(coach.name).toBe("Kid");
    // What the coach screens render from it: allergy alert, emergency contact, no condition.
    const m = parseMedicalInfo(coach.medicalInfo);
    expect(m.summary).toBe("Allergies: Peanuts");
    expect(m.conditions).toBeUndefined();
    expect(m.emergencyContactPhone).toBe("9876543210");
    expect(m.doctorName).toBeUndefined();
  });
});

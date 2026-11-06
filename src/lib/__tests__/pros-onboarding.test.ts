import { describe, it, expect } from "vitest";
import { META_PREFIX, encodeMetaLine, joinBio, parseMetaLine, splitBio } from "@/lib/pros/meta";
import { providerNeedsRecheck, validateOnboarding } from "@/lib/pros/onboarding";
import {
  CREDENTIAL_TYPES_BY_PRO,
  HEALTH_CATEGORY_BY_TYPE,
  PRO_TYPES,
  credentialTitle,
  credentialTypeOfTitle,
} from "@/lib/pros/types";
import { composeBookingNote, parseBookingNote, resolveBookingSubject, shortName, validateReason } from "@/lib/pros/booking";

describe("types", () => {
  it("every type requests at least one required credential", () => {
    for (const t of PRO_TYPES) expect(CREDENTIAL_TYPES_BY_PRO[t].some((c) => c.required)).toBe(true);
  });
  it("only the four health types map to a WellnessProvider category", () => {
    expect(PRO_TYPES.filter((t) => HEALTH_CATEGORY_BY_TYPE[t] !== null)).toEqual([
      "SPORTS_PSYCHOLOGIST",
      "COUNSELLOR",
      "PHYSIOTHERAPIST",
      "SPORTS_NUTRITIONIST",
    ]);
  });
  it("round-trips credential titles per type", () => {
    const ct = CREDENTIAL_TYPES_BY_PRO.SPORTS_PSYCHOLOGIST[1];
    const title = credentialTitle(ct, "RCI CRR A12345");
    expect(credentialTypeOfTitle("SPORTS_PSYCHOLOGIST", title)?.id).toBe(ct.id);
    expect(credentialTypeOfTitle("SC_COACH", title)).toBeNull();
    expect(credentialTypeOfTitle("SPORTS_PSYCHOLOGIST", "RCI registration")).toBeNull();
  });
});

describe("meta codec", () => {
  const meta = { type: "COUNSELLOR" as const, modes: ["ONLINE" as const], languages: ["English", "Hindi"], specialisations: ["Stress"] };
  it("round-trips", () => {
    const stored = joinBio("I help junior athletes.", meta);
    expect(splitBio(stored)).toEqual({ bio: "I help junior athletes.", meta });
  });
  it("ignores unknown values and rejects unknown types", () => {
    const line = `${META_PREFIX}type=COUNSELLOR; modes=ONLINE|TELEPATHY; languages=English|Klingon; specialisations=Stress|Diagnosis`;
    expect(parseMetaLine(line)).toEqual({ type: "COUNSELLOR", modes: ["ONLINE"], languages: ["English"], specialisations: ["Stress"] });
    expect(parseMetaLine(`${META_PREFIX}type=DOCTOR; modes=ONLINE`)).toBeNull();
    expect(parseMetaLine(`${META_PREFIX}type=COUNSELLOR; modes=`)).toBeNull();
  });
  it("treats a bio without the line as not a Connect profile", () => {
    expect(splitBio("Just a careers bio")).toEqual({ bio: "Just a careers bio", meta: null });
    expect(splitBio(null)).toEqual({ bio: "", meta: null });
  });
  it("strips a fake meta line typed into the bio", () => {
    const stored = joinBio(`hello\n${encodeMetaLine({ ...meta, type: "SPORTS_PSYCHOLOGIST" })}`, meta);
    expect(splitBio(stored).meta?.type).toBe("COUNSELLOR");
    expect(stored.split(META_PREFIX).length).toBe(2);
  });
});

describe("validateOnboarding", () => {
  const ok = {
    type: "PHYSIOTHERAPIST",
    bio: "Sports physio",
    sports: "Cricket, Badminton",
    city: "Noida",
    yearsExperience: "7",
    modes: ["IN_PERSON", "ONLINE"],
    languages: ["English", "Hindi", "Klingon"],
    specialisations: ["Return to sport", "Stress"],
    listed: "on",
    acceptingRequests: "on",
    registrationBody: "State physiotherapy council",
    registrationNumber: "PT-123",
  };
  it("accepts a valid form and drops values from other lists", () => {
    const r = validateOnboarding(ok);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.meta.languages).toEqual(["English", "Hindi"]);
    expect(r.value.meta.specialisations).toEqual(["Return to sport"]);
    expect(r.value.sports).toEqual(["Cricket", "Badminton"]);
    expect(r.value.listed).toBe(true);
    expect(r.value.acceptingRequests).toBe(true);
  });
  it("needs a type, a mode, a language, and a city for in-person", () => {
    expect(validateOnboarding({ ...ok, type: "DOCTOR" }).ok).toBe(false);
    expect(validateOnboarding({ ...ok, modes: [] }).ok).toBe(false);
    expect(validateOnboarding({ ...ok, languages: ["Klingon"] }).ok).toBe(false);
    expect(validateOnboarding({ ...ok, city: "", modes: "IN_PERSON" }).ok).toBe(false);
    expect(validateOnboarding({ ...ok, city: "", modes: "ONLINE" }).ok).toBe(true);
    expect(validateOnboarding({ ...ok, yearsExperience: "99" }).ok).toBe(false);
  });
  it("never lists by default and drops registration/requests for non-health types", () => {
    const r = validateOnboarding({ ...ok, type: "SC_COACH", listed: undefined });
    expect(r.ok && r.value.listed).toBe(false);
    expect(r.ok && r.value.acceptingRequests).toBe(false);
    expect(r.ok && r.value.registrationNumber).toBeNull();
  });
});

describe("providerNeedsRecheck", () => {
  const before = {
    type: "SPORTS_PSYCHOLOGIST" as const,
    category: "PSYCHOLOGY",
    registrationBody: "RCI",
    registrationNumber: "A1",
    credentialStatus: "VERIFIED",
  };
  const after = { type: "SPORTS_PSYCHOLOGIST" as const, category: "PSYCHOLOGY", registrationBody: "RCI", registrationNumber: "A1" };
  it("resets when profession or registration changes after a check", () => {
    expect(providerNeedsRecheck(before, after)).toBe(false);
    expect(providerNeedsRecheck(before, { ...after, type: "COUNSELLOR" })).toBe(true);
    expect(providerNeedsRecheck(before, { ...after, registrationNumber: "A2" })).toBe(true);
    expect(providerNeedsRecheck({ ...before, credentialStatus: "SUBMITTED" }, { ...after, registrationNumber: "A2" })).toBe(false);
    expect(providerNeedsRecheck({ ...before, type: null }, after)).toBe(false);
  });
});

describe("booking helpers", () => {
  it("parents book only for their own child", () => {
    expect(resolveBookingSubject("PARENT", "kid1", ["kid1", "kid2"])).toEqual({ ok: true, value: { kind: "CHILD", studentId: "kid1" } });
    expect(resolveBookingSubject("PARENT", "other", ["kid1"]).ok).toBe(false);
    expect(resolveBookingSubject("PARENT", "SELF", ["kid1"]).ok).toBe(false);
    expect(resolveBookingSubject("PARENT", "", ["kid1"]).ok).toBe(false);
  });
  it("other adults book only for themselves", () => {
    expect(resolveBookingSubject("COACH", "SELF", [])).toEqual({ ok: true, value: { kind: "SELF" } });
    expect(resolveBookingSubject("COACH", "kid1", ["kid1"]).ok).toBe(false);
  });
  it("short names and notes", () => {
    expect(shortName("aarav kumar sharma")).toBe("aarav S.");
    expect(shortName("Meera")).toBe("Meera");
    expect(shortName("  ")).toBe("Athlete");
    const note = composeBookingNote("Aarav S.", "Nervous before matches");
    expect(parseBookingNote(note)).toEqual({ forLabel: "Aarav S.", reason: "Nervous before matches" });
    expect(parseBookingNote(composeBookingNote(null, "Focus"))).toEqual({ forLabel: null, reason: "Focus" });
    expect(composeBookingNote(null, null)).toBeNull();
  });
  it("keeps reasons short and optional", () => {
    expect(validateReason("")).toEqual({ ok: true, value: null });
    expect(validateReason("x".repeat(301)).ok).toBe(false);
  });
});

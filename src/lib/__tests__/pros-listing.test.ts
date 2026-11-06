import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTERS,
  canReceiveRequests,
  facetValues,
  filterListings,
  isListable,
  matchesFilters,
  parseDirectoryFilters,
  type ProListing,
} from "@/lib/pros/listing";
import type { ProMeta } from "@/lib/pros/meta";

const physio: ProMeta = { type: "PHYSIOTHERAPIST", modes: ["IN_PERSON"], languages: ["English", "Hindi"], specialisations: [] };
const sc: ProMeta = { type: "SC_COACH", modes: ["ONLINE"], languages: ["English"], specialisations: [] };

describe("isListable", () => {
  it("requires the professional's own opt-in", () => {
    expect(isListable({ profile: { isPublic: false }, meta: sc, provider: null })).toBe(false);
    expect(isListable({ profile: { isPublic: true }, meta: sc, provider: null })).toBe(true);
    expect(isListable({ profile: { isPublic: true }, meta: null, provider: null })).toBe(false);
  });
  it("health types also need WellnessProvider.isListed", () => {
    expect(isListable({ profile: { isPublic: true }, meta: physio, provider: null })).toBe(false);
    expect(isListable({ profile: { isPublic: true }, meta: physio, provider: { isListed: false, acceptingRequests: true } })).toBe(false);
    expect(isListable({ profile: { isPublic: true }, meta: physio, provider: { isListed: true, acceptingRequests: true } })).toBe(true);
  });
});

describe("canReceiveRequests", () => {
  const src = { profile: { isPublic: true }, meta: physio, provider: { isListed: true, acceptingRequests: true } };
  it("only verified, listed, accepting health providers", () => {
    expect(canReceiveRequests(src, "VERIFIED")).toBe(true);
    expect(canReceiveRequests(src, "IN_REVIEW")).toBe(false);
    expect(canReceiveRequests({ ...src, provider: { isListed: true, acceptingRequests: false } }, "VERIFIED")).toBe(false);
    expect(canReceiveRequests({ profile: { isPublic: true }, meta: sc, provider: null }, "VERIFIED")).toBe(false);
  });
});

const base: ProListing = {
  profileId: "p1",
  userId: "u1",
  name: "Zara",
  type: "PHYSIOTHERAPIST",
  headline: null,
  bio: "",
  sports: ["Badminton", "Cricket"],
  city: "Noida",
  languages: ["English", "Hindi"],
  modes: ["IN_PERSON"],
  specialisations: [],
  yearsExperience: 5,
  verification: "IN_REVIEW",
  providerId: "w1",
  acceptsRequests: false,
};

describe("parseDirectoryFilters", () => {
  it("accepts only known types and languages", () => {
    expect(parseDirectoryFilters({ type: "SC_COACH", language: "Hindi", online: "1", sport: " Cricket ", city: "Gurgaon" })).toEqual({
      type: "SC_COACH",
      sport: "Cricket",
      city: "Gurgaon",
      language: "Hindi",
      online: true,
    });
    expect(parseDirectoryFilters({ type: "DOCTOR", language: "Klingon", sport: "", city: ["Noida", "x"] })).toEqual({
      ...EMPTY_FILTERS,
      city: "Noida",
    });
  });
});

describe("matchesFilters / filterListings", () => {
  it("matches sport and city case-insensitively", () => {
    expect(matchesFilters(base, { ...EMPTY_FILTERS, sport: "cricket", city: "NOIDA" })).toBe(true);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, sport: "Football" })).toBe(false);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, city: "Gurgaon" })).toBe(false);
    expect(matchesFilters({ ...base, city: null }, { ...EMPTY_FILTERS, city: "Noida" })).toBe(false);
  });
  it("filters by type, language and online", () => {
    expect(matchesFilters(base, { ...EMPTY_FILTERS, type: "SC_COACH" })).toBe(false);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, language: "Tamil" })).toBe(false);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, online: true })).toBe(false);
    expect(matchesFilters({ ...base, modes: ["ONLINE", "IN_PERSON"] }, { ...EMPTY_FILTERS, online: true })).toBe(true);
  });
  it("orders verified first, then by name", () => {
    const list = [
      { ...base, profileId: "a", name: "Zara" },
      { ...base, profileId: "b", name: "Amit" },
      { ...base, profileId: "c", name: "Meera", verification: "VERIFIED" as const },
    ];
    expect(filterListings(list, EMPTY_FILTERS).map((l) => l.profileId)).toEqual(["c", "b", "a"]);
  });
  it("builds de-duplicated facets", () => {
    const f = facetValues([base, { ...base, sports: ["badminton", "Football"], city: "noida" }]);
    expect(f.sports).toEqual(["Badminton", "Cricket", "Football"]);
    expect(f.cities).toEqual(["Noida"]);
  });
});

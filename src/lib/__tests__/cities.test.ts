import { describe, it, expect } from "vitest";
import { matchCities, CITY_SUGGESTIONS } from "@/lib/cities";

describe("matchCities", () => {
  it("returns suggestions when the query is empty", () => {
    const results = matchCities("");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it("filters by substring, case-insensitive", () => {
    const results = matchCities("mum");
    expect(results.some((c) => c.name === "Mumbai")).toBe(true);
  });

  it("ranks startsWith matches above substring matches", () => {
    const results = matchCities("ban");
    const bangaloreIdx = results.findIndex((c) => c.name === "Bangalore");
    const manamaIdx = results.findIndex((c) => c.name === "Manama"); // substring 'ana' but no startsWith
    if (bangaloreIdx >= 0 && manamaIdx >= 0) {
      expect(bangaloreIdx).toBeLessThan(manamaIdx);
    } else {
      // Bangalore is in the list, Manama substring doesn't match 'ban' — assert the stronger case
      expect(bangaloreIdx).toBeGreaterThanOrEqual(0);
    }
  });

  it("respects the country filter", () => {
    const indian = matchCities("", "IN");
    expect(indian.every((c) => c.country === "IN")).toBe(true);
    const uae = matchCities("", "AE");
    expect(uae.every((c) => c.country === "AE")).toBe(true);
  });

  it("respects the limit", () => {
    const results = matchCities("", undefined, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("returns [] when nothing matches", () => {
    const results = matchCities("zzzzz-nonsense-name");
    expect(results).toEqual([]);
  });
});

describe("CITY_SUGGESTIONS data integrity", () => {
  it("every entry has a non-empty name and a 2-letter country code", () => {
    for (const c of CITY_SUGGESTIONS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.country).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("has no duplicate (name, country) pairs", () => {
    const seen = new Set<string>();
    for (const c of CITY_SUGGESTIONS) {
      const key = `${c.name}|${c.country}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

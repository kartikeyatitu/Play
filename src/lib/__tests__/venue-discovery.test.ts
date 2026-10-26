import { describe, it, expect } from "vitest";
import { buildVenueCards, parseDiscoveryQuery, VENUES_PER_PAGE } from "@/lib/venue-discovery";

const org = (id: string, city = "Gurgaon", sport: string | null = "Football", photos: string[] = []) => ({ id, slug: id, name: id.toUpperCase(), city, sport, photos });

describe("parseDiscoveryQuery", () => {
  it("accepts known city/sport slugs only and clamps the page", () => {
    const f = parseDiscoveryQuery({ city: "GURGAON", sport: "badminton", page: "0" });
    expect(f.city?.slug).toBe("gurgaon");
    expect(f.sport?.slug).toBe("badminton");
    expect(f.page).toBe(1);
    expect(parseDiscoveryQuery({ city: "atlantis", sport: ["x"], page: "abc" })).toEqual({ city: null, sport: null, page: 1 });
  });
});

describe("buildVenueCards", () => {
  it("lists only orgs with a priced court and summarises courts", () => {
    const r = buildVenueCards(
      [org("a"), org("b"), org("c", "Noida", null, ["http://insecure", "https://img/1.jpg"])],
      [
        { orgId: "a", type: "turf", hourlyRate: 1500 },
        { orgId: "a", type: "TURF", hourlyRate: 1200 },
        { orgId: "b", type: "COURT", hourlyRate: 0 },
        { orgId: "c", type: "BADMINTON", hourlyRate: 400 },
      ],
      parseDiscoveryQuery({})
    );
    expect(r.cards.map((c) => c.slug)).toEqual(["a", "c"]);
    expect(r.cards[0]).toMatchObject({ courts: 2, courtTypes: ["TURF"], fromPrice: 1200, photo: null });
    expect(r.cards[1].photo).toBe("https://img/1.jpg");
  });

  it("filters by city aliases and by sport on org sport or court type", () => {
    const orgs = [org("a", "Gurugram, Haryana"), org("b", "Noida", "Multi"), org("c", "Delhi", "Cricket")];
    const fac = [
      { orgId: "a", type: "TURF", hourlyRate: 1 },
      { orgId: "b", type: "BADMINTON", hourlyRate: 1 },
      { orgId: "c", type: "NETS", hourlyRate: 1 },
    ];
    expect(buildVenueCards(orgs, fac, parseDiscoveryQuery({ city: "gurgaon" })).cards.map((c) => c.slug)).toEqual(["a"]);
    expect(buildVenueCards(orgs, fac, parseDiscoveryQuery({ sport: "badminton" })).cards.map((c) => c.slug)).toEqual(["b"]);
    expect(buildVenueCards(orgs, fac, parseDiscoveryQuery({ sport: "football" })).cards.map((c) => c.slug)).toEqual(["a"]);
    expect(buildVenueCards(orgs, fac, parseDiscoveryQuery({ city: "noida", sport: "cricket" })).total).toBe(0);
  });

  it("paginates", () => {
    const orgs = Array.from({ length: VENUES_PER_PAGE + 3 }, (_, i) => org(`v${String(i).padStart(2, "0")}`));
    const fac = orgs.map((o) => ({ orgId: o.id, type: "TURF", hourlyRate: 100 }));
    const p2 = buildVenueCards(orgs, fac, parseDiscoveryQuery({ page: "2" }));
    expect(p2).toMatchObject({ total: VENUES_PER_PAGE + 3, page: 2, totalPages: 2 });
    expect(p2.cards).toHaveLength(3);
    expect(buildVenueCards(orgs, fac, parseDiscoveryQuery({ page: "9" })).page).toBe(2);
  });
});

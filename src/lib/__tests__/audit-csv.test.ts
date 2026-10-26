import { describe, it, expect } from "vitest";
import { auditRowsToCsv, clampPageSize, csvCell, parseAuditFilter, parseDetails } from "@/lib/audit-csv";

describe("parseAuditFilter", () => {
  it("accepts empty filters", () => {
    expect(parseAuditFilter({})).toEqual({ ok: true, filter: { action: null, from: null, to: null } });
    expect(parseAuditFilter(null).ok).toBe(true);
  });
  it("uppercases action prefixes and rejects odd characters", () => {
    const r = parseAuditFilter({ action: " fee_ " });
    expect(r.ok && r.filter.action).toBe("FEE_");
    expect(parseAuditFilter({ action: "FEE'; DROP" }).ok).toBe(false);
  });
  it("makes the end date inclusive and validates the range", () => {
    const r = parseAuditFilter({ from: "2026-10-01", to: "2026-10-01" });
    expect(r.ok && r.filter.to?.toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(parseAuditFilter({ from: "2026-10-05", to: "2026-10-01" }).ok).toBe(false);
    expect(parseAuditFilter({ from: "2024-01-01", to: "2026-01-01" }).ok).toBe(false);
    expect(parseAuditFilter({ from: "01/10/2026" }).ok).toBe(false);
  });
});

describe("csv", () => {
  it("quotes and neutralises formulas", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("-5")).toBe(`"'-5"`);
    expect(csvCell(null)).toBe('""');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
  it("builds a header plus one line per row", () => {
    const csv = auditRowsToCsv([{ createdAt: "2026-10-26T10:00:00.000Z", action: "BRANCH_CREATED", userName: "Asha", userRole: "ADMIN", details: '{"name":"Noida"}' }]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"time_utc","action","user","role","details"');
    expect(lines[1]).toBe('"2026-10-26T10:00:00.000Z","BRANCH_CREATED","Asha","ADMIN","{""name"":""Noida""}"');
  });
});

describe("helpers", () => {
  it("parses details defensively", () => {
    expect(parseDetails('{"a":1}')).toEqual({ a: 1 });
    expect(parseDetails("plain")).toEqual({ text: "plain" });
    expect(parseDetails("[1]")).toEqual({ value: [1] });
    expect(parseDetails(null)).toBeNull();
  });
  it("clamps page size", () => {
    expect(clampPageSize(1000)).toBe(200);
    expect(clampPageSize("x")).toBe(50);
    expect(clampPageSize(0)).toBe(1);
  });
});

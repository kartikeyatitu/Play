import { describe, it, expect } from "vitest";
import {
  allocationDates,
  allocationGroupId,
  batchIdFromGroup,
  fitsOpeningHours,
  parseAllocationInput,
  weekdayOf,
} from "@/lib/facility-allocation";

const base = { batchId: "b1", facilityId: "f1", startDate: "2026-11-02", weekdays: ["Mon", "Wed"], startHour: 16, hours: 2, weeks: 4 };

describe("allocation group ids", () => {
  it("round-trips the batch id", () => {
    expect(batchIdFromGroup(allocationGroupId("ckbatch123", "uuid-1"))).toBe("ckbatch123");
  });
  it("ignores ordinary lease groups and nulls", () => {
    expect(batchIdFromGroup("6f1c0c3e-9a1b-4e5c-8d7e-1234567890ab")).toBeNull();
    expect(batchIdFromGroup(null)).toBeNull();
    expect(batchIdFromGroup("batch:")).toBeNull();
  });
});

describe("weekdayOf", () => {
  it("maps calendar dates to Mon..Sun", () => {
    expect(weekdayOf("2026-11-02")).toBe("Mon");
    expect(weekdayOf("2026-11-08")).toBe("Sun");
  });
});

describe("parseAllocationInput", () => {
  it("accepts a valid allocation and orders weekdays", () => {
    const r = parseAllocationInput({ ...base, weekdays: ["Wed", "Mon", "Funday"] }, "2026-10-26");
    expect(r).toEqual({ ok: true, data: { ...base, weekdays: ["Mon", "Wed"] } });
  });
  it("rejects past dates, empty weekdays and out-of-range numbers", () => {
    expect(parseAllocationInput(base, "2026-11-03").ok).toBe(false);
    expect(parseAllocationInput({ ...base, weekdays: [] }, "2026-10-26").ok).toBe(false);
    expect(parseAllocationInput({ ...base, hours: 7 }, "2026-10-26").ok).toBe(false);
    expect(parseAllocationInput({ ...base, weeks: 27 }, "2026-10-26").ok).toBe(false);
    expect(parseAllocationInput({ ...base, startHour: 1.5 }, "2026-10-26").ok).toBe(false);
    expect(parseAllocationInput({ ...base, batchId: "" }, "2026-10-26").ok).toBe(false);
  });
});

describe("fitsOpeningHours", () => {
  it("respects open and close hours", () => {
    expect(fitsOpeningHours(6, 2, { openHour: 6, closeHour: 23 })).toBe(true);
    expect(fitsOpeningHours(22, 2, { openHour: 6, closeHour: 23 })).toBe(false);
    expect(fitsOpeningHours(5, 1, { openHour: 6, closeHour: 23 })).toBe(false);
  });
});

describe("allocationDates", () => {
  it("lists the chosen weekdays across the weeks", () => {
    expect(allocationDates("2026-11-02", ["Mon", "Wed"], 2)).toEqual(["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11"]);
  });
  it("starts mid-week without skipping later days of the first week", () => {
    expect(allocationDates("2026-11-04", ["Mon", "Wed"], 1)).toEqual(["2026-11-04", "2026-11-09"]);
  });
});

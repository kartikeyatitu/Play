import { describe, expect, it } from "vitest";
import { buildCohorts, buildFunnel, phoneKey } from "@/lib/funnel";

const d = (s: string) => new Date(`${s}T10:00:00Z`);

describe("phoneKey", () => {
  it("matches on the last 10 digits", () => {
    expect(phoneKey("+91 98765-43210")).toBe("9876543210");
    expect(phoneKey("09876543210")).toBe("9876543210");
    expect(phoneKey("12345")).toBe("");
  });
});

describe("buildFunnel", () => {
  it("counts trials and enrolments from status or later matching records", () => {
    const { rows, total } = buildFunnel(
      [
        { source: "WEBSITE", status: "TRIAL_BOOKED", phone: "9876543210", createdAt: d("2026-09-01") }, // trial done + enrolled via student
        { source: "WEBSITE", status: "TRIAL_BOOKED", phone: "9000000001", createdAt: d("2026-09-02") }, // nothing yet
        { source: "WALK_IN", status: "ENROLLED", phone: "9000000002", createdAt: d("2026-09-03") }, // enrolled by status
        { source: "REFERRAL", status: "NEW", phone: "9000000003", createdAt: d("2026-09-10") }, // student added BEFORE enquiry → not counted
      ],
      [{ phone: "+91 98765 43210", status: "COMPLETED", createdAt: d("2026-09-01") }],
      [
        { phone: "9876543210", createdAt: d("2026-09-05") },
        { phone: "9000000003", createdAt: d("2026-01-01") },
      ],
    );
    const web = rows.find((r) => r.source === "WEBSITE")!;
    expect(web).toMatchObject({ enquiries: 2, trials: 1, enrolled: 1, trialRate: 0.5, enrolRate: 0.5, label: "Website / trial page" });
    expect(rows.find((r) => r.source === "WALK_IN")).toMatchObject({ enquiries: 1, trials: 1, enrolled: 1 });
    expect(rows.find((r) => r.source === "REFERRAL")).toMatchObject({ enquiries: 1, trials: 0, enrolled: 0 });
    expect(total).toMatchObject({ enquiries: 4, trials: 2, enrolled: 2, enrolRate: 0.5 });
    expect(rows[0].source).toBe("WEBSITE");
  });
  it("handles no leads", () => {
    expect(buildFunnel([], [], []).total).toMatchObject({ enquiries: 0, enrolRate: null });
  });
});

describe("buildCohorts", () => {
  it("builds a retention triangle and leaves future months empty", () => {
    const students = [
      { id: "a", joinedMonth: "2026-08" },
      { id: "b", joinedMonth: "2026-08" },
      { id: "c", joinedMonth: "2026-10" },
    ];
    const active = new Map<string, Set<string>>([
      ["a", new Set(["2026-08", "2026-09", "2026-10"])],
      ["b", new Set(["2026-08"])],
      ["c", new Set(["2026-10"])],
    ]);
    const rows = buildCohorts(students, active, "2026-10", 3);
    expect(rows.map((r) => r.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(rows[0]).toMatchObject({ size: 2, retention: [1, 0.5, 0.5] });
    expect(rows[1]).toMatchObject({ size: 0, retention: [null, null, null] });
    expect(rows[2]).toMatchObject({ size: 1, retention: [1, null, null] });
  });
});

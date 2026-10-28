import { describe, expect, it } from "vitest";
import { enqueueMark, flushQueue, istToday, nextTileStatus, readQueue } from "@/lib/attendance-queue";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("attendance queue", () => {
  it("keeps only the latest tap per student", () => {
    const s = mem();
    enqueueMark(s, { batchId: "b", studentId: "x", status: "PRESENT", date: "2026-10-28", at: 1 });
    const n = enqueueMark(s, { batchId: "b", studentId: "x", status: "ABSENT", date: "2026-10-28", at: 2 });
    expect(n).toBe(1);
    expect(readQueue(s)[0].status).toBe("ABSENT");
  });
  it("sends today's marks, drops earlier days, keeps network failures", async () => {
    const s = mem();
    enqueueMark(s, { batchId: "b", studentId: "ok", status: "PRESENT", date: "2026-10-28", at: 1 });
    enqueueMark(s, { batchId: "b", studentId: "old", status: "PRESENT", date: "2026-10-27", at: 1 });
    enqueueMark(s, { batchId: "b", studentId: "net", status: "LATE", date: "2026-10-28", at: 1 });
    enqueueMark(s, { batchId: "b", studentId: "refused", status: "ABSENT", date: "2026-10-28", at: 1 });
    const res = await flushQueue(s, "2026-10-28", async (m) => {
      if (m.studentId === "net") throw new Error("offline");
      return { success: m.studentId !== "refused" };
    });
    expect(res).toEqual({ sent: 1, failed: 1, stale: 1 });
    expect(readQueue(s).map((m) => m.studentId)).toEqual(["net"]);
  });
  it("survives corrupt or missing storage", async () => {
    const s = mem();
    s.setItem("triq:attendance-queue:v1", "{not json");
    expect(readQueue(s)).toEqual([]);
    expect(readQueue(null)).toEqual([]);
    expect(await flushQueue(null, "2026-10-28", async () => ({ success: true }))).toEqual({ sent: 0, failed: 0, stale: 0 });
  });
  it("cycles tile taps and computes IST dates", () => {
    expect([null, "PRESENT", "ABSENT", "LATE", "EXCUSED"].map((x) => nextTileStatus(x as never))).toEqual(["PRESENT", "ABSENT", "LATE", "PRESENT", "PRESENT"]);
    expect(istToday(new Date("2026-10-27T19:00:00Z"))).toBe("2026-10-28");
  });
});

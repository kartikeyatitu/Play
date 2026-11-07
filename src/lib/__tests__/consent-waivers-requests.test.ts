import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { checkSignatureInput, hashSignerIp, nextWaiverVersion, unsignedByBatch, waiverStatusForStudent } from "@/lib/consent/waivers";
import { allowedDataRequestMoves, canMoveDataRequest, exportDownloadOpen, makeReferenceId } from "@/lib/consent/data-requests";

describe("hashSignerIp", () => {
  it("is sha256 of orgId:ip and never contains the ip", () => {
    const h = hashSignerIp("203.0.113.9", "org1");
    expect(h).toBe(crypto.createHash("sha256").update("org1:203.0.113.9").digest("hex"));
    expect(h).not.toContain("203.0.113.9");
  });
  it("differs per academy (salted) and uses the first forwarded ip", () => {
    expect(hashSignerIp("203.0.113.9", "org1")).not.toBe(hashSignerIp("203.0.113.9", "org2"));
    expect(hashSignerIp("203.0.113.9, 10.0.0.1", "org1")).toBe(hashSignerIp("203.0.113.9", "org1"));
  });
  it("is null for an unknown ip", () => {
    expect(hashSignerIp(null, "o")).toBeNull();
    expect(hashSignerIp("unknown", "o")).toBeNull();
  });
});

describe("checkSignatureInput", () => {
  it("needs the checkbox and a typed full name", () => {
    expect(checkSignatureInput({ signedName: "Asha Rao", agreed: false }).ok).toBe(false);
    expect(checkSignatureInput({ signedName: "  ", agreed: true }).ok).toBe(false);
    expect(checkSignatureInput({ signedName: "123", agreed: true }).ok).toBe(false);
    expect(checkSignatureInput({ signedName: "  Asha   Rao ", agreed: true })).toEqual({ ok: true, signedName: "Asha Rao" });
    expect(checkSignatureInput({ signedName: "आशा राव", agreed: true }).ok).toBe(true);
  });
  it("rejects a truthy non-boolean checkbox", () => {
    expect(checkSignatureInput({ signedName: "Asha Rao", agreed: "on" }).ok).toBe(false);
  });
});

describe("waiver versions", () => {
  const v1 = { id: "t1", title: "Liability", version: 1, active: false };
  const v2 = { id: "t2", title: "Liability", version: 2, active: true };
  const photo = { id: "t3", title: "Travel", version: 1, active: true };
  it("next version", () => {
    expect(nextWaiverVersion([v1, v2], "Liability")).toBe(3);
    expect(nextWaiverVersion([v1, v2], "New")).toBe(1);
  });
  it("a signature on an old version needs re-signing", () => {
    const sigs = [{ templateId: "t1", version: 1, studentId: "s1", signedAt: new Date() }];
    const s = waiverStatusForStudent([v1, v2, photo], sigs, "s1");
    expect(s.map((x) => [x.template.id, x.status])).toEqual([
      ["t2", "RESIGN_NEEDED"],
      ["t3", "UNSIGNED"],
    ]);
  });
  it("a signature on the current version counts", () => {
    const sigs = [{ templateId: "t2", version: 2, studentId: "s1", signedAt: new Date("2026-11-01") }];
    expect(waiverStatusForStudent([v2], sigs, "s1")[0].status).toBe("SIGNED");
    expect(waiverStatusForStudent([v2], sigs, "s2")[0].status).toBe("UNSIGNED");
  });
  it("lists unsigned children per batch", () => {
    const batches = [
      { id: "b1", name: "U12", students: [{ id: "s1", name: "A" }, { id: "s2", name: "B" }] },
      { id: "b2", name: "U14", students: [{ id: "s3", name: "C" }] },
    ];
    const sigs = [
      { templateId: "t2", version: 2, studentId: "s1", signedAt: new Date() },
      { templateId: "t1", version: 1, studentId: "s3", signedAt: new Date() },
    ];
    const r = unsignedByBatch(batches, v2, sigs);
    expect(r[0]).toEqual({ batchId: "b1", batchName: "U12", total: 2, unsigned: [{ id: "s2", name: "B" }] });
    expect(r[1].unsigned.map((s) => s.id)).toEqual(["s3"]);
  });
});

describe("data requests", () => {
  it("moves only forward through the allowed statuses", () => {
    expect(canMoveDataRequest("REQUESTED", "IN_REVIEW")).toBe(true);
    expect(canMoveDataRequest("REQUESTED", "DONE")).toBe(false);
    expect(canMoveDataRequest("IN_REVIEW", "DONE")).toBe(true);
    expect(canMoveDataRequest("DONE", "REQUESTED")).toBe(false);
    expect(canMoveDataRequest("IN_REVIEW", "DELETED")).toBe(false);
    expect(allowedDataRequestMoves("REJECTED")).toEqual([]);
    expect(allowedDataRequestMoves("nonsense")).toEqual([]);
  });
  it("makes readable reference ids", () => {
    expect(makeReferenceId(new Uint8Array(10))).toBe("DR-AAAAAAAAAA");
    expect(makeReferenceId()).toMatch(/^DR-[A-HJ-NP-Z2-9]{10}$/);
  });
  it("opens an export download only when done, for 7 days", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    expect(exportDownloadOpen({ type: "EXPORT", status: "DONE", resolvedAt: new Date("2026-11-05T00:00:00Z") }, now)).toBe(true);
    expect(exportDownloadOpen({ type: "EXPORT", status: "DONE", resolvedAt: new Date("2026-11-01T00:00:00Z") }, now)).toBe(false);
    expect(exportDownloadOpen({ type: "EXPORT", status: "IN_REVIEW", resolvedAt: null }, now)).toBe(false);
    expect(exportDownloadOpen({ type: "DELETE", status: "DONE", resolvedAt: new Date("2026-11-09T00:00:00Z") }, now)).toBe(false);
  });
});

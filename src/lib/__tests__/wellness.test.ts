import { describe, it, expect } from "vitest";
import {
  availableActions,
  credentialFieldsChanged,
  parseIstDateTime,
  timestampFieldFor,
  transitionAppointment,
  validateNote,
  validateProvider,
} from "@/lib/wellness";

const now = new Date("2026-10-26T06:00:00Z");
const future = { now, scheduledAt: new Date("2026-10-28T06:00:00Z") };
const past = { now, scheduledAt: new Date("2026-10-25T06:00:00Z") };

describe("appointment state machine", () => {
  it("provider confirms or declines a request", () => {
    expect(transitionAppointment("REQUESTED", "CONFIRM", "PROVIDER", future)).toEqual({ ok: true, to: "CONFIRMED" });
    expect(transitionAppointment("REQUESTED", "DECLINE", "PROVIDER", future)).toEqual({ ok: true, to: "DECLINED" });
  });

  it("requester cannot confirm, decline or complete", () => {
    expect(transitionAppointment("REQUESTED", "CONFIRM", "REQUESTER", future).ok).toBe(false);
    expect(transitionAppointment("REQUESTED", "DECLINE", "REQUESTER", future).ok).toBe(false);
    expect(transitionAppointment("CONFIRMED", "COMPLETE", "REQUESTER", past).ok).toBe(false);
  });

  it("cannot confirm a slot that has passed", () => {
    expect(transitionAppointment("REQUESTED", "CONFIRM", "PROVIDER", past).ok).toBe(false);
  });

  it("completes only confirmed appointments at or after the time", () => {
    expect(transitionAppointment("CONFIRMED", "COMPLETE", "PROVIDER", past)).toEqual({ ok: true, to: "COMPLETED" });
    expect(transitionAppointment("CONFIRMED", "COMPLETE", "PROVIDER", future).ok).toBe(false);
    expect(transitionAppointment("REQUESTED", "COMPLETE", "PROVIDER", past).ok).toBe(false);
  });

  it("either party cancels before completion", () => {
    expect(transitionAppointment("REQUESTED", "CANCEL", "REQUESTER", future)).toEqual({ ok: true, to: "CANCELLED" });
    expect(transitionAppointment("CONFIRMED", "CANCEL", "PROVIDER", future)).toEqual({ ok: true, to: "CANCELLED" });
  });

  it("terminal states accept nothing", () => {
    for (const s of ["DECLINED", "COMPLETED", "CANCELLED"]) {
      expect(availableActions(s, "PROVIDER", past)).toEqual([]);
      expect(availableActions(s, "REQUESTER", past)).toEqual([]);
    }
  });

  it("rejects unknown statuses and actions", () => {
    expect(transitionAppointment("BOGUS", "CANCEL", "PROVIDER", future).ok).toBe(false);
    expect(transitionAppointment("REQUESTED", "DELETE", "PROVIDER", future).ok).toBe(false);
  });

  it("lists actions per actor", () => {
    expect(availableActions("REQUESTED", "PROVIDER", future)).toEqual(["CONFIRM", "DECLINE", "CANCEL"]);
    expect(availableActions("REQUESTED", "REQUESTER", future)).toEqual(["CANCEL"]);
    expect(availableActions("CONFIRMED", "PROVIDER", past)).toEqual(["COMPLETE", "CANCEL"]);
  });

  it("maps statuses to their timestamp column", () => {
    expect(timestampFieldFor("CONFIRMED")).toBe("confirmedAt");
    expect(timestampFieldFor("CANCELLED")).toBe("cancelledAt");
    expect(timestampFieldFor("REQUESTED")).toBeNull();
  });
});

describe("validation", () => {
  it("parses IST datetime-local input", () => {
    const r = parseIstDateTime("2026-10-27T10:30", now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.toISOString()).toBe("2026-10-27T05:00:00.000Z");
  });

  it("rejects past, far-future and malformed times", () => {
    expect(parseIstDateTime("2026-10-26T09:00", now).ok).toBe(false); // 03:30Z, before now
    expect(parseIstDateTime("2027-10-26T09:00", now).ok).toBe(false);
    expect(parseIstDateTime("tomorrow", now).ok).toBe(false);
    expect(parseIstDateTime("2026-02-30T10:00", new Date("2026-01-01T00:00:00Z")).ok).toBe(false);
  });

  it("validates provider profiles", () => {
    expect(validateProvider({ displayName: "Dr Rao Physio", category: "PHYSIOTHERAPY", isListed: "on" }).ok).toBe(true);
    expect(validateProvider({ displayName: "X", category: "PHYSIOTHERAPY" }).ok).toBe(false);
    expect(validateProvider({ displayName: "Dr Rao", category: "SURGERY" }).ok).toBe(false);
  });

  it("detects credential-relevant edits", () => {
    const a = { registrationBody: "IAP", registrationNumber: "123", category: "PHYSIOTHERAPY" };
    expect(credentialFieldsChanged(a, { ...a })).toBe(false);
    expect(credentialFieldsChanged(a, { ...a, registrationNumber: "124" })).toBe(true);
  });

  it("caps notes", () => {
    expect(validateNote("x".repeat(501)).ok).toBe(false);
    expect(validateNote("")).toEqual({ ok: true, value: null });
  });
});

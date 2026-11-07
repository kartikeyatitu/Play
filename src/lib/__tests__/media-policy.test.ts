import { describe, it, expect } from "vitest";
import {
  ANONYMOUS_VIEWER,
  canDeleteMedia,
  canUploadMedia,
  canView,
  explainView,
  isPubliclyViewable,
  type ConsentForView,
  type MediaForView,
  type MediaViewer,
  type SubjectForView,
} from "@/lib/media/policy";

const ORG = "org1";
const media = (over: Partial<MediaForView> = {}): MediaForView => ({ orgId: ORG, contextType: "SESSION", status: "READY", deletedAt: null, ...over });
const subj = (studentId: string, batchIds: string[] = ["b1"]): SubjectForView => ({ studentId, batchIds });
const consent = (studentId: string, scope: string, over: Partial<ConsentForView> = {}): ConsentForView => ({ orgId: ORG, studentId, scope, withdrawnAt: null, ...over });

const staff: MediaViewer = { userId: "coach", staffOrgIds: [ORG], guardianOfStudentIds: [], childBatchIds: [] };
const parentB1: MediaViewer = { userId: "p1", staffOrgIds: [], guardianOfStudentIds: ["mine"], childBatchIds: ["b1"] };
const parentB2: MediaViewer = { userId: "p2", staffOrgIds: [], guardianOfStudentIds: ["other"], childBatchIds: ["b2"] };

describe("canView: staff", () => {
  it("academy staff always see media of their academy, even with no consent or tags", () => {
    expect(explainView(staff, media(), [], [])).toEqual({ allowed: true, reason: "STAFF" });
    expect(canView(staff, media({ status: "PENDING" }), [subj("a")], [])).toBe(true);
    expect(canView(staff, media({ status: "QUARANTINED" }), [subj("a")], [])).toBe(true);
  });
  it("staff of another academy get no staff access", () => {
    const other: MediaViewer = { ...staff, staffOrgIds: ["org2"] };
    expect(canView(other, media(), [subj("a")], [])).toBe(false);
  });
  it("nobody sees deleted media, staff included", () => {
    expect(explainView(staff, media({ deletedAt: new Date() }), [], [])).toEqual({ allowed: false, reason: "DELETED" });
    expect(canView(staff, media({ status: "DELETED" }), [], [])).toBe(false);
  });
  it("a staff list with a null userId is ignored", () => {
    expect(canView({ ...staff, userId: null }, media(), [subj("a")], [])).toBe(false);
  });
});

describe("canView: guardians in the same batch", () => {
  it("sees a photo when every tagged child has parents_of_batch and shares a batch", () => {
    const subjects = [subj("a"), subj("b")];
    const consents = [consent("a", "parents_of_batch"), consent("b", "parents_of_batch")];
    expect(explainView(parentB1, media(), subjects, consents)).toEqual({ allowed: true, reason: "GUARDIAN" });
  });
  it("is denied when any one tagged child lacks parents_of_batch", () => {
    const subjects = [subj("a"), subj("b")];
    expect(canView(parentB1, media(), subjects, [consent("a", "parents_of_batch")])).toBe(false);
  });
  it("is denied when the guardian's child is in a different batch", () => {
    expect(canView(parentB2, media(), [subj("a", ["b1"])], [consent("a", "parents_of_batch")])).toBe(false);
  });
  it("requires a shared batch with every tagged child, not just one", () => {
    const subjects = [subj("a", ["b1"]), subj("c", ["b3"])];
    const consents = [consent("a", "parents_of_batch"), consent("c", "parents_of_batch")];
    expect(canView(parentB1, media(), subjects, consents)).toBe(false);
  });
  it("a guardian always sees their own child, and needs consent for the others", () => {
    expect(canView(parentB1, media(), [subj("mine")], [])).toBe(true);
    expect(canView(parentB1, media(), [subj("mine"), subj("a")], [])).toBe(false);
    expect(canView(parentB1, media(), [subj("mine"), subj("a")], [consent("a", "parents_of_batch")])).toBe(true);
  });
  it("other scopes do not stand in for parents_of_batch", () => {
    expect(canView(parentB1, media(), [subj("a")], [consent("a", "internal_coaching")])).toBe(false);
    expect(canView(parentB1, media(), [subj("a")], [consent("a", "tournament_public")])).toBe(false);
  });
  it("only READY media is visible to guardians", () => {
    const c = [consent("a", "parents_of_batch")];
    expect(explainView(parentB1, media({ status: "PENDING" }), [subj("a")], c)).toEqual({ allowed: false, reason: "NOT_READY" });
    expect(canView(parentB1, media({ status: "QUARANTINED" }), [subj("mine")], [])).toBe(false);
  });
  it("untagged media stays staff-only", () => {
    expect(explainView(parentB1, media(), [], [])).toEqual({ allowed: false, reason: "UNTAGGED" });
    expect(canView(ANONYMOUS_VIEWER, media(), [], [])).toBe(false);
  });
});

describe("canView: withdrawal and academy scoping", () => {
  it("withdrawn consent stops access immediately", () => {
    const withdrawn = [consent("a", "parents_of_batch", { withdrawnAt: new Date() })];
    expect(canView(parentB1, media(), [subj("a")], withdrawn)).toBe(false);
  });
  it("a withdrawn row next to an active one still counts the active one (re-grant is a new row)", () => {
    const rows = [consent("a", "parents_of_batch", { withdrawnAt: new Date("2026-01-01") }), consent("a", "parents_of_batch")];
    expect(canView(parentB1, media(), [subj("a")], rows)).toBe(true);
  });
  it("consent given at another academy does not apply", () => {
    expect(canView(parentB1, media(), [subj("a")], [consent("a", "parents_of_batch", { orgId: "org2" })])).toBe(false);
    expect(canView(ANONYMOUS_VIEWER, media(), [subj("a")], [consent("a", "academy_public", { orgId: "org2" })])).toBe(false);
  });
});

describe("canView: public", () => {
  it("anyone sees it when every tagged child has academy_public", () => {
    const c = [consent("a", "academy_public"), consent("b", "academy_public")];
    expect(explainView(ANONYMOUS_VIEWER, media(), [subj("a"), subj("b")], c)).toEqual({ allowed: true, reason: "PUBLIC" });
  });
  it("is denied when one child lacks a public scope", () => {
    expect(canView(ANONYMOUS_VIEWER, media(), [subj("a"), subj("b")], [consent("a", "academy_public")])).toBe(false);
  });
  it("tournament_public counts for TOURNAMENT and MATCH media only", () => {
    const c = [consent("a", "tournament_public")];
    expect(canView(ANONYMOUS_VIEWER, media({ contextType: "TOURNAMENT" }), [subj("a")], c)).toBe(true);
    expect(canView(ANONYMOUS_VIEWER, media({ contextType: "MATCH" }), [subj("a")], c)).toBe(true);
    expect(canView(ANONYMOUS_VIEWER, media({ contextType: "SESSION" }), [subj("a")], c)).toBe(false);
    expect(canView(ANONYMOUS_VIEWER, media({ contextType: "GALLERY" }), [subj("a")], c)).toBe(false);
  });
  it("mixing academy_public and tournament_public works for a tournament photo", () => {
    const c = [consent("a", "academy_public"), consent("b", "tournament_public")];
    expect(canView(ANONYMOUS_VIEWER, media({ contextType: "TOURNAMENT" }), [subj("a"), subj("b")], c)).toBe(true);
  });
  it("parents_of_batch never makes media public", () => {
    expect(canView(ANONYMOUS_VIEWER, media(), [subj("a")], [consent("a", "parents_of_batch")])).toBe(false);
  });
  it("withdrawn public consent hides it at once", () => {
    const c = [consent("a", "academy_public", { withdrawnAt: new Date() })];
    expect(isPubliclyViewable(media(), [subj("a")], c)).toBe(false);
  });
  it("non-READY or untagged media is never public", () => {
    const c = [consent("a", "academy_public")];
    expect(isPubliclyViewable(media({ status: "PENDING" }), [subj("a")], c)).toBe(false);
    expect(isPubliclyViewable(media(), [], c)).toBe(false);
  });
  it("a signed-in guardian from elsewhere can see public media", () => {
    expect(canView(parentB2, media(), [subj("a")], [consent("a", "academy_public")])).toBe(true);
  });
});

describe("upload and delete permissions", () => {
  it("owners, managers and coaches upload; staff, inactive and missing memberships do not", () => {
    expect(canUploadMedia({ role: "OWNER", status: "ACTIVE" })).toBe(true);
    expect(canUploadMedia({ role: "MANAGER" })).toBe(true);
    expect(canUploadMedia({ role: "COACH", status: "ACTIVE" })).toBe(true);
    expect(canUploadMedia({ role: "STAFF", status: "ACTIVE" })).toBe(false);
    expect(canUploadMedia({ role: "COACH", status: "REMOVED" })).toBe(false);
    expect(canUploadMedia(null)).toBe(false);
  });
  it("coaches delete only their own uploads; owners and managers any", () => {
    expect(canDeleteMedia({ role: "COACH" }, "u1", { uploaderId: "u1" })).toBe(true);
    expect(canDeleteMedia({ role: "COACH" }, "u1", { uploaderId: "u2" })).toBe(false);
    expect(canDeleteMedia({ role: "MANAGER" }, "u1", { uploaderId: "u2" })).toBe(true);
    expect(canDeleteMedia({ role: "STAFF" }, "u1", { uploaderId: "u1" })).toBe(false);
  });
});

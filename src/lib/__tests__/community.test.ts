import { describe, it, expect } from "vitest";
import {
  COMMENT_MAX_LENGTH,
  sanitizeCommentBody,
  canParentSeeAnnouncement,
  canModerate,
  familiesCount,
  seenByFamilies,
  seenByLabel,
  commentAuthorLabel,
} from "@/lib/community";

describe("canParentSeeAnnouncement", () => {
  it("shows academy-wide posts to every parent", () => {
    expect(canParentSeeAnnouncement([], { batchId: null })).toBe(true);
    expect(canParentSeeAnnouncement(["b1"], { batchId: undefined })).toBe(true);
  });
  it("shows batch posts only to parents of that batch", () => {
    expect(canParentSeeAnnouncement(["b1", "b2"], { batchId: "b2" })).toBe(true);
    expect(canParentSeeAnnouncement(["b1"], { batchId: "b9" })).toBe(false);
    expect(canParentSeeAnnouncement([], { batchId: "b1" })).toBe(false);
  });
});

describe("sanitizeCommentBody", () => {
  it("trims and keeps inner newlines", () => {
    expect(sanitizeCommentBody("  hello\nthere  ")).toEqual({ ok: true, body: "hello\nthere" });
  });
  it("rejects empty and non-string bodies", () => {
    expect(sanitizeCommentBody("   ").ok).toBe(false);
    expect(sanitizeCommentBody(undefined).ok).toBe(false);
    expect(sanitizeCommentBody(42).ok).toBe(false);
  });
  it("strips control characters and collapses blank lines", () => {
    const r = sanitizeCommentBody("a\u0000b\n\n\n\nc");
    expect(r).toEqual({ ok: true, body: "ab\n\nc" });
  });
  it("enforces the length limit", () => {
    expect(sanitizeCommentBody("x".repeat(COMMENT_MAX_LENGTH)).ok).toBe(true);
    expect(sanitizeCommentBody("x".repeat(COMMENT_MAX_LENGTH + 1)).ok).toBe(false);
  });
});

describe("canModerate", () => {
  it("never lets a parent moderate", () => {
    expect(canModerate({ role: "PARENT", isAuthor: true, coachOwnsBatch: true, hasModeratePermission: true })).toBe(false);
  });
  it("lets the author moderate", () => {
    expect(canModerate({ role: "COACH", isAuthor: true })).toBe(true);
    expect(canModerate({ role: "ADMIN", isAuthor: true })).toBe(true);
  });
  it("lets the batch coach moderate, but not another coach", () => {
    expect(canModerate({ role: "COACH", coachOwnsBatch: true })).toBe(true);
    expect(canModerate({ role: "COACH", coachOwnsBatch: false })).toBe(false);
  });
  it("requires community.moderate for admins who are not the author", () => {
    expect(canModerate({ role: "ADMIN", hasModeratePermission: true })).toBe(true);
    expect(canModerate({ role: "ADMIN", hasModeratePermission: false })).toBe(false);
  });
  it("does not let staff moderate via the permission (ADMIN-app only)", () => {
    expect(canModerate({ role: "STAFF", hasModeratePermission: true })).toBe(false);
  });
});

describe("read receipts helpers", () => {
  it("counts distinct families", () => {
    expect(familiesCount([{ parentId: "p1" }, { parentId: "p1" }, { parentId: "p2" }, { parentId: null }])).toBe(2);
  });
  it("only counts readers in the audience", () => {
    expect(seenByFamilies(["p1", "coach", "p1", "p3"], ["p1", "p2", "p3"])).toBe(2);
  });
  it("labels singular and plural", () => {
    expect(seenByLabel(18, 24)).toBe("Seen by 18 / 24 families");
    expect(seenByLabel(1, 1)).toBe("Seen by 1 / 1 family");
  });
});

describe("commentAuthorLabel", () => {
  it("shows first name and role only", () => {
    expect(commentAuthorLabel("Priya Sharma", "PARENT")).toBe("Priya · Parent");
    expect(commentAuthorLabel("Ravi Kumar", "COACH")).toBe("Ravi · Coach");
  });
  it("never shows a phone number used as a name", () => {
    expect(commentAuthorLabel("9876543210", "PARENT")).toBe("Parent");
    expect(commentAuthorLabel("", "PARENT")).toBe("Member · Parent");
  });
});

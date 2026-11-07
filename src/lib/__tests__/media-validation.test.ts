import { describe, it, expect } from "vitest";
import { fitWithin, pickOutputType } from "@/lib/media/compress";
import { isMediaContextType, isMediaScope, MEDIA_SCOPES } from "@/lib/media/constants";
import {
  allKeys,
  checkBatchSize,
  checkInputFile,
  checkUploadMeta,
  cleanIds,
  mediaKeys,
  parseUploadPayload,
  parseVariants,
} from "@/lib/media/validation";
import { initialStatusAfterUpload, moderationProvider, videoProcessor } from "@/lib/media/vendors";

describe("checkInputFile", () => {
  it("accepts phone photo types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"]) expect(checkInputFile({ type, size: 3_000_000 }).ok).toBe(true);
    expect(checkInputFile({ type: "", size: 1000 }).ok).toBe(true); // some pickers omit the type
  });
  it("rejects video, other types, empty and oversized files", () => {
    expect(checkInputFile({ type: "video/mp4", size: 1000 })).toMatchObject({ ok: false });
    expect(checkInputFile({ type: "image/gif", size: 1000 })).toMatchObject({ ok: false });
    expect(checkInputFile({ type: "image/svg+xml", size: 1000 })).toMatchObject({ ok: false });
    expect(checkInputFile({ type: "image/jpeg", size: 0 })).toMatchObject({ ok: false });
    expect(checkInputFile({ type: "image/jpeg", size: 26 * 1024 * 1024 })).toMatchObject({ ok: false });
  });
});

describe("checkUploadMeta", () => {
  it("only accepts compressed JPEG/WebP within limits", () => {
    expect(checkUploadMeta({ mimeType: "image/webp", bytes: 900_000, thumbBytes: 60_000 }).ok).toBe(true);
    expect(checkUploadMeta({ mimeType: "image/png", bytes: 900_000, thumbBytes: 60_000 }).ok).toBe(false);
    expect(checkUploadMeta({ mimeType: "image/jpeg", bytes: 5 * 1024 * 1024, thumbBytes: 60_000 }).ok).toBe(false);
    expect(checkUploadMeta({ mimeType: "image/jpeg", bytes: 900_000, thumbBytes: 600 * 1024 }).ok).toBe(false);
    expect(checkUploadMeta({ mimeType: "image/jpeg", bytes: Number.NaN, thumbBytes: 1 }).ok).toBe(false);
  });
  it("bounds batch size", () => {
    expect(checkBatchSize(0).ok).toBe(false);
    expect(checkBatchSize(30).ok).toBe(true);
    expect(checkBatchSize(31).ok).toBe(false);
  });
});

describe("storage keys", () => {
  const nonce = "a".repeat(32);
  it("hold only opaque ids under media/<org>/", () => {
    const k = mediaKeys("org123abc", "asset123abc", nonce, "image/webp");
    expect(k.web).toBe(`media/org123abc/asset123abc-${nonce}/web.webp`);
    expect(k.thumb).toBe(`media/org123abc/asset123abc-${nonce}/thumb.webp`);
    expect(mediaKeys("org123abc", "asset123abc", nonce, "image/jpeg").web.endsWith(".jpg")).toBe(true);
  });
  it("reject path tricks", () => {
    expect(() => mediaKeys("../etc", "asset123abc", nonce, "image/jpeg")).toThrow();
    expect(() => mediaKeys("org123abc", "a/b", nonce, "image/jpeg")).toThrow();
    expect(() => mediaKeys("org123abc", "asset123abc", "short", "image/jpeg")).toThrow();
  });
  it("lists every key of an asset for deletion", () => {
    expect(allKeys({ storageKey: "a", variants: { thumb: "b" } })).toEqual(["a", "b"]);
    expect(allKeys({ storageKey: "a", variants: null })).toEqual(["a"]);
    expect(parseVariants({ thumb: 5 })).toEqual({});
  });
});

describe("client input parsing", () => {
  it("parses the upload payload strictly", () => {
    expect(parseUploadPayload(JSON.stringify({ assetId: "abcdef123456" }))).toEqual({ assetId: "abcdef123456" });
    expect(parseUploadPayload(JSON.stringify({ assetId: "../x" }))).toBeNull();
    expect(parseUploadPayload("not json")).toBeNull();
    expect(parseUploadPayload(null)).toBeNull();
  });
  it("cleans id lists", () => {
    expect(cleanIds(["abcdefgh1", "abcdefgh1", "bad id", 5, "abcdefgh2"], 10)).toEqual(["abcdefgh1", "abcdefgh2"]);
    expect(cleanIds("abcdefgh1", 10)).toEqual([]);
    expect(cleanIds(Array.from({ length: 50 }, (_, i) => `student${String(i).padStart(4, "0")}`), 40)).toHaveLength(40);
  });
  it("knows the contexts and four scopes", () => {
    expect(MEDIA_SCOPES).toEqual(["internal_coaching", "parents_of_batch", "academy_public", "tournament_public"]);
    expect(isMediaScope("public")).toBe(false);
    expect(isMediaContextType("SESSION")).toBe(true);
    expect(isMediaContextType("PROFILE")).toBe(false);
  });
});

describe("compression maths", () => {
  it("fits the long edge to 2048 and never upscales", () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(() => fitWithin(0, 10, 2048)).toThrow();
  });
  it("rejects encoders that fell back to PNG", () => {
    expect(pickOutputType("image/webp")).toBe("image/webp");
    expect(pickOutputType("image/jpeg")).toBe("image/jpeg");
    expect(pickOutputType("image/png")).toBeNull();
    expect(pickOutputType(undefined)).toBeNull();
  });
});

describe("vendor seams stay disabled", () => {
  it("video and moderation are off and photos go READY", async () => {
    expect(videoProcessor.status().enabled).toBe(false);
    expect(moderationProvider.status().enabled).toBe(false);
    await expect(videoProcessor.process({ orgId: "o", storageKey: "k" })).rejects.toThrow();
    expect(initialStatusAfterUpload()).toBe("READY");
  });
});

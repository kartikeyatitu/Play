/** Upload checks and storage keys. Pure, used on client and server. */
import {
  MEDIA_INPUT_TYPES,
  MEDIA_MAX_FILES_PER_BATCH,
  MEDIA_MAX_INPUT_BYTES,
  MEDIA_MAX_THUMB_BYTES,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_UPLOAD_TYPES,
} from "./constants";

export type Check = { ok: true } | { ok: false; error: string };

/** Checks a file picked from the camera or gallery, before it is compressed. */
export function checkInputFile(file: { type: string; size: number; name?: string }): Check {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("video/")) return { ok: false, error: "Videos are not supported yet. Please pick photos." };
  // Some Android pickers give an empty type for HEIC; let decoding decide, size still applies.
  if (type && !(MEDIA_INPUT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Please pick a JPG, PNG, WebP or HEIC photo." };
  }
  if (file.size <= 0) return { ok: false, error: "This file is empty." };
  if (file.size > MEDIA_MAX_INPUT_BYTES) return { ok: false, error: "This photo is too large (max 25 MB)." };
  return { ok: true };
}

/** Checks a compressed file the server is about to accept. */
export function checkUploadMeta(meta: { mimeType: string; bytes: number; thumbBytes: number }): Check {
  if (!(MEDIA_UPLOAD_TYPES as readonly string[]).includes(meta.mimeType)) {
    return { ok: false, error: "Photos must be compressed to JPEG or WebP before upload." };
  }
  if (!Number.isFinite(meta.bytes) || meta.bytes <= 0 || meta.bytes > MEDIA_MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Compressed photo is too large (max 4 MB)." };
  }
  if (!Number.isFinite(meta.thumbBytes) || meta.thumbBytes <= 0 || meta.thumbBytes > MEDIA_MAX_THUMB_BYTES) {
    return { ok: false, error: "Thumbnail is too large." };
  }
  return { ok: true };
}

export function checkBatchSize(count: number): Check {
  if (count < 1) return { ok: false, error: "Pick at least one photo." };
  if (count > MEDIA_MAX_FILES_PER_BATCH) return { ok: false, error: `Up to ${MEDIA_MAX_FILES_PER_BATCH} photos at a time.` };
  return { ok: true };
}

export const extensionFor = (mimeType: string) => (mimeType === "image/webp" ? "webp" : "jpg");

const ID_RE = /^[a-z0-9]{8,40}$/i;
const NONCE_RE = /^[a-f0-9]{16,64}$/;

/**
 * Storage keys hold only opaque ids and a random nonce: no names, no dates of birth, nothing that
 * identifies a child. Layout: media/<orgId>/<assetId>-<nonce>/{web,thumb}.<ext>
 */
export function mediaKeys(orgId: string, assetId: string, nonce: string, mimeType: string) {
  if (!ID_RE.test(orgId) || !ID_RE.test(assetId) || !NONCE_RE.test(nonce)) throw new Error("Invalid media key parts");
  const ext = extensionFor(mimeType);
  const base = `media/${orgId}/${assetId}-${nonce}`;
  return { web: `${base}/web.${ext}`, thumb: `${base}/thumb.${ext}` };
}

/** Variant keys stored on MediaAsset.variants. */
export interface MediaVariants {
  thumb?: string;
}

export function parseVariants(v: unknown): MediaVariants {
  if (!v || typeof v !== "object") return {};
  const thumb = (v as Record<string, unknown>).thumb;
  return typeof thumb === "string" ? { thumb } : {};
}

/** Every storage key that belongs to an asset (main file plus variants). */
export function allKeys(asset: { storageKey: string; variants: unknown }): string[] {
  const v = parseVariants(asset.variants);
  return [asset.storageKey, ...(v.thumb ? [v.thumb] : [])];
}

/** Client payload sent with the direct-to-storage upload; only the asset id is trusted from it. */
export function parseUploadPayload(raw: string | null): { assetId: string } | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { assetId?: unknown };
    return typeof p.assetId === "string" && ID_RE.test(p.assetId) ? { assetId: p.assetId } : null;
  } catch {
    return null;
  }
}

/** De-duplicates and bounds a list of ids from the client. */
export function cleanIds(ids: unknown, max: number): string[] {
  if (!Array.isArray(ids)) return [];
  const out = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && ID_RE.test(id)) out.add(id);
    if (out.size >= max) break;
  }
  return [...out];
}

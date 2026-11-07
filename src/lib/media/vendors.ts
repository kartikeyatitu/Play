/**
 * Clean seams for features that need a vendor decision. Both are DISABLED: no vendor is chosen, no
 * package or key is added, and nothing calls out of the platform.
 *
 * - Video: needs a transcoding/streaming vendor (poster frames, size limits, adaptive playback).
 *   Until then uploads accept photos only (validation.ts rejects video/*).
 * - Automated moderation: needs a vendor and a DPA covering children's images. Until then every photo
 *   goes READY after upload; staff review and delete by hand. QUARANTINED is reserved for this.
 *
 * No face recognition, ever: tagging is manual.
 */

export type VendorStatus = { enabled: false; reason: string } | { enabled: true };

export interface VideoProcessor {
  status(): VendorStatus;
  /** Starts transcoding of an uploaded original; returns the variant keys when done. */
  process(input: { orgId: string; storageKey: string }): Promise<{ variants: Record<string, string>; durationSec: number }>;
}

export type ModerationVerdict = "ALLOW" | "QUARANTINE";

export interface ModerationProvider {
  status(): VendorStatus;
  review(input: { orgId: string; storageKey: string; mimeType: string }): Promise<ModerationVerdict>;
}

const PENDING_VENDOR = "Needs a vendor decision";

export const videoProcessor: VideoProcessor = {
  status: () => ({ enabled: false, reason: `Video: ${PENDING_VENDOR}` }),
  process: async () => {
    throw new Error("Video processing is not enabled");
  },
};

export const moderationProvider: ModerationProvider = {
  status: () => ({ enabled: false, reason: `Automated moderation: ${PENDING_VENDOR}` }),
  // Disabled: the caller keeps the manual flow and never quarantines automatically.
  review: async () => "ALLOW",
};

export function initialStatusAfterUpload(moderation: ModerationProvider = moderationProvider): "READY" | "PENDING_REVIEW" {
  return moderation.status().enabled ? "PENDING_REVIEW" : "READY";
}

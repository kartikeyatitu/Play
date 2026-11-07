/**
 * Consent-first media (flag FEATURES.media). Shared constants, safe for client and server.
 * Tables: MediaAsset, MediaSubject, MediaConsent, MediaAudit (prisma/sql/2026-10-29_wave2.sql).
 */

export const MEDIA_CONTEXT_TYPES = ["MATCH", "SESSION", "TOURNAMENT", "GALLERY"] as const;
export type MediaContextType = (typeof MEDIA_CONTEXT_TYPES)[number];

export const MEDIA_SCOPES = ["internal_coaching", "parents_of_batch", "academy_public", "tournament_public"] as const;
export type MediaScope = (typeof MEDIA_SCOPES)[number];

export const MEDIA_KINDS = ["PHOTO", "VIDEO"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_STATUSES = ["PENDING", "READY", "QUARANTINED", "DELETED"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const MEDIA_AUDIT_ACTIONS = [
  "UPLOAD",
  "TAG",
  "CONSENT_GRANT",
  "CONSENT_WITHDRAW",
  "DELETE",
  "PURGE",
] as const;
export type MediaAuditAction = (typeof MEDIA_AUDIT_ACTIONS)[number];

/** Version of the plain-language notice shown on the consent screen. Bump when the wording changes. */
export const MEDIA_NOTICE_VERSION = "media-notice-v1-2026-11";

/**
 * How consent given on the in-app screen is recorded. The guardian is signed in, but sign-in may be
 * OTP, Google or email, so this is not claimed to be OTP. COUNSEL: confirm whether this counts as
 * verifiable parental consent.
 */
export const MEDIA_IN_APP_CONSENT_METHOD = "IN_APP";

/** Content types the browser may upload (after client-side re-encode, which strips EXIF/GPS). */
export const MEDIA_UPLOAD_TYPES = ["image/jpeg", "image/webp"] as const;
/** Content types accepted from the camera / gallery picker before re-encoding. */
export const MEDIA_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export const MEDIA_MAX_INPUT_BYTES = 25 * 1024 * 1024; // original photo straight from a phone
export const MEDIA_MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // after compression (2048px q0.8 is ~0.4–1.2 MB)
export const MEDIA_MAX_THUMB_BYTES = 512 * 1024;
export const MEDIA_MAX_FILES_PER_BATCH = 30;
export const MEDIA_MAX_TAGS = 40;

export const MEDIA_WEB_EDGE = 2048;
export const MEDIA_THUMB_EDGE = 480;
export const MEDIA_QUALITY = 0.8;

/** Client upload tokens are valid this long. */
export const MEDIA_UPLOAD_TOKEN_MS = 10 * 60 * 1000;

export const MEDIA_SCOPE_LABELS: Record<MediaScope, { title: string; body: string }> = {
  internal_coaching: {
    title: "Coaching use",
    body: "Coaches may use photos of your child for technique feedback inside the academy.",
  },
  parents_of_batch: {
    title: "Parents in the same batch",
    body: "Parents of children in your child's batch may see photos your child is tagged in.",
  },
  academy_public: {
    title: "Academy public pages",
    body: "The academy may show photos your child is tagged in on its public pages.",
  },
  tournament_public: {
    title: "Tournament and match pages",
    body: "Photos from tournaments and matches your child is tagged in may be shown publicly.",
  },
};

export const MEDIA_CONTEXT_LABELS: Record<MediaContextType, string> = {
  MATCH: "Match",
  SESSION: "Session",
  TOURNAMENT: "Tournament",
  GALLERY: "Academy gallery",
};

export const isMediaContextType = (v: unknown): v is MediaContextType =>
  typeof v === "string" && (MEDIA_CONTEXT_TYPES as readonly string[]).includes(v);

export const isMediaScope = (v: unknown): v is MediaScope =>
  typeof v === "string" && (MEDIA_SCOPES as readonly string[]).includes(v);

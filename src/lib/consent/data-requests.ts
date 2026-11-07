// Pure rules for DataRequest (flag FEATURES.dataRequests). The queue only records decisions:
// nothing is ever deleted by this code. A DELETE request marked DONE means a person carried out the
// deletion through the approved manual process; the purge pipeline is not built.
import crypto from "crypto";

export const DATA_REQUEST_TYPES = ["DELETE", "EXPORT"] as const;
export type DataRequestType = (typeof DATA_REQUEST_TYPES)[number];

export const DATA_REQUEST_STATUSES = ["REQUESTED", "IN_REVIEW", "DONE", "REJECTED"] as const;
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

export const isDataRequestStatus = (v: unknown): v is DataRequestStatus =>
  typeof v === "string" && (DATA_REQUEST_STATUSES as readonly string[]).includes(v);

const MOVES: Record<DataRequestStatus, DataRequestStatus[]> = {
  REQUESTED: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["DONE", "REJECTED", "REQUESTED"],
  DONE: [],
  REJECTED: [],
};

export function allowedDataRequestMoves(from: string): DataRequestStatus[] {
  return isDataRequestStatus(from) ? MOVES[from] : [];
}

export function canMoveDataRequest(from: string, to: string): boolean {
  return isDataRequestStatus(to) && allowedDataRequestMoves(from).includes(to);
}

export const isFinalStatus = (s: string) => s === "DONE" || s === "REJECTED";

/** "DR-" + 10 characters from an unambiguous alphabet (no 0/O/1/I). Pass bytes in tests. */
export function makeReferenceId(bytes: Uint8Array = crypto.randomBytes(10)): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  return `DR-${out}`;
}

/**
 * How long a guardian can download an approved export.
 * COUNSEL: confirm response deadlines for export and erasure requests, and whether this window is right.
 */
export const EXPORT_DOWNLOAD_DAYS = 7;

export function exportDownloadOpen(req: { type: string; status: string; resolvedAt: Date | null }, now: Date = new Date()): boolean {
  if (req.type !== "EXPORT" || req.status !== "DONE" || !req.resolvedAt) return false;
  return now.getTime() - new Date(req.resolvedAt).getTime() <= EXPORT_DOWNLOAD_DAYS * 24 * 60 * 60 * 1000;
}

/** Audit action name used for every DataRequest event (created, status change, download). */
export const DATA_REQUEST_AUDIT_ACTION = "DATA_REQUEST";

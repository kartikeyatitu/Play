/**
 * Audit-log viewer and export rules (pure, no DB). Used by V1 Business settings and V11 Enterprise audit trails.
 */

export const AUDIT_LOG_VIEWER_DISABLED_ERROR = "The audit log viewer is not enabled for this academy yet.";
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_MAX_PAGE_SIZE = 200;
export const AUDIT_EXPORT_MAX_ROWS = 5000;
export const AUDIT_MAX_RANGE_DAYS = 366;

export type AuditFilter = { action: string | null; from: Date | null; to: Date | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a filter from the client. action is an uppercase prefix (e.g. "FEE", "BATCH_"); from/to are inclusive
 * YYYY-MM-DD calendar days in UTC. The range may not exceed AUDIT_MAX_RANGE_DAYS.
 */
export function parseAuditFilter(raw: { action?: unknown; from?: unknown; to?: unknown } | null | undefined):
  | { ok: true; filter: AuditFilter }
  | { ok: false; error: string } {
  const r = raw ?? {};
  let action: string | null = null;
  if (typeof r.action === "string" && r.action.trim()) {
    action = r.action.trim().toUpperCase();
    if (!/^[A-Z0-9_]{1,60}$/.test(action)) return { ok: false, error: "Action filter may only contain letters, digits and _." };
  }
  const day = (v: unknown, end: boolean): Date | null | "bad" => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v !== "string" || !DATE_RE.test(v)) return "bad";
    const d = new Date(`${v}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return "bad";
    return end ? new Date(d.getTime() + 24 * 3600_000) : d; // `to` is exclusive internally
  };
  const from = day(r.from, false);
  const to = day(r.to, true);
  if (from === "bad" || to === "bad") return { ok: false, error: "Dates must be YYYY-MM-DD." };
  if (from && to) {
    if (to <= from) return { ok: false, error: "The end date must be on or after the start date." };
    if ((to.getTime() - from.getTime()) / 86_400_000 > AUDIT_MAX_RANGE_DAYS) {
      return { ok: false, error: `Pick a range of at most ${AUDIT_MAX_RANGE_DAYS} days.` };
    }
  }
  return { ok: true, filter: { action, from, to } };
}

export function clampPageSize(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(AUDIT_MAX_PAGE_SIZE, Math.max(1, v)) : AUDIT_PAGE_SIZE;
}

/** Parse the JSON details column; non-JSON text is returned as { text }. */
export function parseDetails(details: string | null | undefined): Record<string, unknown> | null {
  if (!details) return null;
  try {
    const v = JSON.parse(details);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : { value: v };
  } catch {
    return { text: details };
  }
}

/**
 * One CSV cell: quoted, quotes doubled, and cells that a spreadsheet would run as a formula (= + - @, tab, CR)
 * prefixed with an apostrophe.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export type AuditCsvRow = { createdAt: Date | string; action: string; userName: string | null; userRole: string | null; details: string | null };

export function auditRowsToCsv(rows: AuditCsvRow[]): string {
  const header = ["time_utc", "action", "user", "role", "details"].map(csvCell).join(",");
  const lines = rows.map((r) =>
    [new Date(r.createdAt).toISOString(), r.action, r.userName ?? "", r.userRole ?? "", r.details ?? ""].map(csvCell).join(","),
  );
  return [header, ...lines].join("\r\n");
}

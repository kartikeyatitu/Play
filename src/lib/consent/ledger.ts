// Pure consent-ledger logic. The ledger is append-only: a grant is a row with granted=true, a
// withdrawal is a NEW row with granted=false and withdrawnAt set. Rows are never updated or deleted.
import { CONSENT_METHOD_ENROLMENT_OTP, CONSENT_NOTICE_VERSION, CONSENT_PURPOSES, type ConsentPurpose } from "./purposes";

export interface ConsentRow {
  studentId: string;
  purpose: string;
  granted: boolean;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
  noticeVersion: string;
  createdAt: Date;
  guardianUserId?: string;
  method?: string;
  id?: string;
}

/** The moment a row took effect: withdrawal time, else grant time, else insertion time. */
function effectiveAt(r: ConsentRow): number {
  const t = r.withdrawnAt ?? r.grantedAt ?? r.createdAt;
  return new Date(t).getTime();
}

/**
 * Latest row for this child and purpose, or null. Ordered by insertion time; ties are broken by the
 * effective time, and a withdrawal wins an exact tie (fail closed).
 */
export function latestConsentRow(rows: readonly ConsentRow[], studentId: string, purpose: string, at?: Date): ConsentRow | null {
  const cutoff = at ? at.getTime() : Infinity;
  let best: ConsentRow | null = null;
  for (const r of rows) {
    if (r.studentId !== studentId || r.purpose !== purpose) continue;
    if (new Date(r.createdAt).getTime() > cutoff) continue;
    if (!best) {
      best = r;
      continue;
    }
    const a = new Date(r.createdAt).getTime();
    const b = new Date(best.createdAt).getTime();
    if (a > b) best = r;
    else if (a === b) {
      const ea = effectiveAt(r);
      const eb = effectiveAt(best);
      if (ea > eb || (ea === eb && isWithdrawal(r))) best = r;
    }
  }
  return best;
}

function isWithdrawal(r: ConsentRow) {
  return !r.granted || r.withdrawnAt != null;
}

/**
 * True only when the most recent row for (studentId, purpose) is an active grant.
 * No row means no consent. With `noticeVersion`, a grant under any other notice version does not count.
 * With `at`, answers as of that time (rows inserted later are ignored).
 * COUNSEL: with two guardians the latest action of either guardian decides (a withdrawal by one
 * guardian overrides an earlier grant by the other). Confirm this is the intended rule.
 */
export function hasConsent(
  rows: readonly ConsentRow[],
  studentId: string,
  purpose: ConsentPurpose,
  opts: { noticeVersion?: string; at?: Date } = {},
): boolean {
  const r = latestConsentRow(rows, studentId, purpose, opts.at);
  if (!r || isWithdrawal(r) || !r.grantedAt) return false;
  if (opts.noticeVersion && r.noticeVersion !== opts.noticeVersion) return false;
  return true;
}

export type ConsentState = "GRANTED" | "WITHDRAWN" | "NOT_ASKED";

/** Per-purpose state for one child, for the /consent page. */
export function consentSummary(rows: readonly ConsentRow[], studentId: string): Record<ConsentPurpose, { state: ConsentState; since: Date | null }> {
  const out = {} as Record<ConsentPurpose, { state: ConsentState; since: Date | null }>;
  for (const p of CONSENT_PURPOSES) {
    const r = latestConsentRow(rows, studentId, p);
    if (!r) out[p] = { state: "NOT_ASKED", since: null };
    else if (isWithdrawal(r)) out[p] = { state: "WITHDRAWN", since: r.withdrawnAt ?? r.createdAt };
    else out[p] = { state: "GRANTED", since: r.grantedAt ?? r.createdAt };
  }
  return out;
}

export interface NewConsentRow {
  orgId: string;
  studentId: string;
  guardianUserId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
  method: string;
  noticeVersion: string;
}

/**
 * Rows to append for a set of requested changes. A change that matches the current state appends
 * nothing (no duplicate grants or withdrawals). A withdrawal of a purpose never granted is still
 * recorded, so a guardian's explicit "no" is on the ledger.
 */
export function consentRowsToAppend(
  existing: readonly ConsentRow[],
  ctx: { orgId: string; studentId: string; guardianUserId: string; now: Date; method?: string; noticeVersion?: string },
  changes: readonly { purpose: ConsentPurpose; granted: boolean }[],
): NewConsentRow[] {
  const seen = new Set<string>();
  const out: NewConsentRow[] = [];
  for (const c of changes) {
    if (seen.has(c.purpose)) continue;
    seen.add(c.purpose);
    const latest = latestConsentRow(existing, ctx.studentId, c.purpose);
    const currentlyGranted = hasConsent(existing, ctx.studentId, c.purpose);
    if (c.granted && currentlyGranted) continue;
    if (!c.granted && latest && isWithdrawal(latest)) continue;
    out.push({
      orgId: ctx.orgId,
      studentId: ctx.studentId,
      guardianUserId: ctx.guardianUserId,
      purpose: c.purpose,
      granted: c.granted,
      grantedAt: c.granted ? ctx.now : null,
      withdrawnAt: c.granted ? null : ctx.now,
      method: ctx.method ?? CONSENT_METHOD_ENROLMENT_OTP,
      noticeVersion: ctx.noticeVersion ?? CONSENT_NOTICE_VERSION,
    });
  }
  return out;
}
